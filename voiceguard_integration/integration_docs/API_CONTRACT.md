# API contract

## Loading and offline prediction

```python
from voiceguard import VoiceGuardDetector

detector = VoiceGuardDetector.from_config(
    model_dir="models",  # optional; package models are the default
    device="auto",       # "auto", "cpu", or "cuda"
)
result = detector.predict_file("sample.wav")
```

`predict_file(path, *, raw_sample_rate=None, raw_channels=None,
raw_encoding=None)` returns `PredictionResult`. Raw metadata is required only for
`.pcm`/`.raw` files. `predict_audio(audio, sample_rate, *, session_id=None)`
accepts decoded NumPy samples and returns the same result. It does not interpret
the caller's identity.

## External streaming

```python
events = detector.start_session("call-001", sample_rate=16000)
result = detector.process_audio_chunk(
    audio_chunk=chunk, sample_rate=16000, session_id="call-001"
)
events = detector.stop_session("call-001")
```

Audio arrays are `(frames,)` mono or `(frames, channels)` interleaved audio.
Integer arrays are scaled to floating-point range; floating-point arrays are
expected to be normalized audio values. Input rate and channel count must remain
constant within a session. Capture applications that change either must
downmix/resample consistently upstream or start a new session.

The default window is 4 seconds and update interval is 1 second. The first
prediction is emitted when a full window is available; later windows overlap by
3 seconds. Chunks can have any positive frame length. Buffer capacity is fixed
per session and does not grow with session duration. Sessions do not share
audio buffers or smoothing state.
`window_seconds` is configurable, but it does not change the trained model
input: source windows shorter than four seconds are zero-padded and longer
windows are cropped to the fixed 64,000 samples.

`process_audio_chunk` returns:

- `AudioChunkResult(status="BUFFERING")` until a window is ready.
- `AudioChunkResult(status="ANALYZED", predictions=(...))` when one or more
  windows became available from the chunk.
- `ProcessingErrorResult` for a chunk/session error. The result includes a
  structured `AUDIO_PROCESSING_ERROR` event; other sessions remain usable.

Call `stop_session(session_id)` to release the session. Starting a duplicate ID
or stopping an unknown ID raises `SessionError`.

## Prediction fields

`PredictionResult.to_dict()` is JSON-serializable. Key fields:

| Field | Meaning |
|---|---|
| `label`, `predicted_label` | Raw decision at the fixed logit threshold; labels are `BONAFIDE=0`, `SPOOF=1`. |
| `raw_logit` | CNN output before sigmoid. |
| `spoof_score` | Sigmoid model score, **not a probability**. |
| `threshold` | Fixed raw-logit threshold loaded from the matching artifact. |
| `smoothed_score`, `moving_average_score` | EMA and moving-average score summaries. |
| `stable_assessment` | Whether the configured minimum number of predictions has been seen. |
| `smoothed_spoof_state` | Hysteresis-filtered stream state; does not replace the per-window raw label. |
| `risk_level`, `risk` | Separate provisional risk mapping and explanation. |
| `audio_quality` | RMS, peak, clipping estimate, sample rate, channel count, duration, and warnings. |
| `inference_time_ms` | Preparation, features, normalization, and model inference for the window. |
| `events` | Transition/quality alerts generated for this update. |
| `feature_shape` | `(60, 398)` for the fixed trained configuration. |

`AlertEvent.to_dict()` includes an event UUID, UTC timestamp, session ID, risk,
raw/smoothed score, raw logit, model threshold, audio-quality status, reason,
and recommended action. `PolicyRecommendation` and
`VerificationRequest` are serializable dataclasses. Identity is never inferred
or marked verified by this module.

## Risk and policy

`RiskLevel` is independent of the raw class label. `RiskConfig` boundaries are
provisional and user-configurable; they are not validated fraud probabilities.
Audio-quality warnings are included in each assessment; a warning prevents a
smoothed-only HIGH score from escalating risk and prevents CRITICAL escalation,
while a high raw score remains visible as HIGH evidence.
`detector.recommend_action(result)` returns reversible policy suggestions only.
Use `IndependentVerificationWorkflow.initiate(...)` to create a request for the
host application to implement on a separately trusted channel.
