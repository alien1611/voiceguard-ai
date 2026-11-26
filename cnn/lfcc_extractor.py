
import numpy as np

from audio_preprocessing import preprocess_audio
from dataset_loader import load_protocol
from scipy.fft import dct


# LFCC configuration
FRAME_LENGTH = 400
HOP_LENGTH = 160
N_FFT = 512


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

    # Create Hamming window
    window = np.hamming(FRAME_LENGTH).astype(np.float32)

    # Apply window to every frame
    windowed_frames = frames * window

    return windowed_frames


def calculate_fft(windowed_frames):

    # Perform Real FFT on each frame
    spectrum = np.fft.rfft(
        windowed_frames,
        n=N_FFT,
        axis=1
    )

    # Calculate power spectrum
    power_spectrum = np.abs(spectrum) ** 2

    return power_spectrum.astype(np.float32)


def apply_linear_filterbank(power_spectrum):

    NUM_FILTERS = 60
    SAMPLE_RATE = 16000

    # Frequency values for FFT bins
    frequencies = np.linspace(
        0,
        SAMPLE_RATE / 2,
        N_FFT // 2 + 1
    )

    # Equally spaced filter boundaries
    filter_points = np.linspace(
        0,
        SAMPLE_RATE / 2,
        NUM_FILTERS + 2
    )

    filterbank = np.zeros(
        (NUM_FILTERS, len(frequencies)),
        dtype=np.float32
    )

    # Construct triangular filters
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

    # Apply filters to power spectrum
    filterbank_energy = power_spectrum @ filterbank.T

    return filterbank_energy.astype(np.float32)


def apply_log(filterbank_energy):
    epsilon = 1e-10

    log_energy = np.log(
        filterbank_energy + epsilon
    )

    return log_energy.astype(np.float32)


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

    windowed_frames = apply_window(frames)

    power_spectrum = calculate_fft(windowed_frames)

    filterbank_energy = apply_linear_filterbank(
        power_spectrum
    )

    log_energy = apply_log(filterbank_energy)

    lfcc_features = apply_dct(log_energy)

    # Transpose for CNN input
    lfcc_features = lfcc_features.T

    return lfcc_features.astype(np.float32)

if __name__ == "__main__":

    train_data = load_protocol("train")
    sample = train_data.iloc[0]

    audio = preprocess_audio(sample["audio_path"])

    frames = frame_audio(audio)
    windowed_frames = apply_window(frames)
    power_spectrum = calculate_fft(windowed_frames)
    filterbank_energy = apply_linear_filterbank(power_spectrum)
    log_energy = apply_log(filterbank_energy)

    lfcc_features = apply_dct(log_energy)

    features = extract_lfcc(sample["audio_path"])

    print("Audio ID:", sample["audio_id"])
    print("Label:", sample["label"])
    print("Extracted features:", features.shape)
    print("Data type:", features.dtype)

    print("LFCC features:", lfcc_features.shape)
    print("Data type:", lfcc_features.dtype)

    lfcc_features = lfcc_features.T

    print("Final LFCC shape:", lfcc_features.shape)
    print("Data type:", lfcc_features.dtype)

    print("Contains NaN:", np.isnan(lfcc_features).any())
    print("Contains Inf:", np.isinf(lfcc_features).any())

    print("Minimum:", np.min(lfcc_features))
    print("Maximum:", np.max(lfcc_features))


    print("Original audio:", audio.shape)
    print("Framed audio:", frames.shape)
    print("Windowed audio:", windowed_frames.shape)
    print("Power spectrum:", power_spectrum.shape)
    print("Filterbank energy:", filterbank_energy.shape)
    print("Log energy:", log_energy.shape)