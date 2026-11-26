# VoiceGuard integration module

This package provides the existing speaker-weighted LFCC-CNN inference pipeline,
file and audio-chunk interfaces, smoothing, provisional risk assessments,
structured alerts, and reversible prevention recommendations. It is an ML/audio
library, not a web service or user interface.

## Install

From this directory, install the runtime dependencies and package:

```powershell
python -m pip install -r requirements-integration.txt
python -m pip install -e .
```

For optional microphone capture, install `sounddevice` as well:

```powershell
python -m pip install ".[microphone]"
```

The package requires Python 3.10 or newer. CPU inference is selected by default
when CUDA is unavailable. Use `VoiceGuardDetector.from_config(device="cuda")`
to require CUDA, or `"cpu"` to force CPU inference.

## Inference

By default, the package loads the four matching speaker-weighted artifacts from
`models/`. It validates the checkpoint and normalization SHA-256 values and the
raw-logit threshold in the metadata before loading the network.

```python
from voiceguard import VoiceGuardDetector

detector = VoiceGuardDetector.from_config()
result = detector.predict_file("sample.wav")
print(result.label, result.raw_logit, result.spoof_score, result.risk_level)
```

`spoof_score` is the CNN sigmoid score, not a calibrated probability. The fixed
decision threshold is a raw logit of approximately `0.15904`.

## External audio stream

Applications can send decoded mono or interleaved audio arrays without using
VoiceGuard's microphone adapter:

```python
import numpy as np
from voiceguard import VoiceGuardDetector

detector = VoiceGuardDetector.from_config()
detector.start_session("call-001", sample_rate=16000)
result = detector.process_audio_chunk(
    np.zeros(16000, dtype=np.float32), 16000, session_id="call-001"
)
detector.stop_session("call-001")
```

The first prediction is emitted after a complete four-second window; subsequent
windows update every second by default. See `integration_docs/API_CONTRACT.md`
and `examples/external_audio_chunks.py` for buffering and result details.

## Model, audio, and safety limits

- Fixed model contract: mono 16 kHz, four seconds/64,000 samples, 60 LFCC
  filters, feature shape `(60, 398)`.
- Short inputs are zero-padded; long inputs are cropped from the start. Audio
  is never repeated to fill a window.
- Raw microphone PCM is never routed through a compressed-audio decoder.
- Risk boundaries are configurable and provisional. Model scores do not prove
  fraud or caller identity.
- The package does not block calls, terminate sessions, send notifications, or
  take irreversible account/financial actions.
- Live microphone capture depends on host permissions and optional audio
  drivers. See `integration_docs/LIMITATIONS.md`.

## Tests and examples

Run the package tests with:

```powershell
python -m unittest discover -s tests -v
```

Examples are in `examples/`; integration contracts are in
`integration_docs/`. The parent repository's training data and scripts are not
runtime dependencies.
