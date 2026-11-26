
import soundfile as sf

from dataset_loader import load_protocol


# Load training metadata
train_data = load_protocol("train")

# Select one genuine and one spoof recording
bonafide = train_data[train_data["label"] == 0].iloc[0]
spoof = train_data[train_data["label"] == 1].iloc[0]

samples = [
    ("Bonafide", bonafide),
    ("Spoof", spoof)
]

for name, row in samples:

    audio_path = row["audio_path"]

    # Read audio file
    audio, sample_rate = sf.read(
        audio_path,
        dtype="float32"
    )

    duration = len(audio) / sample_rate

    print(f"\n{name} Audio")
    print("-" * 35)
    print("Filename:", audio_path.name)
    print("Label:", row["label"])
    print("Sample rate:", sample_rate, "Hz")
    print("Audio shape:", audio.shape)
    print("Duration:", round(duration, 2), "seconds")
    print("Data type:", audio.dtype)
