# Testing guide

Run the integration package tests from this directory:

```powershell
python -m unittest discover -s tests -v
```

The tests load the packaged speaker-weighted checkpoint on CPU and verify its
metadata hashes/threshold, WAV decoding and resampling, zero-padding, invalid
audio rejection, raw PCM validation, LFCC dimensions, JSON prediction fields,
smoothing persistence/hysteresis, risk/policy/alerts, file-versus-chunk score
parity, independent session buffers, and lifecycle cleanup.

Additional manual checks:

```powershell
python examples/offline_inference.py path\to\authorized.wav
python examples/external_audio_chunks.py
python examples/live_audio_inference.py --seconds 10
```

The external chunk example intentionally uses a synthetic zero-valued array to
exercise the interface; it is not an external benchmark or evidence of
classification quality. The manifest evaluator accepts authorized independent
samples without retraining or threshold changes:

```text
path,label,source_type
samples/genuine.wav,0,genuine
samples/tts.wav,1,text_to_speech
samples/converted.wav,1,voice_conversion
samples/clone.wav,1,voice_cloned
samples/playback.wav,1,recorded_playback
```

```powershell
python examples/evaluate_manifest.py manifest.csv --output predictions.csv
```

Keep evaluation data separate from training and calibration. This package test
does not capture a physical microphone. Verify device permissions, real-time
latency, dropouts, and callback behavior in the integrating environment before
deployment.
