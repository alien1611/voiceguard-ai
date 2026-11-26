"""
VoiceGuard – Harmonized 60-Coefficient LFCC Extractor
=====================================================
A PyTorch-based LFCC extractor mathematically harmonized with the
existing CNN model (cnn/cnn_model.py, cnn/best_audio_cnn.pth, and
cnn/lfcc_extractor.py).

Features:
- Sample rate: 16 000 Hz mono
- Fixed duration: 4.0 seconds (64 000 samples)
- Frame length: 400 samples (25 ms)
- Hop length: 160 samples (10 ms, 60% overlap)
- Slicing: Exactly 398 frames via unfold
- Window: Symmetric Hamming window (periodic=False)
- FFT: 512-point real FFT with right-side zero-padding
- Spectrum: Power spectrum (|X[k]|^2, 257 bins)
- Filter-bank: 60 linear triangular filters (0 to 8 000 Hz)
- Logarithm: Natural log ln(energy + 1e-10)
- DCT: DCT-II with orthogonal normalization (scipy / torchaudio norm='ortho')
- Output shape: (60, 398) float32 tensor
"""

import logging
import sys
from pathlib import Path
from typing import Dict, Optional, Union

import numpy as np
import torch
import torchaudio.functional as F

# Ensure project root is importable
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

try:
    from preprocessing.audio_preprocessor import AudioPreprocessor
except ImportError:
    try:
        from ml.preprocessing.audio_preprocessor import AudioPreprocessor
    except ImportError:
        from ..preprocessing.audio_preprocessor import AudioPreprocessor

logger = logging.getLogger(__name__)

# Centralized canonical configuration for 60-coefficient CNN harmonization
HARMONIZED_LFCC_CONFIG: Dict[str, Union[int, float, str, bool]] = {
    "sample_rate": 16_000,       # Target sample rate (Hz)
    "duration_sec": 4.0,         # Fixed audio duration (s)
    "target_samples": 64_000,    # 16 000 Hz * 4.0 s
    "win_length": 400,           # Analysis window length (samples / 25 ms)
    "hop_length": 160,           # Frame shift (samples / 10 ms)
    "n_fft": 512,                # FFT size (zero-padded on right)
    "n_filter": 60,              # Number of linear filter-bank filters
    "n_lfcc": 60,                # Number of LFCC coefficients to retain
    "f_min": 0.0,                # Minimum filter-bank frequency (Hz)
    "f_max": 8_000.0,            # Maximum frequency (Nyquist for 16 kHz)
    "epsilon": 1e-10,            # Offset added before natural logarithm
    "dct_norm": "ortho",         # DCT-II orthogonal normalization
}


class HarmonizedLFCCExtractor:
    """
    Harmonized LFCC feature extractor.

    Reproduces the exact numerical behavior of `cnn/lfcc_extractor.py` using
    native PyTorch tensor operations for CPU/GPU efficiency.

    Output shape:
        Single waveform: torch.Size([60, 398])
        Batch:           torch.Size([B, 60, 398])
        CNN Input:       torch.Size([B, 1, 60, 398]) (via unsqueeze)
    """

    def __init__(
        self,
        config: Optional[dict] = None,
        preprocessor: Optional[AudioPreprocessor] = None,
        device: Union[str, torch.device] = "cpu",
    ) -> None:
        self.config = {**HARMONIZED_LFCC_CONFIG, **(config or {})}
        self.device = torch.device(device)

        # 1. Linear triangular filterbank: [n_freqs, n_filter] -> [257, 60]
        self.filterbank = F.linear_fbanks(
            n_freqs=int(self.config["n_fft"]) // 2 + 1,
            f_min=float(self.config["f_min"]),
            f_max=float(self.config["f_max"]),
            n_filter=int(self.config["n_filter"]),
            sample_rate=int(self.config["sample_rate"]),
        ).to(self.device)

        # 2. DCT-II orthogonal projection matrix: [n_filter, n_lfcc] -> [60, 60]
        self.dct_mat = F.create_dct(
            n_mfcc=int(self.config["n_lfcc"]),
            n_mels=int(self.config["n_filter"]),
            norm=str(self.config["dct_norm"]),
        ).to(self.device)

        # 3. Symmetric Hamming window (non-periodic, matching np.hamming(400))
        self.window = torch.hamming_window(
            int(self.config["win_length"]),
            periodic=False,
            dtype=torch.float32,
            device=self.device,
        )

        # 4. Associated audio preprocessor configured for 4.0 seconds
        self.preprocessor = preprocessor or AudioPreprocessor(
            target_sr=int(self.config["sample_rate"]),
            duration_sec=float(self.config["duration_sec"]),
        )

        # Pre-calculated dimensions
        self.expected_frames = (
            int(self.config["target_samples"]) - int(self.config["win_length"])
        ) // int(self.config["hop_length"]) + 1  # (64000 - 400) // 160 + 1 = 398
        self.expected_shape = (int(self.config["n_lfcc"]), self.expected_frames)

    def to(self, device: Union[str, torch.device]) -> "HarmonizedLFCCExtractor":
        """Move filterbank and window buffers to *device*."""
        self.device = torch.device(device)
        self.filterbank = self.filterbank.to(self.device)
        self.dct_mat = self.dct_mat.to(self.device)
        self.window = self.window.to(self.device)
        return self

    def extract_from_waveform(self, waveform: torch.Tensor) -> torch.Tensor:
        """
        Extract 60-band LFCC features from a preprocessed 1-D or 2-D waveform.

        Parameters
        ----------
        waveform : torch.Tensor
            Float32 tensor of shape [64000] (single) or [B, 64000] (batch).

        Returns
        -------
        torch.Tensor
            Float32 tensor of shape [60, 398] or [B, 60, 398].
        """
        if not isinstance(waveform, torch.Tensor):
            waveform = torch.tensor(waveform, dtype=torch.float32)

        if waveform.ndim == 1:
            is_single = True
        elif waveform.ndim == 2:
            is_single = False
        else:
            raise ValueError(f"Expected 1-D or 2-D waveform, got shape {waveform.shape}")

        target_len = int(self.config["target_samples"])
        curr_len = waveform.shape[-1]

        # Ensure exact length
        if curr_len < target_len:
            pad_amount = target_len - curr_len
            waveform = torch.nn.functional.pad(waveform, (0, pad_amount))
        elif curr_len > target_len:
            waveform = waveform[..., :target_len]

        waveform = waveform.to(self.device).to(torch.float32)

        win_length = int(self.config["win_length"])
        hop_length = int(self.config["hop_length"])
        n_fft = int(self.config["n_fft"])
        epsilon = float(self.config["epsilon"])

        # 1. Slicing into frames using unfold: shape (..., 398, 400)
        frames = waveform.unfold(dimension=-1, size=win_length, step=hop_length)

        # 2. Symmetric Hamming window multiplication
        windowed = frames * self.window

        # 3. Real FFT with right-side zero-padding to 512 points
        # shape (..., 398, 257)
        spectrum = torch.fft.rfft(windowed, n=n_fft, dim=-1)

        # 4. Power spectrum
        power_spectrum = spectrum.abs().square()

        # 5. Linear filter-bank energy: (..., 398, 257) @ (257, 60) -> (..., 398, 60)
        filterbank_energy = power_spectrum @ self.filterbank

        # 6. Natural logarithm: ln(E + 1e-10)
        log_energy = torch.log(filterbank_energy + epsilon)

        # 7. DCT-II with orthogonal normalization: (..., 398, 60) @ (60, 60) -> (..., 398, 60)
        lfcc = log_energy @ self.dct_mat

        # 8. Transpose to (..., 60, 398) to match the CNN's expected format
        lfcc = lfcc.transpose(-1, -2)

        if is_single and lfcc.ndim == 3 and lfcc.shape[0] == 1:
            lfcc = lfcc.squeeze(0)

        return lfcc

    def extract(
        self,
        source: Union[str, Path, torch.Tensor, np.ndarray],
        normalize: bool = False,
        mean: Optional[Union[torch.Tensor, np.ndarray]] = None,
        std: Optional[Union[torch.Tensor, np.ndarray]] = None,
    ) -> torch.Tensor:
        """
        Extract LFCC features from a file path or in-memory audio array.

        Parameters
        ----------
        source : str, Path, torch.Tensor, or np.ndarray
            Audio path or audio samples.
        normalize : bool
            If True, apply z-score normalization using mean and std.
        mean : torch.Tensor or np.ndarray, optional
            Training mean of shape (60, 1) or broadcastable.
        std : torch.Tensor or np.ndarray, optional
            Training standard deviation of shape (60, 1) or broadcastable.

        Returns
        -------
        torch.Tensor
            Extracted features of shape [60, 398] (or [B, 60, 398]).
        """
        if isinstance(source, (str, Path)):
            # Process via AudioPreprocessor configured for 4 seconds
            waveform = self.preprocessor.process(source).squeeze(0)  # [64000]
        elif isinstance(source, np.ndarray):
            waveform = torch.from_numpy(source)
            if waveform.ndim == 2 and waveform.shape[0] in (1, 2):
                waveform = waveform.mean(dim=0)
        elif isinstance(source, torch.Tensor):
            waveform = source
            if waveform.ndim == 2 and waveform.shape[0] == 1:
                waveform = waveform.squeeze(0)
        else:
            raise TypeError(f"Unsupported source type: {type(source)}")

        features = self.extract_from_waveform(waveform)

        if normalize:
            if mean is None or std is None:
                raise ValueError("Both 'mean' and 'std' must be provided when normalize=True")

            if isinstance(mean, np.ndarray):
                mean = torch.from_numpy(mean).to(features.device)
            if isinstance(std, np.ndarray):
                std = torch.from_numpy(std).to(features.device)

            features = (features - mean) / (std + 1e-8)

        return features

    def __repr__(self) -> str:
        return (
            f"HarmonizedLFCCExtractor("
            f"sample_rate={self.config['sample_rate']}, "
            f"duration_sec={self.config['duration_sec']}, "
            f"n_filter={self.config['n_filter']}, "
            f"n_lfcc={self.config['n_lfcc']}, "
            f"expected_shape={self.expected_shape}, "
            f"device={self.device})"
        )
