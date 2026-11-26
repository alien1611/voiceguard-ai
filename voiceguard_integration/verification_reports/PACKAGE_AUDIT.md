# VoiceGuard Integration Package Audit

**Audit date:** 2026-11-16

## Result

The package is self-contained for model loading, file/audio inference, chunk processing, smoothing, provisional risk assessment, alerts, and recommendation/verification request generation. An isolated wheel build/install and outside-source inference succeeded. No root training scripts or datasets are required at runtime.

## Runtime contents

The runtime package includes:

- `voiceguard/__init__.py` — public exports.
- `voiceguard/config.py`, `exceptions.py`, `schemas.py` — configuration, errors and result contracts.
- `voiceguard/model_architecture.py`, `model_loader.py` — CNN and artifact validation/loading.
- `voiceguard/audio_processor.py`, `feature_extractor.py` — decode/raw PCM, mono conversion, resampling, fixed-window preparation and LFCC.
- `voiceguard/detector.py`, `live_engine.py` — file/array/chunk inference, per-session buffering and optional microphone adapter.
- `voiceguard/prediction_smoother.py`, `risk_engine.py`, `alert_manager.py` — stream assessment and structured events.
- `voiceguard/prevention_policy.py`, `verification.py` — reversible recommendations and independent-verification request contract.
- `voiceguard_models/__init__.py` and the four files under `models/` — packaged checkpoint, normalization, threshold and metadata.

## Processing and prediction contract

File or array audio is decoded/validated, converted to mono, resampled to 16 kHz, and padded/cropped to 64,000 samples. The LFCC extractor produces `(60, 398)`. The matched normalization statistics are applied before the CNN. The model emits a raw logit; classification uses the metadata-matched raw-logit threshold `0.15903852880001068`. The exposed sigmoid score is not a calibrated probability.

Streaming sessions maintain bounded independent buffers and smoothing state. The first default prediction follows a complete four-second window; subsequent windows update every second. The microphone adapter is optional; a host can supply decoded chunks without `sounddevice`.

## Package and dependency verification

`pyproject.toml` declares NumPy, SciPy, SoundFile and PyTorch. `sounddevice` is the optional microphone extra. A wheel built from a temporary package copy included the model resources; the installed wheel loaded the model and completed CPU inference outside the repository source tree.

The package test command was `python -m unittest discover -s tests -v`: **9 tests passed**. Tests covered artifact/threshold checks, file and chunk parity, audio resampling/padding, raw PCM/LFCC dimensions, output serialization, session isolation, smoothing, risk/policy/alerts/verification, and the microphone adapter.

## Audit limitations

Physical microphone capture was **NOT TESTED**. The test suite’s adapter test is not a substitute for hardware/device/permission validation. A synthetic sine-wave inference was used only as a runtime smoke test; it provides no classification-quality evidence. Risk thresholds are provisional. The package does not independently verify caller identity or enforce call blocking or other external actions.
