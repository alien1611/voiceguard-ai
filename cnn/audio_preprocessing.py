
import numpy as np
import soundfile as sf


SAMPLE_RATE = 16000
DURATION = 4
TARGET_LENGTH = SAMPLE_RATE * DURATION


def preprocess_audio(audio_path):

    # Read audio
    audio, sample_rate = sf.read(
        audio_path,
        dtype="float32"
    )

    # Check sample rate
    if sample_rate != SAMPLE_RATE:
        raise ValueError(
            f"Expected {SAMPLE_RATE} Hz, got {sample_rate} Hz"
        )

    # Convert stereo audio to mono if necessary
    if audio.ndim == 2:
        audio = np.mean(audio, axis=1)

    # Truncate audio if it is longer than 4 seconds
    if len(audio) > TARGET_LENGTH:
        audio = audio[:TARGET_LENGTH]

    # Add zeros if it is shorter than 4 seconds
    elif len(audio) < TARGET_LENGTH:
        padding = TARGET_LENGTH - len(audio)
        audio = np.pad(audio, (0, padding))

    return audio.astype(np.float32)


if __name__ == "__main__":

    from dataset_loader import load_protocol

    train_data = load_protocol("train")

    # Select one genuine and one spoof recording
    samples = [
        train_data[train_data["label"] == 0].iloc[0],
        train_data[train_data["label"] == 1].iloc[0]
    ]

    for row in samples:

        processed_audio = preprocess_audio(row["audio_path"])

        print("\nAudio:", row["audio_id"])
        print("Label:", row["label"])
        print("Processed shape:", processed_audio.shape)
        print("Data type:", processed_audio.dtype)
