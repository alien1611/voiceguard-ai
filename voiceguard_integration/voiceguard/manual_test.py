"""Interactively test the packaged VoiceGuard model on local audio files."""

from pathlib import Path

from .exceptions import (
    AudioDecodeError,
    AudioFormatError,
    AudioValidationError,
    ModelLoadError,
    VoiceGuardError,
)
from . import VoiceGuardDetector


def _read_path() -> Path | None:
    while True:
        entered = input("Enter an audio file path (or q to quit): ").strip()
        if entered.casefold() in {"q", "quit", "exit"}:
            return None
        if len(entered) >= 2 and entered[0] == entered[-1] and entered[0] in {"'", '"'}:
            entered = entered[1:-1].strip()
        if entered:
            return Path(entered).expanduser()
        print("Please enter a path to an audio file.")


def _test_file(detector: VoiceGuardDetector, path: Path) -> None:
    try:
        if not path.is_file():
            print(f"Audio file error: file not found: {path}")
            return
        result = detector.predict_file(path)
    except AudioFormatError as error:
        print(f"Unsupported or unrecognized audio format: {error}")
    except AudioDecodeError as error:
        print(f"Audio decoding failed: {error}")
    except AudioValidationError as error:
        print(f"Audio preprocessing failed: {error}")
    except ModelLoadError as error:
        print(f"Model loading failed: {error}")
    except VoiceGuardError as error:
        print(f"VoiceGuard inference failed ({type(error).__name__}): {error}")
    except (OSError, ValueError) as error:
        print(f"Could not process this audio file ({type(error).__name__}): {error}")
    except Exception as error:
        print(f"Unexpected inference error ({type(error).__name__}): {error}")
    else:
        duration = result.duration_seconds
        sample_rate = result.sample_rate
        print("\nVoiceGuard manual test")
        print("----------------------")
        print(f"Audio filename: {path.name}")
        print(
            "Audio duration: "
            f"{duration:.3f} seconds" if duration is not None
            else "Audio duration: unavailable"
        )
        print(
            f"Source sample rate: {sample_rate} Hz" if sample_rate is not None
            else "Source sample rate: unavailable"
        )
        print(f"Model loading status: loaded ({detector.config.checkpoint_name})")
        print(f"Prediction: {result.label}")
        print(f"Raw model logit: {result.raw_logit:.6f}")
        print(f"Sigmoid spoof score: {result.spoof_score:.6f}")
        print(f"Calibrated threshold: {result.threshold:.8f} (raw logit)")
        print(f"Inference execution time: {result.inference_time_ms:.2f} ms")
        print("The sigmoid score is a model score, not a calibrated probability.")
        if result.audio_quality.warnings:
            print("Audio quality warnings: " + "; ".join(result.audio_quality.warnings))
        print(
            "This result is a model prediction; a successful inference does not "
            "establish detection accuracy."
        )


def main() -> None:
    print("Loading the existing VoiceGuard model and matching artifacts...")
    try:
        detector = VoiceGuardDetector.from_config()
    except ModelLoadError as error:
        print(f"Model loading failed: {error}")
        return
    except VoiceGuardError as error:
        print(f"VoiceGuard setup failed ({type(error).__name__}): {error}")
        return
    except (OSError, ValueError) as error:
        print(f"Could not initialize VoiceGuard ({type(error).__name__}): {error}")
        return
    except Exception as error:
        print(f"Unexpected model loading error ({type(error).__name__}): {error}")
        return

    print(f"Model loading status: loaded ({detector.config.checkpoint_name})")
    print("Supported formats depend on the installed SoundFile/libsndfile decoders.")

    while True:
        try:
            path = _read_path()
        except (EOFError, KeyboardInterrupt):
            print("\nManual test stopped.")
            return
        if path is None:
            return

        _test_file(detector, path)
        try:
            again = input("Do you want to test another audio file? (y/n) ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nManual test stopped.")
            return
        if again.casefold() not in {"y", "yes"}:
            return


if __name__ == "__main__":
    main()
