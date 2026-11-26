# VoiceGuard Final Readiness Report

**Project:** AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks  
**SIH ID:** SIH26104  
**Verification date:** 2026-11-16  
**Decision:** **CONDITIONALLY READY**

## Scope and evidence

The existing `voiceguard_integration/` package was tested, its model artifacts were compared with the repository-root copies, and the package was built and installed into an isolated temporary target. The test output and runtime command results were captured in the verification session; no separate persistent test-log files were created. Detailed wheel-builder/pip logs were not retained, so this report records the wheel filename and the successful isolated import/inference result rather than claiming a saved build log.

## Test results

Command, run from `voiceguard_integration/`:

```text
python -m unittest discover -s tests -v
```

Result: **9 tests passed** in 0.362 seconds.

- `test_artifacts_match_metadata_and_threshold`
- `test_chunk_error_does_not_break_other_sessions`
- `test_file_chunk_parity_session_isolation_and_lifecycle`
- `test_microphone_adapter_flushes_and_saves_raw_wav`
- `test_prediction_output_is_serializable`
- `test_raw_pcm_and_lfcc_dimensions`
- `test_risk_policy_alert_and_verification`
- `test_smoothing_persistence_and_hysteresis`
- `test_wav_resampling_padding_and_invalid_file`

The chunk-error test intentionally logged a session-rate `SessionError`; the test passed and verified isolation from other sessions.

## Wheel and independent runtime result

- Built `voiceguard_integration-0.1.0-py3-none-any.whl` from a temporary copy of the package.
- Installed the wheel into a temporary target using `pip install --no-deps --no-index --target ...`.
- Ran outside the source tree. The installed package found all four artifacts through the `voiceguard_models` package resources, loaded the model on CPU, and completed inference with feature shape `(60, 398)` and threshold `0.15903852880001068`.
- Temporary build/install files were removed. The first cleanup attempt encountered a Windows read-only directory attribute; the exact temporary tree was inspected, its read-only attributes cleared, and it was removed.

This verifies package build inclusion and loading against the dependencies already installed in the environment. It was not a fresh environment dependency-resolution test.

## Model, artifact, and inference verification

The selected architecture is the three-block `AudioCNN` with convolution channels `1→16→32→64`, adaptive pooling, and a one-logit classifier. The checkpoint loaded strictly with eight matching state-dict tensors, totaling 23,361 parameter values:

```text
features.0.weight  (16, 1, 3, 3)    features.0.bias  (16,)
features.3.weight  (32, 16, 3, 3)   features.3.bias  (32,)
features.6.weight  (64, 32, 3, 3)   features.6.bias  (64,)
classifier.weight (1, 64)           classifier.bias (1,)
```

The four packaged artifacts exist and are byte-identical to their root counterparts:

| Artifact | SHA-256 | Verification |
|---|---|---|
| `best_audio_cnn_itw_speaker_weighted.pth` | `12c4605dce7cad193c4cb22c8b4543a0e5268a7212fe5fbf35dc20a23c0ba2cf` | Matches metadata and root copy |
| `normalization_stats_22k.npz` | `39c95865809ac6b4cc72dd2fb4264a866bbecbd070e2356f28f34825acf39182` | Matches metadata and root copy |
| `calibrated_threshold_itw_speaker_weighted.npy` | `4e57588c0805e49098b94182107c7bd98a08a47c2e4681b3cc8447f5db86b2a3` | Scalar matches metadata and root copy |
| `audio_cnn_itw_speaker_weighted_metadata.json` | `d3a58815f5aa1959cf21e3ff4acfa14f193dcacd6fae5c88b8682fb5853af02f` | Identical to root copy |

Metadata identifies the selected checkpoint, normalization file, threshold file, raw-logit threshold, and LFCC configuration. The loader verifies checkpoint/statistics hashes, artifact names, LFCC configuration, threshold type/value, and normalization validity. Metadata does not contain a threshold-file hash; its scalar value is checked against the threshold metadata.

Normalization mean/std shapes are both `(1, 60, 1)`. Values are finite and standard deviations positive; the observed minimum standard deviation was `0.3245003819465637`.

A CPU smoke inference used a generated four-second, 220 Hz sine wave (not speech): result `SPOOF`, raw logit `26.552345275878906`, sigmoid score approximately `0.999999999997`, feature shape `(60, 398)`. This confirms execution only; it is not an accuracy result or evidence about real speech.

## Dependencies and runtime contents

The package declares `numpy`, `scipy`, `soundfile`, and `torch`. Optional microphone capture uses `sounddevice`. The verification environment had NumPy 2.4.6, SciPy 1.18.1, SoundFile 0.14.0, PyTorch 2.15.0+cu134, and `sounddevice` installed.

Runtime package code is under `voiceguard_integration/voiceguard/`: `__init__.py`, `config.py`, `exceptions.py`, `schemas.py`, `model_architecture.py`, `model_loader.py`, `audio_processor.py`, `feature_extractor.py`, `detector.py`, `live_engine.py`, `prediction_smoother.py`, `risk_engine.py`, `alert_manager.py`, `prevention_policy.py`, and `verification.py`. The `voiceguard_models` resource package and the four model artifacts are required as packaged. No root-repository training or inference modules are required by the installed wheel.

## Microphone status and remaining conditions

**Physical microphone testing: NOT TESTED.** The microphone-adapter unit test passed, and `sounddevice` was installed, but no real input device was opened or recorded from during this verification.

Before deployment, the receiving team must validate microphone permissions/device selection, actual capture behavior, latency/dropouts, and host-application integration. Model scores are not calibrated probabilities; risk rules are provisional. The package can emit alerts, reversible recommendations, and independent-verification requests, but does not itself verify identity, block/terminate calls, or perform external notifications/actions.

## Final decision

**CONDITIONALLY READY** for handover as a self-contained offline/chunk-inference package with the selected model artifacts. Readiness is conditional on real-device microphone validation and the receiving application’s integration and response-policy review.
