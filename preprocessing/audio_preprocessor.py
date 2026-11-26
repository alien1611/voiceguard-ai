"""
VoiceGuard – Audio Preprocessing Module
========================================
Provides AudioPreprocessor: a reusable class for loading, normalising,
resampling and fixed-duration windowing of raw WAV audio files.

Downstream consumers (LFCC extractor, batch extractor) all pass through this
class to guarantee a consistent waveform representation.
"""

import logging
import warnings
from pathlib import Path
from typing import Optional, Tuple, Union

import numpy as np
import soundfile as sf
import torch
import torchaudio

logger = logging.getLogger(__name__)


class AudioPreprocessor:
    """
    Reusable audio preprocessing pipeline for VoiceGuard.

    Guarantees a fixed-shape, clean float32 PyTorch tensor suitable for
    downstream LFCC extraction regardless of the source file's sample rate,
    channel count or duration.

    Parameters
    ----------
    target_sr : int
        Target sample rate in Hz. Default 16 000 Hz (ASVspoof standard).
    duration_sec : float
        Fixed output duration in seconds. Shorter files are zero-padded;
        longer files are cropped from the start. Default 3.0 s.
    silence_threshold : float
        RMS energy below this value is considered silence. Default 0.001.
    """

    TARGET_SAMPLE_RATE: int = 16_000
    TARGET_DURATION_SEC: float = 3.0
    HARMONIZED_DURATION_SEC: float = 4.0

    def __init__(
        self,
        target_sr: int = 16_000,
        duration_sec: float = 3.0,
        silence_threshold: float = 0.001,
    ) -> None:
        self.target_sr = target_sr
        self.duration_sec = duration_sec
        self.target_samples = int(target_sr * duration_sec)
        self.silence_threshold = silence_threshold
        # Cache of Resample transforms keyed by original sample rate
        self._resamplers: dict = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_audio(
        self, path: Union[str, Path]
    ) -> Tuple[torch.Tensor, int]:
        """
        Load a WAV file from *path* and return a mono float32 1-D tensor.

        Parameters
        ----------
        path : str or Path
            Absolute or relative path to the WAV (or any soundfile-readable)
            audio file.

        Returns
        -------
        waveform : torch.Tensor
            1-D float32 tensor of shape ``[N]`` where N is the number of
            samples at the original sample rate.
        sample_rate : int
            Original sample rate of the file.

        Raises
        ------
        FileNotFoundError
            If *path* does not point to an existing file.
        ValueError
            If the loaded waveform is empty (zero samples).
        """
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(
                f"Audio file not found: {path}"
            )

        # soundfile.read with always_2d=True → shape [frames, channels]
        data, sample_rate = sf.read(str(path), dtype="float32", always_2d=True)

        if data.shape[0] == 0:
            raise ValueError(
                f"Audio file is empty (0 samples): {path}"
            )

        # Stereo → mono by averaging channels
        if data.shape[1] > 1:
            data = data.mean(axis=1)
        else:
            data = data[:, 0]

        waveform = torch.from_numpy(data)  # shape [N]

        # Sanitise NaN / Inf values
        if torch.any(torch.isnan(waveform)) or torch.any(torch.isinf(waveform)):
            warnings.warn(
                f"NaN or Inf values detected in '{path}'; replacing with 0.0.",
                RuntimeWarning,
                stacklevel=2,
            )
            waveform = torch.nan_to_num(waveform, nan=0.0, posinf=0.0, neginf=0.0)

        return waveform, sample_rate

    def resample(
        self, waveform: torch.Tensor, orig_sr: int
    ) -> torch.Tensor:
        """
        Resample *waveform* from *orig_sr* to ``self.target_sr``.

        Uses a cached ``torchaudio.transforms.Resample`` instance per
        original sample rate to avoid repeated initialisation overhead.

        Parameters
        ----------
        waveform : torch.Tensor
            1-D float32 waveform tensor.
        orig_sr : int
            Original (source) sample rate.

        Returns
        -------
        torch.Tensor
            Resampled 1-D float32 waveform at ``self.target_sr``.
        """
        if orig_sr == self.target_sr:
            return waveform

        if orig_sr not in self._resamplers:
            self._resamplers[orig_sr] = torchaudio.transforms.Resample(
                orig_freq=orig_sr, new_freq=self.target_sr
            )

        # Resample expects [channel, time]; add/remove dim
        resampler = self._resamplers[orig_sr]
        return resampler(waveform.unsqueeze(0)).squeeze(0)

    def pad_or_crop(self, waveform: torch.Tensor) -> torch.Tensor:
        """
        Pad (zero-pad on the right) or crop (from the start) *waveform* to
        exactly ``self.target_samples`` samples.

        Parameters
        ----------
        waveform : torch.Tensor
            1-D float32 waveform tensor.

        Returns
        -------
        torch.Tensor
            1-D tensor of length ``self.target_samples``.
        """
        n = waveform.shape[0]
        target = self.target_samples

        if n < target:
            padding = target - n
            waveform = torch.nn.functional.pad(waveform, (0, padding))
        elif n > target:
            waveform = waveform[:target]

        return waveform

    def check_silence(self, waveform: torch.Tensor) -> bool:
        """
        Return ``True`` if the waveform's RMS energy is below the silence
        threshold, indicating a likely silent or empty recording.

        Parameters
        ----------
        waveform : torch.Tensor
            1-D float32 waveform tensor.

        Returns
        -------
        bool
            ``True`` if silent, ``False`` otherwise.
        """
        rms = torch.sqrt(torch.mean(waveform ** 2))
        return rms.item() < self.silence_threshold

    def process(
        self,
        path: Union[str, Path],
        warn_silent: bool = True,
    ) -> torch.Tensor:
        """
        Full preprocessing pipeline: load → resample → pad/crop → validate.

        Parameters
        ----------
        path : str or Path
            Path to the audio file.
        warn_silent : bool
            If ``True`` (default), emit a warning when the processed waveform
            is silent. The sample is *not* discarded — it is the caller's
            responsibility to decide what to do with silent samples.

        Returns
        -------
        torch.Tensor
            Float32 tensor of shape ``[1, target_samples]``, ready for LFCC
            extraction. The leading dimension is the channel dimension expected
            by ``torchaudio.transforms.LFCC``.

        Raises
        ------
        FileNotFoundError
            Propagated from :meth:`load_audio`.
        ValueError
            Propagated from :meth:`load_audio` for empty files.
        """
        waveform, orig_sr = self.load_audio(path)
        waveform = self.resample(waveform, orig_sr)
        waveform = self.pad_or_crop(waveform)

        if warn_silent and self.check_silence(waveform):
            logger.warning(
                "Silent or near-silent audio detected in '%s'. "
                "RMS energy is below threshold (%.4f). "
                "This sample may be invalid.",
                path,
                self.silence_threshold,
            )

        # Add channel dimension: [target_samples] → [1, target_samples]
        return waveform.unsqueeze(0)

    def __repr__(self) -> str:
        return (
            f"AudioPreprocessor("
            f"target_sr={self.target_sr}, "
            f"duration_sec={self.duration_sec}, "
            f"target_samples={self.target_samples}, "
            f"silence_threshold={self.silence_threshold})"
        )
