"""
VoiceGuard Audio Ingestion & Preprocessing Service
=================================================
Validates, decodes, downmixes, resamples, and conditions arbitrary audio streams
strictly to the 16 kHz mono 4.0-second waveform expected by the harmonized CNN pipeline.
Operates entirely in-memory for security, speed, and privacy.
"""

import io
import logging
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import soundfile as sf
import torch
import torchaudio
from fastapi import HTTPException, status

from backend.config import (
    ALLOWED_EXTENSIONS,
    MAX_UPLOAD_SIZE_BYTES,
    MIN_AUDIO_DURATION_SEC,
    SAMPLE_RATE,
    TARGET_SAMPLES,
)
from backend.schemas import AudioMetadata

logger = logging.getLogger(__name__)


class AudioService:
    """In-memory audio decoding, resampling, and window standardization."""

    def __init__(self, target_sr: int = SAMPLE_RATE, target_samples: int = TARGET_SAMPLES) -> None:
        self.target_sr = target_sr
        self.target_samples = target_samples
        self._resamplers: Dict[int, torchaudio.transforms.Resample] = {}

    def validate_file_header(self, filename: str, content_length: int) -> None:
        """Verify upload size and file extension constraints."""
        if content_length == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded audio file is empty (0 bytes)."
            )

        if content_length > MAX_UPLOAD_SIZE_BYTES:
            max_mb = MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed upload size of {max_mb} MB."
            )

        suffix = Path(filename).suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file extension '{suffix}'. Supported audio formats: {allowed}"
            )

    def decode_and_standardize(
        self, audio_bytes: bytes, filename: str
    ) -> Tuple[torch.Tensor, AudioMetadata]:
        """
        Decodes audio bytes from memory and outputs a float32 1-D tensor of shape [64000].

        Returns:
            waveform: Float32 PyTorch tensor of exact shape [64000]
            metadata: AudioMetadata detailing original properties
        """
        self.validate_file_header(filename, len(audio_bytes))

        # 1. Decode raw audio bytes in-memory using SoundFile
        try:
            buffer = io.BytesIO(audio_bytes)
            data, orig_sr = sf.read(buffer, dtype="float32", always_2d=True)
        except Exception as exc:
            logger.warning("SoundFile decoding failed for '%s': %s", filename, exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not decode audio file '{filename}'. The file may be corrupted or in an unsupported codec."
            ) from exc

        num_frames = data.shape[0]
        channels = data.shape[1]

        if num_frames == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Audio file '{filename}' contains 0 audio frames."
            )

        orig_duration = num_frames / float(orig_sr)
        if orig_duration < MIN_AUDIO_DURATION_SEC:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Audio duration ({orig_duration:.2f}s) is shorter than the minimum "
                    f"viable length ({MIN_AUDIO_DURATION_SEC}s)."
                )
            )

        # 2. Downmix multi-channel (stereo) to mono
        if channels > 1:
            mono_data = data.mean(axis=1)
        else:
            mono_data = data[:, 0]

        waveform = torch.from_numpy(mono_data)  # shape [N]

        # 3. Clean any NaNs or Infs
        if torch.any(torch.isnan(waveform)) or torch.any(torch.isinf(waveform)):
            waveform = torch.nan_to_num(waveform, nan=0.0, posinf=0.0, neginf=0.0)

        # 4. Resample to target sample rate (16,000 Hz) if needed
        if orig_sr != self.target_sr:
            if orig_sr not in self._resamplers:
                self._resamplers[orig_sr] = torchaudio.transforms.Resample(
                    orig_freq=orig_sr, new_freq=self.target_sr
                )
            resampler = self._resamplers[orig_sr]
            waveform = resampler(waveform.unsqueeze(0)).squeeze(0)

        # 5. Fixed window padding or cropping to exactly target_samples (64,000)
        curr_len = waveform.shape[0]
        target = self.target_samples

        if curr_len < target:
            padding = target - curr_len
            waveform = torch.nn.functional.pad(waveform, (0, padding))
        elif curr_len > target:
            waveform = waveform[:target]

        metadata = AudioMetadata(
            filename=Path(filename).name,
            original_sample_rate=orig_sr,
            original_channels=channels,
            original_duration_sec=round(orig_duration, 3),
            processed_samples=target,
        )

        return waveform, metadata
