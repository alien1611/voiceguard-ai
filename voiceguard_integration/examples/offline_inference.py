import argparse
import json

from voiceguard import VoiceGuardDetector


def main() -> None:
    parser = argparse.ArgumentParser(description="Run VoiceGuard on an audio file.")
    parser.add_argument("audio_file")
    parser.add_argument("--model-dir", default=None)
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    args = parser.parse_args()

    detector = VoiceGuardDetector.from_config(
        model_dir=args.model_dir,
        device=args.device,
    )
    result = detector.predict_file(args.audio_file)
    print(json.dumps(result.to_dict(), indent=2))


if __name__ == "__main__":
    main()
