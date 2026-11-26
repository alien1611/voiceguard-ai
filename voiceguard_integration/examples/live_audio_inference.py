import argparse
import json
import logging

from voiceguard import MicrophoneRunner, VoiceGuardDetector


def main() -> None:
    parser = argparse.ArgumentParser(description="Run VoiceGuard on microphone audio.")
    parser.add_argument("--device-index", type=int)
    parser.add_argument("--recording", help="Optional new WAV path for raw microphone samples.")
    parser.add_argument("--seconds", type=float, help="Optional bounded run duration.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    detector = VoiceGuardDetector.from_config()
    runner = MicrophoneRunner(detector)
    runner.run(
        session_id="microphone-demo",
        device_index=args.device_index,
        save_recording=args.recording,
        max_runtime_seconds=args.seconds,
        on_prediction=lambda result: print(json.dumps(result.to_dict())),
        on_event=lambda event: print(json.dumps(event.to_dict())),
    )


if __name__ == "__main__":
    main()
