"""
VoiceGuard Authoritative Model Inference Service
================================================
Executes end-to-end voice spoof detection using the authoritative ITW speaker-weighted
AudioCNN model and dedicated 60-band LFCC feature extraction pipeline.
Operates strictly in-memory and local under torch.inference_mode().
"""

import logging
import time
from typing import Optional

import numpy as np
import torch

from backend.audio_service import AudioService
from backend.config import DEFAULT_THRESHOLD_LOGIT
from backend.model_loader import ModelLoader
from backend.schemas import AudioMetadata, PredictionResponse

logger = logging.getLogger("voiceguard.inference")


class InferenceService:
    """Manages audio decoding, LFCC extraction, normalization, and AudioCNN forward pass."""

    def __init__(
        self,
        model_loader: ModelLoader,
        audio_service: AudioService,
        threshold: Optional[float] = None,
    ):
        self.loader = model_loader
        self.audio_service = audio_service
        self.threshold = threshold if threshold is not None else getattr(model_loader, "threshold", DEFAULT_THRESHOLD_LOGIT)

    def predict(self, audio_bytes: bytes, filename: str, source: str = "upload") -> PredictionResponse:
        """
        Executes end-to-end local prediction on uploaded or recorded audio bytes.

        Steps:
            1. In-memory decoding of WAV, MP3, FLAC, or OGG to PCM waveform.
            2. Downmix multi-channel to mono, resample to 16,000 Hz, standardize to 64,000 samples.
            3. Extract 60-band LFCC features (shape [60, 398]) via exact training DCT-II formulation.
            4. Normalize features with training set statistics: (features - mean) / (std + 1e-8).
            5. Forward pass through AudioCNN under torch.inference_mode().
            6. Evaluate raw logit against calibrated decision threshold (0.15903853).
            7. Return structured PredictionResponse with confidence, metadata, and scores.
        """
        t_start = time.perf_counter()

        # 1. Decode & standardize audio to 16 kHz mono 4.0s (64,000 samples)
        waveform, metadata = self.audio_service.decode_and_standardize(audio_bytes, filename)

        # 2. Extract LFCC features using the authoritative extractor
        extractor = self.loader.get_extractor()
        model = self.loader.get_model()
        mean, std = self.loader.get_stats()
        device = self.loader.device

        # Waveform as numpy array for LFCCExtractor
        audio_np = waveform.numpy() if hasattr(waveform, "numpy") else np.asarray(waveform, dtype=np.float32)

        # Extract LFCC (60, 398)
        features = extractor.extract_from_waveform(audio_np)

        if features.shape != (60, 398):
            raise RuntimeError(f"Unexpected LFCC shape {features.shape}; expected (60, 398)")

        with torch.inference_mode():
            # Convert features to torch tensor and normalize using stats
            feat_tensor = torch.from_numpy(features).to(device)  # shape [60, 398]
            norm_features = (feat_tensor - mean) / (std + 1e-8)

            # Convert to CNN batch format: (1, 1, 60, 398)
            input_tensor = norm_features.unsqueeze(0).unsqueeze(0)

            # CNN Forward pass
            logit = model(input_tensor).squeeze()
            raw_logit = float(logit.item())
            spoof_score = float(torch.sigmoid(logit).item())

        # Class semantics: 0: Bonafide (Human), 1: Spoof (AI)
        bonafide_score = float(max(0.0, min(1.0, 1.0 - spoof_score)))
        spoof_score = float(max(0.0, min(1.0, spoof_score)))

        # Calibrated decision threshold on raw logit: raw_logit >= self.threshold => SPOOF
        if raw_logit >= self.threshold:
            predicted_class = "SPOOF"
            confidence = spoof_score
        else:
            predicted_class = "BONAFIDE"
            confidence = bonafide_score

        elapsed_ms = (time.perf_counter() - t_start) * 1000.0

        return PredictionResponse(
            predicted_class=predicted_class,
            confidence=round(confidence, 4),
            bonafide_score=round(bonafide_score, 4),
            spoof_score=round(spoof_score, 4),
            threshold=round(self.threshold, 4),
            source=source,
            processing_time_ms=round(elapsed_ms, 2),
            model_status="operational",
            raw_logit=round(raw_logit, 4),
            audio_metadata=metadata,
        )
