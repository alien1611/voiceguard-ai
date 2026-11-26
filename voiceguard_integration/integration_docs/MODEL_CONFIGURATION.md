# Model configuration

The loader uses the current speaker-weighted checkpoint only:

| Artifact | SHA-256 / value |
|---|---|
| `best_audio_cnn_itw_speaker_weighted.pth` | `12c4605dce7cad193c4cb22c8b4543a0e5268a7212fe5fbf35dc20a23c0ba2cf` |
| `normalization_stats_22k.npz` | `39c95865809ac6b4cc72dd2fb4264a866bbecbd070e2356f28f34825acf39182` |
| `calibrated_threshold_itw_speaker_weighted.npy` | `0.15903852880001068` raw logit |
| `audio_cnn_itw_speaker_weighted_metadata.json` | expected filenames, hashes, threshold type, and LFCC parameters |

The CNN architecture is the unchanged three-convolution-block `AudioCNN`.
Input preprocessing is mono, 16 kHz, 4 seconds/64,000 samples. LFCC uses a
400-sample frame, 160-sample hop, 512-point FFT, and 60 filters, resulting in
`(60, 398)`. Label `0` is BONAFIDE and label `1` is SPOOF; larger raw logits
indicate more spoof-like model evidence.

The sigmoid output is an uncalibrated model score and is not a probability.
The loader verifies checkpoint and normalization hashes, threshold metadata,
threshold file value, and LFCC configuration. It rejects missing or mismatched
files instead of falling back to baseline artifacts.

The threshold was selected on validation scores only, not the FoR external test
set. Do not tune it on the FoR test set or silently change its interpretation.
