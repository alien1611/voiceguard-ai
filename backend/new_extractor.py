"""
VoiceGuard – Dedicated LFCC Extractor for New CNN (22k)
======================================================
Exact implementation of the LFCC feature extraction used during
training of best_audio_cnn_22k.pth in model_handover.

Mathematically and numerically identical to model_handover/lfcc_extractor.py,
isolated from training dataset protocol dependencies (pandas).
"""

import numpy as np
from scipy.fft import dct

# LFCC configuration matching model_handover training pipeline
FRAME_LENGTH = 400
HOP_LENGTH = 160
N_FFT = 512
NUM_FILTERS = 60
SAMPLE_RATE = 16000
TARGET_SAMPLES = 64000  # 4 seconds at 16 kHz


def create_linear_filterbank() -> np.ndarray:
    """Constructs 60 triangular linear filterbanks across 0 to Nyquist."""
    frequencies = np.linspace(
        0,
        SAMPLE_RATE / 2,
        N_FFT // 2 + 1
    )

    filter_points = np.linspace(
        0,
        SAMPLE_RATE / 2,
        NUM_FILTERS + 2
    )

    filterbank = np.zeros(
        (NUM_FILTERS, len(frequencies)),
        dtype=np.float32
    )

    for i in range(NUM_FILTERS):
        left = filter_points[i]
        center = filter_points[i + 1]
        right = filter_points[i + 2]

        for j, frequency in enumerate(frequencies):
            if left <= frequency <= center:
                filterbank[i, j] = (frequency - left) / (center - left)
            elif center < frequency <= right:
                filterbank[i, j] = (right - frequency) / (right - center)

    return filterbank


# Precompute filterbank once
_FILTERBANK = create_linear_filterbank()


class NewLFCCExtractor:
    """
    Dedicated LFCC extractor for the newly supplied AudioCNN model.
    Accepts standardized 1D numpy array or torch Tensor of 64,000 samples.
    Returns float32 numpy array of shape (60, 398).
    """

    def __init__(self):
        self.frame_length = FRAME_LENGTH
        self.hop_length = HOP_LENGTH
        self.n_fft = N_FFT
        self.num_filters = NUM_FILTERS
        self.filterbank = _FILTERBANK
        self.window = np.hamming(FRAME_LENGTH).astype(np.float32)

    def extract_from_waveform(self, audio: np.ndarray) -> np.ndarray:
        """
        Extract LFCC features from a 1D audio waveform array.
        Audio must be 1D float32 of length 64,000 (16 kHz, 4s).
        """
        if isinstance(audio, np.ndarray) is False:
            if hasattr(audio, "cpu"):
                audio = audio.cpu().numpy()
            else:
                audio = np.asarray(audio, dtype=np.float32)

        audio = audio.astype(np.float32).flatten()

        # Enforce exact 4s padding/cropping if needed
        if len(audio) > TARGET_SAMPLES:
            audio = audio[:TARGET_SAMPLES]
        elif len(audio) < TARGET_SAMPLES:
            padding = TARGET_SAMPLES - len(audio)
            audio = np.pad(audio, (0, padding))

        # 1. Framing
        frames = []
        for start in range(0, len(audio) - self.frame_length + 1, self.hop_length):
            frame = audio[start : start + self.frame_length]
            frames.append(frame)

        frames = np.array(frames, dtype=np.float32)
        if len(frames) == 0:
            raise ValueError("Audio waveform too short to generate frames.")

        # 2. Windowing
        windowed_frames = frames * self.window

        # 3. FFT & Power Spectrum
        spectrum = np.fft.rfft(windowed_frames, n=self.n_fft, axis=1)
        power_spectrum = (np.abs(spectrum) ** 2).astype(np.float32)

        # 4. Linear Filterbank
        filterbank_energy = (power_spectrum @ self.filterbank.T).astype(np.float32)

        # 5. Natural Logarithm
        log_energy = np.log(filterbank_energy + 1e-10).astype(np.float32)

        # 6. DCT-II Orthogonal
        lfcc_features = dct(log_energy, type=2, axis=1, norm="ortho").astype(np.float32)

        # 7. Transpose to (60, 398) for CNN
        features = lfcc_features.T.astype(np.float32)

        if features.shape != (60, 398):
            raise ValueError(f"Extracted feature shape {features.shape} does not match expected (60, 398)")

        if not np.isfinite(features).all():
            raise ValueError("NaN or Inf detected in extracted LFCC features.")

        return features
