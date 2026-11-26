# Model artifacts

This folder contains the four matching artifacts used by the package:

- `best_audio_cnn_itw_speaker_weighted.pth` — speaker-weighted CNN checkpoint.
- `normalization_stats_22k.npz` — matching LFCC normalization mean and standard
  deviation.
- `calibrated_threshold_itw_speaker_weighted.npy` — calibrated raw-logit
  threshold (`0.15903852880001068`).
- `audio_cnn_itw_speaker_weighted_metadata.json` — expected configuration and
  SHA-256 hashes for the checkpoint and normalization statistics.

Do not substitute older checkpoints, baseline normalization, or a sigmoid
threshold. `ModelLoader` rejects inconsistent artifacts. No training dataset or
feature cache is required for inference.
