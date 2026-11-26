import argparse
import json

from voiceguard import IndependentVerificationWorkflow, VoiceGuardDetector


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio_file")
    parser.add_argument("--session-id", default="offline-review")
    args = parser.parse_args()

    detector = VoiceGuardDetector.from_config()
    result = detector.predict_file(args.audio_file)
    print(json.dumps(result.to_dict(), indent=2))
    print(json.dumps(detector.recommend_action(result).to_dict(), indent=2))

    if result.risk_level in {"HIGH", "CRITICAL"}:
        request = IndependentVerificationWorkflow().initiate(
            args.session_id,
            reason="A sensitive request needs independent confirmation.",
        )
        print(json.dumps(request.to_dict(), indent=2))


if __name__ == "__main__":
    main()
