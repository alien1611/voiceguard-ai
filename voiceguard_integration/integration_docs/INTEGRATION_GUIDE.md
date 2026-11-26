# Integration guide

## Install

From `voiceguard_integration/`:

```powershell
python -m pip install -r requirements-integration.txt
python -m pip install -e .
```

For the optional microphone adapter, install `sounddevice` or use
`python -m pip install ".[microphone]"`. The host application may instead
capture audio itself and call `process_audio_chunk`.

## Load and predict

```python
from voiceguard import VoiceGuardDetector

detector = VoiceGuardDetector.from_config()  # loads package models/
result = detector.predict_file("sample.wav")
print(result.label, result.raw_logit, result.spoof_score, result.risk_level)
```

Supply `model_dir`, `device`, or a `VoiceGuardConfig` to customize portable
paths and runtime behavior. Never point the package at an older baseline
checkpoint or its normalization/threshold files.

## Integrate a call/audio stream

Decode audio in the host application, then:

```python
detector.start_session("call-001", sample_rate=16000)
try:
    for pcm_chunk in audio_source:
        result = detector.process_audio_chunk(
            pcm_chunk, 16000, session_id="call-001"
        )
        if result.status == "ANALYZED":
            for prediction in result.predictions:
                # Pass to host risk UI/workflow; scores are not probabilities.
                handle_prediction(prediction.to_dict())
finally:
    for event in detector.stop_session("call-001"):
        handle_event(event.to_dict())
```

Call `start_session` before chunks and always stop in a `finally` block. Use a
unique ID per independent audio stream. The host chooses chunk sizes; no
sounddevice dependency is required. Chunks must have a fixed rate and channel
count within each session.

## Optional microphone use

Run `python examples/live_audio_inference.py`. The `MicrophoneRunner` is an
adapter, not a requirement for integration. It accepts a device index, emits
predictions/events via callbacks, can be stopped with Ctrl+C, and can write raw
captured mono audio to a new float WAV path. It does not save normalized audio
or LFCC features.

## Independent verification

Use the model only as one signal. For sensitive requests, the host may use
`IndependentVerificationWorkflow` to generate trusted-channel guidance.
Detection does not verify a caller's identity. The host application owns
display, confirmation, escalation, and any permitted response.

See `API_CONTRACT.md`, `AUDIO_FORMAT_SPECIFICATION.md`, and the examples for
field types, supported inputs, buffering, and error behavior.
