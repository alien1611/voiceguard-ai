import json

import numpy as np

from voiceguard import AudioChunkResult, ProcessingErrorResult, VoiceGuardDetector


def main() -> None:
    detector = VoiceGuardDetector.from_config()
    session_id = "external-call-001"
    detector.start_session(session_id, sample_rate=16000)
    try:
        # Replace this synthetic demonstration with decoded mono PCM from the host.
        demonstration = np.zeros(5 * 16000, dtype=np.float32)
        for offset in range(0, len(demonstration), 8000):
            chunk = demonstration[offset : offset + 8000]
            result = detector.process_audio_chunk(
                chunk, 16000, session_id=session_id
            )
            if isinstance(result, ProcessingErrorResult):
                raise RuntimeError(result.message)
            if isinstance(result, AudioChunkResult):
                for prediction in result.predictions:
                    print(json.dumps(prediction.to_dict()))
    finally:
        for event in detector.stop_session(session_id):
            print(json.dumps(event.to_dict()))


if __name__ == "__main__":
    main()
