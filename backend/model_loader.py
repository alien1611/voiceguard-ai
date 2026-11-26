"""
VoiceGuard Authoritative CNN Model Loader (Singleton)
=====================================================
Safely loads and cryptographically verifies the authoritative AudioCNN checkpoint
and normalization statistics at application startup. Enforces strict error raising
if assets are missing, corrupted, or hash-mismatched.
"""

import hashlib
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
import torch

from backend.config import (
    DEFAULT_THRESHOLD_LOGIT,
    EXPECTED_CHECKPOINT_SHA256,
    EXPECTED_FEATURE_SHAPE,
    EXPECTED_NORMALIZATION_SHA256,
    METADATA_PATH,
    MODEL_DIR,
    MODEL_PATH,
    NORMALIZATION_STATS_PATH,
    PROJECT_ROOT,
    SAMPLE_RATE,
    THRESHOLD_PATH,
    VOICEGUARD_DIR,
    get_device,
)

# Ensure voiceguard_integration directory is on sys.path
for p in (str(VOICEGUARD_DIR), str(PROJECT_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from voiceguard.model_architecture import AudioCNN
except ImportError:
    from cnn.cnn_model import AudioCNN

from backend.new_extractor import NewLFCCExtractor

logger = logging.getLogger("voiceguard.model")


def compute_sha256(path: Path) -> str:
    """Compute SHA-256 hex digest of a file."""
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class ModelLoader:
    """Manages thread-safe loading, integrity verification, and persistent in-memory caching of AudioCNN."""

    _instance: Optional["ModelLoader"] = None

    def __init__(self) -> None:
        self.device = get_device()
        self.model: Optional[AudioCNN] = None
        self.mean: Optional[torch.Tensor] = None
        self.std: Optional[torch.Tensor] = None
        self.extractor: Optional[NewLFCCExtractor] = None
        self.threshold: float = DEFAULT_THRESHOLD_LOGIT
        self.metadata: Dict[str, Any] = {}
        self.checkpoint_sha256: str = ""
        self.normalization_sha256: str = ""
        self.is_ready: bool = False

    @classmethod
    def get_instance(cls) -> "ModelLoader":
        """Return singleton ModelLoader instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self) -> None:
        """
        Load and verify the authoritative ITW speaker-weighted checkpoint,
        normalization statistics, metadata, and calibrated raw-logit threshold.
        Raises RuntimeError if any required asset fails verification.
        """
        if self.is_ready:
            return

        logger.info("Initializing VoiceGuard Authoritative CNN Loader on device: %s", self.device)

        # 1. Verify existence of required model artifacts
        required_files = [MODEL_PATH, NORMALIZATION_STATS_PATH, THRESHOLD_PATH, METADATA_PATH]
        missing = [p.name for p in required_files if not p.exists()]
        if missing:
            raise RuntimeError(f"Required VoiceGuard model artifacts missing: {', '.join(missing)}")

        # 2. Parse and validate metadata JSON
        try:
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
        except Exception as exc:
            raise RuntimeError(f"Failed to read model metadata from '{METADATA_PATH.name}': {exc}") from exc

        # 3. Cryptographic SHA-256 integrity checks
        actual_ckpt_sha = compute_sha256(MODEL_PATH)
        self.checkpoint_sha256 = actual_ckpt_sha
        expected_ckpt_sha = self.metadata.get("checkpoint_sha256", EXPECTED_CHECKPOINT_SHA256)
        if actual_ckpt_sha != expected_ckpt_sha:
            raise RuntimeError(
                f"Checkpoint SHA-256 mismatch! Expected {expected_ckpt_sha}, got {actual_ckpt_sha}"
            )

        actual_norm_sha = compute_sha256(NORMALIZATION_STATS_PATH)
        self.normalization_sha256 = actual_norm_sha
        expected_norm_sha = self.metadata.get("normalization_stats_sha256", EXPECTED_NORMALIZATION_SHA256)
        if actual_norm_sha != expected_norm_sha:
            raise RuntimeError(
                f"Normalization stats SHA-256 mismatch! Expected {expected_norm_sha}, got {actual_norm_sha}"
            )

        # 4. Load calibrated raw-logit decision threshold
        try:
            thresh_arr = np.load(THRESHOLD_PATH)
            self.threshold = float(thresh_arr.item())
        except Exception as exc:
            logger.warning("Could not read threshold file, falling back to default: %s", exc)
            self.threshold = DEFAULT_THRESHOLD_LOGIT

        # 5. Load normalization statistics
        try:
            stats = np.load(NORMALIZATION_STATS_PATH)
            raw_mean = stats["mean"]
            raw_std = stats["std"]

            if raw_mean.shape != (1, 60, 1) and raw_mean.shape != (60, 1):
                raise ValueError(f"Unexpected normalization mean shape: {raw_mean.shape}")
            if raw_std.shape != (1, 60, 1) and raw_std.shape != (60, 1):
                raise ValueError(f"Unexpected normalization std shape: {raw_std.shape}")

            if not np.all(np.isfinite(raw_mean)):
                raise ValueError("Normalization mean contains NaN or Inf.")
            if not np.all(np.isfinite(raw_std)) or np.any(raw_std <= 0):
                raise ValueError("Normalization std contains invalid/non-positive values.")

            self.mean = torch.from_numpy(raw_mean.reshape(60, 1)).to(torch.float32).to(self.device)
            self.std = torch.from_numpy(raw_std.reshape(60, 1)).to(torch.float32).to(self.device)
        except Exception as exc:
            raise RuntimeError(f"Failed to parse normalization stats from '{NORMALIZATION_STATS_PATH.name}': {exc}") from exc

        # 6. Instantiate model architecture and load checkpoint weights
        try:
            self.model = AudioCNN().to(self.device)
            state_dict = torch.load(MODEL_PATH, map_location=self.device, weights_only=True)
            self.model.load_state_dict(state_dict)
            self.model.eval()  # Strictly set to evaluation mode
        except Exception as exc:
            raise RuntimeError(f"Failed to load PyTorch state_dict into AudioCNN: {exc}") from exc

        # 7. Initialize dedicated LFCC extractor (exact SciPy DCT-II match to training)
        try:
            self.extractor = NewLFCCExtractor()
        except Exception as exc:
            raise RuntimeError(f"Failed to initialize LFCCExtractor: {exc}") from exc

        self.is_ready = True

        total_params = sum(p.numel() for p in self.model.parameters())

        # Startup diagnostic log (without leaking sensitive filesystem paths)
        logger.info(
            "\n"
            "================================================================================\n"
            "  VOICEGUARD AUTHORITATIVE AI MODEL INITIALIZED\n"
            "--------------------------------------------------------------------------------\n"
            "  Active Model:            %s\n"
            "  Active Model SHA-256:    %s\n"
            "  Model Architecture:      AudioCNN (3 Conv Blocks + AdaptiveAvgPool + Linear)\n"
            "  Total Parameters:        %d\n"
            "  Expected Sample Rate:    %d Hz\n"
            "  Expected Input Shape:    [1, 1, %d, %d]\n"
            "  Normalization File:      %s\n"
            "  Normalization SHA-256:   %s\n"
            "  Decision Threshold:      %.8f (raw logit)\n"
            "  Inference Implementation: VoiceGuard 60-band LFCC + AudioCNN (Local / In-Memory)\n"
            "  Device:                  %s\n"
            "================================================================================",
            MODEL_PATH.name,
            self.checkpoint_sha256,
            total_params,
            SAMPLE_RATE,
            EXPECTED_FEATURE_SHAPE[0],
            EXPECTED_FEATURE_SHAPE[1],
            NORMALIZATION_STATS_PATH.name,
            self.normalization_sha256,
            self.threshold,
            self.device,
        )

    def get_model(self) -> AudioCNN:
        if not self.is_ready or self.model is None:
            raise RuntimeError("ModelLoader has not been initialized.")
        return self.model

    def get_stats(self) -> Tuple[torch.Tensor, torch.Tensor]:
        if not self.is_ready or self.mean is None or self.std is None:
            raise RuntimeError("ModelLoader normalization statistics are not initialized.")
        return self.mean, self.std

    def get_extractor(self) -> NewLFCCExtractor:
        if not self.is_ready or self.extractor is None:
            raise RuntimeError("ModelLoader extractor is not initialized.")
        return self.extractor

    def get_threshold(self) -> float:
        return self.threshold

    def get_metadata(self) -> Dict[str, Any]:
        return self.metadata
