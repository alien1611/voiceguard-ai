
from pathlib import Path

audio_folder = Path(__file__).resolve().parent.parent / "datasets" / "LA" / "ASVspoof2019_LA_dev" / "flac"

print("Folder exists:", audio_folder.exists())

audio_files = list(audio_folder.glob("*.flac"))

print("Number of audio files:", len(audio_files))
print("\nFirst 10 available files:")

for file in audio_files[:10]:
    print(file.name)
