# Repository and inference audit

The repository is an existing ASVspoof/LA and In-the-Wild LFCC-CNN training,
analysis, and inference project. The integration package reuses the active
speaker-weighted model path; it does not retrain the model or take a dependency
on the development repository.

## Active model and preprocessing

- Architecture: three convolution blocks (16/32/64 channels), adaptive average
  pooling, one-logit classifier (`cnn_model.py`).
- Model input: mono 16 kHz, 64,000 samples/four seconds.
- LFCC: 60 linear filters, 400-sample frame, 160-sample hop, 512-point FFT,
  expected `(60, 398)`.
- Normalization: channel-wise mean/std in `normalization_stats_22k.npz`.
- Active checkpoint: `best_audio_cnn_itw_speaker_weighted.pth`, loaded with
  matching normalization and threshold artifacts.
- Threshold: `0.15903852880001068` **raw logit** from
  `calibrated_threshold_itw_speaker_weighted.npy`.
- Labels: `0=BONAFIDE`, `1=SPOOF`; higher logit indicates more spoof-like model
  evidence. The sigmoid value is not a probability.
- Metadata records checkpoint/statistics hashes and LFCC configuration. The
  integration loader verifies these before inference.
- Active fine-tuning path: `train_in_the_wild.py --speaker-weighted`, initialized
  from the preserved 22 kHz baseline. Its experiment outputs are distinct from
  `best_audio_cnn_itw.pth` (unweighted fine-tune) and from the older baseline.
  No training was run while preparing this package.

Other checkpoint/artifact families remain in the repository: `audio_cnn.pth`,
`best_audio_cnn.pth`, `best_audio_cnn_22k.pth`, `best_audio_cnn_itw.pth`, and
their associated older thresholds/statistics. They are not fallback options for
the current package. The current model must stay paired with the specific
normalization and raw-logit threshold listed above.

## Cached features and representative shapes

The following existing caches were found and left untouched. Representative
first-batch samples are `(X: 100 x 60 x 398, y: 100)`; labels are `0=BONAFIDE`,
`1=SPOOF`. The class counts below describe that first batch only, not the
complete dataset:

| Directory | Representative first-batch labels (`0`, `1`) |
|---|---:|
| `train_features_22k/` | 9, 91 |
| `train_features_22k_normalized/` | 9, 91 |
| `train_features_balanced_batches/` | 51, 49 |
| `dev_features_batches/` | 50, 50 |
| `dev_features_2k_batches/` | 47, 53 |
| `dev_features_2k_normalized/` | 47, 53 |
| `eval_features_batches/` | 14, 86 |
| `InTheWild/features/` | 65, 35 |

These caches are useful for their matching training/evaluation scripts but are
not runtime integration dependencies.

## Current FoR external evaluation

`scripts/evaluate_external_dataset.py` evaluates only the official FoR
for-2sec testing split with the speaker-weighted checkpoint and existing
preprocessing. The saved `all_predictions.csv` is the source for the separate
misclassification analysis under
`evaluation_results/for_2sec_external/misclassification_analysis/`.
Results: 1,088 samples (544 genuine, 544 spoof), 1,024 correct, 64 incorrect,
no failures; confusion matrix `[[506, 38], [26, 518]]`. The test clips are
approximately 2 seconds and are zero-padded to the fixed 4-second input; they
are not repeated. The threshold was not calibrated on this test set.

## Inference/training script map

| File(s) | Responsibility and relationship |
|---|---|
| `cnn_model.py` | Canonical CNN class used by the training and legacy evaluation scripts. |
| `audio_preprocessing.py` | SoundFile decode, mono conversion, resampling, crop/pad; used by legacy file inference and feature extraction. |
| `lfcc_extractor.py` | LFCC feature extraction from audio/preprocessed inputs; used by feature and evaluation scripts. |
| `dataset_loader.py`, `torch_dataset.py`, `prepare_data.py`, `training_setup.py` | ASVspoof protocol/dataset, feature dataset, and train/dev loader support. |
| `batch_extraction.py`, `dev_extraction.py`, `dev_extraction_2k.py`, `eval_extraction.py`, `extract_features.py` | Separate batch/dev/eval feature extraction paths and variants; they are development caches, not runtime integration dependencies. |
| `normalize_features.py`, `normalize_22k.py`, `normalize_dev.py`, `normalize_dev_22k.py`, `normalize_dev_2k.py` | Training/development feature normalization variants. Their outputs must remain paired with their training pipeline/checkpoint. |
| `train.py`, `train_22k.py` | Baseline training variants; `train_in_the_wild.py` is the In-the-Wild fine-tuning path, with the current speaker-weighted experiment explicitly selected by `--speaker-weighted`. |
| `predict.py`, `predict_audio.py` | Legacy 22 kHz baseline-oriented inference paths; not the active integration checkpoint path. |
| `detector.py`, `record_and_test.py` | Earlier detector/recording path using older checkpoint/statistics assumptions; not used by the new package. |
| `live_detector.py` | Existing microphone/file command-line path for the speaker-weighted model, with raw WAV capture and a sounddevice callback. The new package provides reusable class APIs and optional adapter. |
| `evaluate_model.py`, `evaluate_22k.py`, `evaluate_dev_2k.py`, `evaluate_official_eval.py` | Baseline/dev/official-split evaluation variants; retained for research, not package inference. |
| `calibrate_threshold.py` | Validation-set threshold calibration utility; the package loads the saved threshold and does not recalibrate. |
| `attack_analysis.py`, `score_analysis.py`, `lfcc_attack_analysis.py`, `plot_score_distributions.py`, `analyse_lfcc.py`, `inspect_lfcc_classes.py` | Research/diagnostic analyses and plots; no runtime dependency. |
| `scripts/evaluate_external_dataset.py` | Separate FoR external evaluator; reads the fixed model artifacts and writes per-file scores. |
| `scripts/analyze_for2sec_misclassifications.py` | Reads the saved evaluation CSV only and emits error lists, threshold-distance summaries, descriptive quality summaries, and score plots. |

The similarly named extraction, normalization, training, and prediction scripts
are alternatives for different data/configuration paths, not interchangeable
duplicates. Legacy `predict.py`/`predict_audio.py` and root `detector.py` must
not be copied into an integration deployment because their checkpoint and
threshold assumptions differ.

## Reusable live components and gaps addressed

`audio_preprocessing.py`, `lfcc_extractor.py`, `cnn_model.py`, the active
checkpoint metadata, and the current `live_detector.py` informed the package
implementation. The new `voiceguard` package includes local copies of the
unchanged architecture/LFCC configuration, signature-based decoding, raw PCM
handling, session-safe bounded chunk buffering, source-rate conversion, score
smoothing, risk rules, alert schemas, and prevention/verification interfaces.
The other application can submit decoded chunks without using `sounddevice`.

## Preservation and shareability

The package ships only the four active model artifacts and runtime modules. It
does not contain ASVspoof/FoR data, extracted features, training scripts, or
development prediction files. Root baseline artifacts and dataset caches were
left untouched. Exact integration share list is in the root
`VOICEGUARD_INTEGRATION_HANDOVER.md`.
