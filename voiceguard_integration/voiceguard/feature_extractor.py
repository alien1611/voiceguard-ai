import numpy as np
from scipy.fft import dct

from .exceptions import AudioValidationError


FRAME_LENGTH = 400
HOP_LENGTH = 160
N_FFT = 512
NUM_FILTERS = 60
SAMPLE_RATE = 16000
FEATURE_SHAPE = (NUM_FILTERS, 398)


def _create_linear_filterbank() -> np.ndarray:
    frequencies = np.linspace(0, SAMPLE_RATE / 2, N_FFT // 2 + 1)
    filter_points = np.linspace(0, SAMPLE_RATE / 2, NUM_FILTERS + 2)
    filterbank = np.zeros((NUM_FILTERS, len(frequencies)), dtype=np.float32)
    for index in range(NUM_FILTERS):
        left, center, right = filter_points[index : index + 3]
        for bin_index, frequency in enumerate(frequencies):
            if left <= frequency <= center:
                filterbank[index, bin_index] = (frequency - left) / (center - left)
            elif center < frequency <= right:
                filterbank[index, bin_index] = (right - frequency) / (right - center)
    return filterbank


FILTERBANK = _create_linear_filterbank()


def extract_lfcc_from_processed_audio(audio: np.ndarray) -> np.ndarray:
    """Extract exactly the existing 60-filter LFCC representation."""
    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim != 1 or len(audio) != SAMPLE_RATE * 4:
        raise AudioValidationError(
            f"Expected mono 4-second/64,000-sample 16 kHz audio, got {audio.shape}."
        )
    frames = np.asarray(
        [
            audio[start : start + FRAME_LENGTH]
            for start in range(0, len(audio) - FRAME_LENGTH + 1, HOP_LENGTH)
        ],
        dtype=np.float32,
    )
    if not len(frames):
        raise AudioValidationError("Audio is too short to produce LFCC frames.")
    windowed = frames * np.hamming(FRAME_LENGTH).astype(np.float32)
    spectrum = np.fft.rfft(windowed, n=N_FFT, axis=1)
    power_spectrum = (np.abs(spectrum) ** 2).astype(np.float32)
    filterbank_energy = (power_spectrum @ FILTERBANK.T).astype(np.float32)
    log_energy = np.log(filterbank_energy + 1e-10).astype(np.float32)
    features = dct(log_energy, type=2, axis=1, norm="ortho").T.astype(np.float32)
    if features.shape != FEATURE_SHAPE:
        raise AudioValidationError(
            f"LFCC shape {features.shape} does not match expected {FEATURE_SHAPE}."
        )
    if not np.isfinite(features).all():
        raise AudioValidationError("LFCC features contain NaN or Inf.")
    return features
