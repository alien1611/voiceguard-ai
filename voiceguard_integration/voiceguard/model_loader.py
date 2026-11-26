from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import torch

from .audio_processor import MODEL_DURATION_SECONDS, SAMPLE_RATE as AUDIO_SAMPLE_RATE
from .config import VoiceGuardConfig
from .exceptions import ConfigurationError, ModelLoadError
from .feature_extractor import (
    FEATURE_SHAPE,
    FRAME_LENGTH,
    HOP_LENGTH,
    N_FFT,
    NUM_FILTERS,
    SAMPLE_RATE,
)
from .model_architecture import AudioCNN


@dataclass(frozen=True)
class LoadedModel:
    model: AudioCNN
    mean: np.ndarray
    std: np.ndarray
    threshold: float
    device: torch.device
    metadata: dict[str, Any]
    checkpoint_hash: str
    normalization_hash: str


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class ModelLoader:
    """Load and verify only the artifacts named by the integration config."""

    def __init__(self, config: VoiceGuardConfig):
        self.config = config

    def load(self) -> LoadedModel:
        required = (
            self.config.checkpoint_path,
            self.config.normalization_path,
            self.config.threshold_path,
            self.config.metadata_path,
        )
        missing = [str(path) for path in required if not path.is_file()]
        if missing:
            raise ModelLoadError("Required model artifacts are missing: " + ", ".join(missing))

        try:
            metadata = json.loads(
                self.config.metadata_path.read_text(encoding="utf-8")
            )
        except (OSError, json.JSONDecodeError) as error:
            raise ModelLoadError(
                f"Could not read model metadata {self.config.metadata_path}: {error}"
            ) from error

        if metadata.get("checkpoint") != self.config.checkpoint_name:
            raise ConfigurationError(
                "Metadata does not identify the configured speaker-weighted checkpoint."
            )
        if metadata.get("normalization_stats") != self.config.normalization_name:
            raise ConfigurationError(
                "Metadata does not identify the configured normalization statistics."
            )
        if metadata.get("threshold_file") != self.config.threshold_name:
            raise ConfigurationError(
                "Metadata does not identify the configured speaker-weighted threshold."
            )

        checkpoint_hash = sha256_file(self.config.checkpoint_path)
        normalization_hash = sha256_file(self.config.normalization_path)
        if checkpoint_hash != metadata.get("checkpoint_sha256"):
            raise ModelLoadError("Checkpoint SHA-256 does not match model metadata.")
        if normalization_hash != metadata.get("normalization_stats_sha256"):
            raise ModelLoadError("Normalization SHA-256 does not match model metadata.")

        self._validate_metadata(metadata)

        try:
            with np.load(self.config.normalization_path) as statistics:
                mean = statistics["mean"].astype(np.float32)
                std = statistics["std"].astype(np.float32)
            threshold_values = np.load(self.config.threshold_path)
        except (OSError, ValueError, KeyError) as error:
            raise ModelLoadError(f"Could not load matching normalization/threshold: {error}") from error
        if mean.shape != (1, NUM_FILTERS, 1) or not np.isfinite(mean).all():
            raise ModelLoadError(f"Invalid normalization mean shape or values: {mean.shape}")
        if (
            std.shape != (1, NUM_FILTERS, 1)
            or not np.isfinite(std).all()
            or np.any(std <= 0)
        ):
            raise ModelLoadError(f"Invalid normalization standard deviations: {std.shape}")
        if threshold_values.size != 1:
            raise ModelLoadError("The calibrated raw-logit threshold must be one scalar.")
        threshold = float(threshold_values.item())
        metadata_threshold = float(metadata.get("threshold_logit", float("nan")))
        if (
            not math.isfinite(threshold)
            or not math.isclose(threshold, metadata_threshold, rel_tol=0, abs_tol=1e-7)
            or metadata.get("threshold_type") != "raw logit"
        ):
            raise ModelLoadError(
                "Threshold file does not match the model's raw-logit metadata."
            )

        device = self._device()
        try:
            model = AudioCNN().to(device)
            state = torch.load(
                self.config.checkpoint_path,
                map_location=device,
                weights_only=True,
            )
            model.load_state_dict(state)
            model.eval()
        except Exception as error:
            raise ModelLoadError(
                f"Could not load speaker-weighted AudioCNN on {device}: {error}"
            ) from error
        return LoadedModel(
            model=model,
            mean=mean,
            std=std,
            threshold=threshold,
            device=device,
            metadata=metadata,
            checkpoint_hash=checkpoint_hash,
            normalization_hash=normalization_hash,
        )

    def _device(self) -> torch.device:
        if self.config.device == "cuda":
            if not torch.cuda.is_available():
                raise ModelLoadError("CUDA was requested but is unavailable.")
            return torch.device("cuda")
        if self.config.device == "cpu":
            return torch.device("cpu")
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")

    @staticmethod
    def _validate_metadata(metadata: dict[str, Any]) -> None:
        expected = {
            "sample_rate": SAMPLE_RATE,
            "frame_length": FRAME_LENGTH,
            "hop_length": HOP_LENGTH,
            "n_fft": N_FFT,
            "num_filters": NUM_FILTERS,
            "feature_shape": list(FEATURE_SHAPE),
        }
        if metadata.get("lfcc") != expected:
            raise ConfigurationError(
                f"Metadata LFCC configuration differs from package implementation: "
                f"{metadata.get('lfcc')!r}"
            )
        if metadata.get("lfcc", {}).get("sample_rate") != AUDIO_SAMPLE_RATE:
            raise ConfigurationError("Audio preprocessing and LFCC sample rates differ.")
        if MODEL_DURATION_SECONDS != 4:
            raise ConfigurationError("Package preprocessing duration is not four seconds.")
        if metadata.get("threshold_type") != "raw logit":
            raise ConfigurationError("Metadata must define a raw-logit threshold.")
