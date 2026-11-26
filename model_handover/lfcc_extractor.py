
import numpy as np
from scipy.fft import dct

from audio_preprocessing import preprocess_audio
from dataset_loader import load_protocol


# LFCC configuration
FRAME_LENGTH = 400
HOP_LENGTH = 160
N_FFT = 512
NUM_FILTERS = 60
SAMPLE_RATE = 16000


def frame_audio(audio):

    frames = []

    for start in range(
        0,
        len(audio) - FRAME_LENGTH + 1,
        HOP_LENGTH
    ):
        frame = audio[start:start + FRAME_LENGTH]
        frames.append(frame)

    return np.array(frames, dtype=np.float32)


def apply_window(frames):

    window = np.hamming(FRAME_LENGTH).astype(np.float32)

    return frames * window


def calculate_fft(windowed_frames):

    spectrum = np.fft.rfft(
        windowed_frames,
        n=N_FFT,
        axis=1
    )

    power_spectrum = np.abs(spectrum) ** 2

    return power_spectrum.astype(np.float32)



def create_linear_filterbank():

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
                filterbank[i, j] = (
                    (frequency - left) / (center - left)
                )

            elif center < frequency <= right:
                filterbank[i, j] = (
                    (right - frequency) / (right - center)
                )

    return filterbank


# Construct the filterbank only once
FILTERBANK = create_linear_filterbank()


def apply_linear_filterbank(power_spectrum):

    filterbank_energy = power_spectrum @ FILTERBANK.T

    return filterbank_energy.astype(np.float32)



def apply_log(filterbank_energy):

    epsilon = 1e-10

    return np.log(
        filterbank_energy + epsilon
    ).astype(np.float32)


def apply_dct(log_energy):

    lfcc_features = dct(
        log_energy,
        type=2,
        axis=1,
        norm="ortho"
    )

    return lfcc_features.astype(np.float32)


def extract_lfcc(audio_path):

    audio = preprocess_audio(audio_path)

    frames = frame_audio(audio)

    if len(frames) == 0:
        raise ValueError(f"Audio is too short: {audio_path}")

    windowed_frames = apply_window(frames)

    power_spectrum = calculate_fft(windowed_frames)

    filterbank_energy = apply_linear_filterbank(
        power_spectrum
    )

    log_energy = apply_log(filterbank_energy)

    lfcc_features = apply_dct(log_energy)

    # Transpose for CNN input
    features = lfcc_features.T.astype(np.float32)

    if features.shape != (60, 398):
        raise ValueError(
            f"Unexpected LFCC shape {features.shape} "
            f"for file: {audio_path}"
        )

    if not np.isfinite(features).all():
        raise ValueError(
            f"NaN or Inf found in LFCC features: {audio_path}"
        )

    return features


if __name__ == "__main__":

    train_data = load_protocol("train")
    sample = train_data.iloc[0]

    audio = preprocess_audio(sample["audio_path"])

    frames = frame_audio(audio)
    windowed_frames = apply_window(frames)
    power_spectrum = calculate_fft(windowed_frames)
    filterbank_energy = apply_linear_filterbank(power_spectrum)
    log_energy = apply_log(filterbank_energy)

    features = extract_lfcc(sample["audio_path"])

    print("Audio ID:", sample["audio_id"])
    print("Label:", sample["label"])

    print("Original audio:", audio.shape)
    print("Framed audio:", frames.shape)
    print("Windowed audio:", windowed_frames.shape)
    print("Power spectrum:", power_spectrum.shape)
    print("Filterbank energy:", filterbank_energy.shape)
    print("Log energy:", log_energy.shape)

    print("Final LFCC shape:", features.shape)
    print("Data type:", features.dtype)

    print("Contains NaN:", np.isnan(features).any())
    print("Contains Inf:", np.isinf(features).any())

    print("Minimum:", np.min(features))
    print("Maximum:", np.max(features))
