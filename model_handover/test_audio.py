
from pathlib import Path
from predict import predict_audio


def main():
    print("=" * 45)
    print("       AUDIO DEEPFAKE DETECTOR")
    print("=" * 45)

    audio_path = input("\nEnter audio file path: ").strip().strip('"')

    audio_path = Path(audio_path)

    if not audio_path.exists():
        print("\nError: Audio file not found.")
        return

    if audio_path.suffix.lower() not in [".wav", ".flac"]:
        print("\nWarning: This file may not be supported.")

    try:
        result = predict_audio(str(audio_path))

        print("\n" + "=" * 45)
        print("             DETECTION RESULT")
        print("=" * 45)

        print(f"File: {result['filename']}")
        print(f"Prediction: {result['prediction']}")
        print(f"Spoof score: {result['spoof_score']:.4f}")
        print(f"Raw score: {result['raw_score']:.4f}")
        print(f"Device: {result['device']}")

        print("=" * 45)

    except Exception as error:
        print(f"\nError during prediction: {error}")


if __name__ == "__main__":
    main()
