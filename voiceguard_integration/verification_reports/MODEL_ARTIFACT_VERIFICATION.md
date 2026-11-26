# VoiceGuard Model Artifact Verification

**Verification date:** 2026-11-16  
**Selected checkpoint:** `best_audio_cnn_itw_speaker_weighted.pth`

## Bundle files and hashes

All four files exist in `voiceguard_integration/models/` and are byte-identical to the corresponding repository-root files.

| File | SHA-256 | Role |
|---|---|---|
| `best_audio_cnn_itw_speaker_weighted.pth` | `12c4605dce7cad193c4cb22c8b4543a0e5268a7212fe5fbf35dc20a23c0ba2cf` | Selected CNN state dict |
| `normalization_stats_22k.npz` | `39c95865809ac6b4cc72dd2fb4264a866bbecbd070e2356f28f34825acf39182` | LFCC mean/std |
| `calibrated_threshold_itw_speaker_weighted.npy` | `4e57588c0805e49098b94182107c7bd98a08a47c2e4681b3cc8447f5db86b2a3` | One-scalar raw-logit decision threshold |
| `audio_cnn_itw_speaker_weighted_metadata.json` | `d3a58815f5aa1959cf21e3ff4acfa14f193dcacd6fae5c88b8682fb5853af02f` | Artifact references, hashes and model/LFCC metadata |

## Architecture and checkpoint

The package `AudioCNN` has three convolution blocks with channels `1→16→32→64`, adaptive pooling, and a one-logit classifier. The packaged checkpoint loaded strictly with eight matching state-dict tensor names/shapes and 23,361 parameter values:

```text
features.0.weight  (16, 1, 3, 3)    features.0.bias  (16,)
features.3.weight  (32, 16, 3, 3)   features.3.bias  (32,)
features.6.weight  (64, 32, 3, 3)   features.6.bias  (64,)
classifier.weight (1, 64)           classifier.bias (1,)
```

## Metadata, normalization and threshold

Metadata matches the configured checkpoint, normalization filename, threshold filename, and LFCC settings: 16 kHz, 400-sample frame, 160-sample hop, 512-point FFT, 60 filters, feature shape `[60, 398]`. The normalization mean/std shapes are `(1, 60, 1)`; values are finite and all standard deviations are positive (minimum observed std: `0.3245003819465637`).

Threshold value is `0.15903852880001068`, in **raw-logit** units, and matches the metadata scalar and loaded package threshold. The loader checks checkpoint and normalization SHA-256 values and checks the threshold scalar/type. The metadata does not pin the threshold file using a SHA-256 field.

## Runtime evidence

The package test `test_artifacts_match_metadata_and_threshold` passed. A CPU load and synthetic four-second audio-array smoke inference also succeeded, producing feature shape `(60, 398)`. The smoke prediction is not a performance result. No older baseline checkpoint was selected by the packaged configuration or the tested wheel.
