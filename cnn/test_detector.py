
from pathlib import Path
from detector import VoiceSpoofDetector

# Initialise detector (load model once)
detector = VoiceSpoofDetector()

# Select an audio recording
audio_path = str(
    Path(__file__).resolve().parent.parent
    / "datasets"
    / "LA"
    / "ASVspoof2019_LA_dev"
    / "flac"
    / "LA_D_1000265.flac"
)

# Get prediction
result = detector.predict(audio_path)

print("\n----- DETECTION RESULT -----")

for key, value in result.items():
    print(f"{key}: {value}")
