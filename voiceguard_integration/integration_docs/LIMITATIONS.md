# Limitations

- This is an experimental audio classifier, not an identity-verification or
  fraud-determination system. A genuine-sounding recording does not establish
  who is speaking.
- `spoof_score` is a sigmoid model output and is not a calibrated probability.
  Risk boundaries are provisional rules; they have not been independently
  calibrated or validated as operational risk levels.
- Current reported external evaluation is the official FoR for-2sec testing
  split: 1,088 samples, 544 per class, 1,024 correct, 64 incorrect, zero
  processing failures. Accuracy and balanced accuracy were 94.12%; raw-logit
  ROC-AUC was 0.9790; EER was 0.0680. These describe that dataset/split only.
- FoR samples are approximately two seconds. The unchanged preprocessing
  zero-pads to four seconds; it does not repeat the clip. This differs from a
  full four-second live window.
- No independent modern TTS, voice-conversion, voice-cloning, or speaker-playback
  dataset was available in this task. `examples/evaluate_manifest.py` provides
  an evaluation path for later authorized samples; no synthetic benchmark
  results are claimed.
- Microphone stream setup and chunk processing are implemented, but a physical
  microphone session was not validated as part of this package test run.
  Device-specific timing, driver permissions, acoustics, and clipping remain
  deployment concerns.
- Audio-quality indicators are simple heuristics. The available FoR CSV shows
  consistent 2-second/16 kHz/mono inputs and quality summaries, but does not
  support causal claims for individual errors.
- MP3 support depends on the installed SoundFile/libsndfile build. Raw PCM
  requires explicit sample rate, channel count, and encoding.
- Smoothing/persistence can add detection delay. The raw per-window logit and
  score remain present so an integrating application can apply its own
  independently reviewed policy.
- This package does not block or terminate calls, send notifications, identify
  speakers, or execute account/financial actions.
