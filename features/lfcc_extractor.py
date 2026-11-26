"""
VoiceGuard – LFCC Feature Extractor
=====================================
Implements LFCCExtractor: a reusable class that wraps
``torchaudio.transforms.LFCC`` and ``AudioPreprocessor`` into a single,
CNN-ready feature extraction pipeline.

The module-level ``LFCC_CONFIG`` dictionary is the **single source of truth**
for all LFCC parameters. The CNN teammate MUST import this dict and use it
when defining the first convolutional layer's input dimensions.

Expected output shape:
  - Single sample : ``[1, 40, 297]``  (channel, n_lfcc, time_frames)
  - Batch of B    : ``[B, 1, 40, 297]``
"""

import logging
import math
import sys
from pathlib import Path
from typing import List, Optional, Union

import torch

# ---------------------------------------------------------------------------
# Make the project root importable regardless of the working directory
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.preprocessing.audio_preprocessor import AudioPreprocessor  # noqa: E402

try:
    import torchaudio
except ImportError as exc:
    raise ImportError(
        "torchaudio is required for LFCCExtractor. "
        "Install it with: pip install torchaudio"
    ) from exc

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Centralised LFCC configuration — CNN teammate should import this dict
# ---------------------------------------------------------------------------
LFCC_CONFIG: dict = {
    "sample_rate": 16_000,  # Hz
    "n_filter": 128,         # Number of linear filter-bank filters
    "n_lfcc": 40,            # Number of LFCC coefficients to keep
    "n_fft": 512,            # FFT size (32 ms at 16 kHz)
    "win_length": 400,       # Analysis window (25 ms at 16 kHz)
    "hop_length": 160,       # Frame hop (10 ms at 16 kHz, 75 % overlap)
    "f_min": 0.0,            # Minimum frequency (Hz)
    "f_max": 8_000.0,        # Maximum frequency (Nyquist for 16 kHz)
    "center": False,         # No zero-padding at frame edges (ASVspoof convention)
    "log_lf": False,         # Linear (not log) filter bank per LFCC definition
}


def _compute_time_frames(
    n_samples: int, win_length: int, hop_length: int, center: bool, n_fft: int = 512
) -> int:
    """
    Calculate the number of STFT time frames produced by torchaudio.

    In PyTorch / torchaudio STFT, when ``center=False``, the slice taken from the
    input waveform for each frame must span ``frame_len = max(win_length, n_fft)``
    (512 samples in canonical config), resulting in:
        T = floor((n_samples - frame_len) / hop_length) + 1
        T = floor((48000 - 512) / 160) + 1 = 297

    With ``center=True``:
        T = floor(n_samples / hop_length) + 1

    Parameters
    ----------
    n_samples : int
        Number of audio samples in the fixed-duration window.
    win_length : int
        STFT analysis window length in samples.
    hop_length : int
        Frame hop length in samples.
    center : bool
        Whether torchaudio centres the frames (adds half-window padding).
    n_fft : int
        FFT size (determines slice length when n_fft > win_length).

    Returns
    -------
    int
        Expected number of time frames.
    """
    if center:
        return math.floor(n_samples / hop_length) + 1
    else:
        frame_len = max(win_length, n_fft)
        return math.floor((n_samples - frame_len) / hop_length) + 1


class LFCCExtractor:
    """
    Reusable LFCC feature extractor for the VoiceGuard anti-spoofing pipeline.

    Wraps ``torchaudio.transforms.LFCC`` and ``AudioPreprocessor`` into a
    single, composable object.  All parameters are centralised in
    ``LFCC_CONFIG`` so the CNN teammate can consume the exact same values.

    Parameters
    ----------
    config : dict, optional
        Override specific LFCC parameters.  Unspecified keys fall back to
        ``LFCC_CONFIG`` defaults.  Pass ``None`` (default) to use the
        canonical configuration.

    Examples
    --------
    Single file::

        extractor = LFCCExtractor()
        features = extractor.extract("path/to/audio.wav")
        # features.shape → torch.Size([1, 40, 297])

    Batch::

        batch = extractor.extract_batch(["a.wav", "b.wav"])
        # batch.shape → torch.Size([2, 1, 40, 297])

    Pre-processed waveform::

        waveform = torch.randn(1, 48000)
        features = extractor.extract(waveform)
        # features.shape → torch.Size([1, 40, 297])
    """

    def __init__(self, config: Optional[dict] = None) -> None:
        # Merge caller overrides with canonical defaults
        self.config = {**LFCC_CONFIG, **(config or {})}

        # Build the LFCC transform
        
        self.lfcc_transform = torchaudio.transforms.LFCC(
        sample_rate=self.config["sample_rate"],
        n_filter=self.config["n_filter"],
        f_min=self.config["f_min"],
        f_max=self.config["f_max"],
        n_lfcc=self.config["n_lfcc"],
        speckwargs={
            "n_fft": self.config["n_fft"],
            "win_length": self.config["win_length"],
            "hop_length": self.config["hop_length"],
            "center": self.config["center"],
        },
        log_lf=self.config["log_lf"],
    )


        # Matching audio preprocessor
        self.preprocessor = AudioPreprocessor(
            target_sr=self.config["sample_rate"]
        )

        # Pre-compute the expected time-frame dimension
        n_samples = self.config["sample_rate"] * self.preprocessor.duration_sec
        self.expected_time_frames: int = _compute_time_frames(
            n_samples=int(n_samples),
            win_length=self.config["win_length"],
            hop_length=self.config["hop_length"],
            center=self.config["center"],
            n_fft=self.config["n_fft"],
        )
        logger.debug(
            "LFCCExtractor initialised. Expected output shape: "
            "[1, %d, %d]",
            self.config["n_lfcc"],
            self.expected_time_frames,
        )

    # ------------------------------------------------------------------
    # Core extraction methods
    # ------------------------------------------------------------------

    def extract_from_waveform(self, waveform: torch.Tensor) -> torch.Tensor:
        """
        Extract LFCC features from a pre-processed waveform tensor.

        Parameters
        ----------
        waveform : torch.Tensor
            Float32 tensor of shape ``[1, N]`` as returned by
            ``AudioPreprocessor.process()``.

        Returns
        -------
        torch.Tensor
            Float32 tensor of shape ``[1, n_lfcc, T]``.

        Raises
        ------
        ValueError
            If the resulting feature tensor contains NaN or Inf values.
        """
        features = self.lfcc_transform(waveform)  # → [1, n_lfcc, T]

        if torch.any(torch.isnan(features)):
            raise ValueError(
                "LFCC features contain NaN values. "
                "Check the input waveform for silence or clipping."
            )
        if torch.any(torch.isinf(features)):
            raise ValueError(
                "LFCC features contain Inf values. "
                "Check the input waveform for clipping or extreme values."
            )

        return features

    def extract(
        self, source: Union[str, Path, torch.Tensor]
    ) -> torch.Tensor:
        """
        Extract LFCC features from a file path or a pre-processed waveform.

        Parameters
        ----------
        source : str, Path, or torch.Tensor
            Audio file path **or** a waveform tensor of shape ``[1, N]``.

        Returns
        -------
        torch.Tensor
            Float32 tensor of shape ``[1, 40, T]``.

        Raises
        ------
        FileNotFoundError
            If *source* is a path that does not exist.
        ValueError
            If features contain NaN / Inf.
        """
        if isinstance(source, torch.Tensor):
            waveform = source
        else:
            waveform = self.preprocessor.process(source)

        return self.extract_from_waveform(waveform)

    def extract_batch(
        self, sources: List[Union[str, Path, torch.Tensor]]
    ) -> torch.Tensor:
        """
        Extract LFCC features from a list of sources and stack into a batch.

        Parameters
        ----------
        sources : list of (str, Path, or torch.Tensor)
            Audio file paths or waveform tensors.

        Returns
        -------
        torch.Tensor
            Float32 tensor of shape ``[B, 1, n_lfcc, T]``.
        """
        tensors = [self.extract(src) for src in sources]
        return torch.stack(tensors, dim=0)

    # ------------------------------------------------------------------
    # Dunder helpers
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"LFCCExtractor("
            f"n_lfcc={self.config['n_lfcc']}, "
            f"n_filter={self.config['n_filter']}, "
            f"sample_rate={self.config['sample_rate']}, "
            f"expected_time_frames={self.expected_time_frames})"
        )
