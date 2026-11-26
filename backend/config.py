"""
VoiceGuard Backend Configuration
================================
Centralized configuration settings for the local FastAPI AI voice detection service.
Authoritative model: AudioCNN (ITW Speaker-Weighted fine-tuned from ASVspoof 2019 baseline).
"""

import os
from pathlib import Path
from typing import Set
import torch

# Base directory paths
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

# Database configuration (Strictly Local MongoDB)
MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
MONGODB_DATABASE: str = os.getenv("MONGODB_DATABASE", "voiceguard_db")
MONGODB_COLLECTION: str = "detection_history"
MONGODB_TIMEOUT_MS: int = 500  # Fast failover if database is not running

# Authoritative VoiceGuard ITW Speaker-Weighted CNN paths
VOICEGUARD_DIR = PROJECT_ROOT / "voiceguard_integration"
MODEL_DIR = VOICEGUARD_DIR / "models"
MODEL_PATH = MODEL_DIR / "best_audio_cnn_itw_speaker_weighted.pth"
NORMALIZATION_STATS_PATH = MODEL_DIR / "normalization_stats_22k.npz"
THRESHOLD_PATH = MODEL_DIR / "calibrated_threshold_itw_speaker_weighted.npy"
METADATA_PATH = MODEL_DIR / "audio_cnn_itw_speaker_weighted_metadata.json"

# Backwards compatibility path aliases
NEW_MODEL_DIR = MODEL_DIR
NEW_MODEL_PATH = MODEL_PATH
NEW_NORMALIZATION_STATS_PATH = NORMALIZATION_STATS_PATH
NEW_THRESHOLD_PATH = THRESHOLD_PATH
NEW_METADATA_PATH = METADATA_PATH
ACTIVE_MODEL: str = "authoritative_itw"

# Expected cryptographic SHA-256 digests
EXPECTED_CHECKPOINT_SHA256: str = "12c4605dce7cad193c4cb22c8b4543a0e5268a7212fe5fbf35dc20a23c0ba2cf"
EXPECTED_NORMALIZATION_SHA256: str = "39c95865809ac6b4cc72dd2fb4264a866bbecbd070e2356f28f34825acf39182"

# Audio preprocessing specifications (strictly matching training contract)
SAMPLE_RATE: int = 16_000
DURATION_SEC: float = 4.0
TARGET_SAMPLES: int = int(SAMPLE_RATE * DURATION_SEC)  # 64,000 samples

# Feature extraction specifications
N_LFCC: int = 60
N_FRAMES: int = 398
EXPECTED_FEATURE_SHAPE = (N_LFCC, N_FRAMES)  # (60, 398)

# Decision threshold
# Calibrated raw logit threshold from ITW speaker-weighted validation: 0.15903852880001068
# raw_logit >= DEFAULT_THRESHOLD_LOGIT => SPOOF (AI-generated); else BONAFIDE (Human)
DEFAULT_THRESHOLD_LOGIT: float = 0.15903852880001068
DEFAULT_THRESHOLD: float = DEFAULT_THRESHOLD_LOGIT

# Request limits and audio validation
MAX_UPLOAD_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB max upload
MIN_AUDIO_DURATION_SEC: float = 0.1             # Minimum viable audio duration

ALLOWED_EXTENSIONS: Set[str] = {
    ".wav", ".flac", ".mp3", ".ogg", ".m4a", ".aac", ".wma", ".webm"
}

ALLOWED_MIME_TYPES: Set[str] = {
    "audio/wav", "audio/x-wav", "audio/wave",
    "audio/flac", "audio/x-flac",
    "audio/mpeg", "audio/mp3",
    "audio/ogg", "application/ogg",
    "audio/webm", "video/webm",
    "audio/x-m4a", "audio/m4a", "audio/mp4",
    "application/octet-stream"
}

# Device selection: GPU if compatible, otherwise reliable CPU
def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")
