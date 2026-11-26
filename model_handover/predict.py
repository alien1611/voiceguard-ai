
from pathlib import Path

import numpy as np
import torch

from cnn_model import AudioCNN
from lfcc_extractor import extract_lfcc


# =====================================================
# 1. PROJECT CONFIGURATION
# =====================================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "best_audio_cnn_22k.pth"
if not MODEL_PATH.exists():
    MODEL_PATH = BASE_DIR.parent / "voiceguard_integration" / "models" / "best_audio_cnn_itw_speaker_weighted.pth"
STATS_PATH = BASE_DIR / "normalization_stats_22k.npz"
if not STATS_PATH.exists():
    STATS_PATH = BASE_DIR.parent / "voiceguard_integration" / "models" / "normalization_stats_22k.npz"

THRESHOLD = 0.0

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# =====================================================
# 2. LOAD NORMALIZATION STATISTICS
# =====================================================

if not STATS_PATH.exists():
    raise FileNotFoundError(
        f"Normalization statistics not found: {STATS_PATH}"
    )

stats = np.load(STATS_PATH)

MEAN = stats["mean"].astype(np.float32)
STD = stats["std"].astype(np.float32)

if MEAN.shape != (1, 60, 1):
    raise ValueError(f"Unexpected mean shape: {MEAN.shape}")

if STD.shape != (1, 60, 1):
    raise ValueError(f"Unexpected std shape: {STD.shape}")

if not np.all(np.isfinite(MEAN)):
    raise ValueError("Mean contains invalid values.")

if not np.all(np.isfinite(STD)) or np.any(STD <= 0):
    raise ValueError("Standard deviation contains invalid values.")


# =====================================================
# 3. LOAD TRAINED CNN MODEL
# =====================================================

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model checkpoint not found: {MODEL_PATH}"
    )

model = AudioCNN().to(DEVICE)

checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE,
    weights_only=True
)

model.load_state_dict(checkpoint)
model.eval()

print("Model loaded successfully.")
print("Device:", DEVICE)


# =====================================================
# 4. AUDIO PREDICTION FUNCTION
# =====================================================

def predict_audio(audio_path):

    audio_path = Path(audio_path)

    if not audio_path.exists():
        raise FileNotFoundError(
            f"Audio file not found: {audio_path}"
        )

    # ---------------------------------------------
    # STEP 1: Extract LFCC features
    # ---------------------------------------------

    features = extract_lfcc(audio_path)

    features = np.asarray(features, dtype=np.float32)

    # Remove an existing batch dimension if present
    if features.ndim == 3 and features.shape[0] == 1:
        features = features.squeeze(0)

    # Validate feature dimensions
    if features.shape != (60, 398):
        raise ValueError(
            f"Expected LFCC shape (60, 398), "
            f"but received {features.shape}"
        )

    if not np.all(np.isfinite(features)):
        raise ValueError("LFCC features contain NaN or Inf.")

    print("LFCC shape:", features.shape)

    # ---------------------------------------------
    # STEP 2: Normalize features
    # ---------------------------------------------

    features = (
        features - MEAN.squeeze(0)
    ) / (STD.squeeze(0) + 1e-8)

    # ---------------------------------------------
    # STEP 3: Convert into PyTorch tensor
    # ---------------------------------------------

    features = torch.from_numpy(
        features.astype(np.float32)
    )

    # (60, 398) -> (1, 1, 60, 398)
    features = features.unsqueeze(0).unsqueeze(0)

    if features.ndim != 4:
        raise ValueError(
            f"CNN requires 4D input, got {features.shape}"
        )

    features = features.to(DEVICE)

    # ---------------------------------------------
    # STEP 4: CNN inference
    # ---------------------------------------------

    with torch.inference_mode():

        logits = model(features)

        raw_score = logits.item()

        spoof_score = torch.sigmoid(logits).item()

    # ---------------------------------------------
    # STEP 5: Classification
    # ---------------------------------------------

    if raw_score >= THRESHOLD:
        prediction = "SPOOF"
    else:
        prediction = "BONAFIDE"

    # ---------------------------------------------
    # STEP 6: Return prediction results
    # ---------------------------------------------

    return {
        "file": audio_path.name,
        "prediction": prediction,
        "raw_score": round(raw_score, 4),
        "spoof_score": round(spoof_score, 4),
        "device": str(DEVICE)
    }


# =====================================================
# 5. RUN FROM TERMINAL
# =====================================================

if __name__ == "__main__":

    print("\nAUDIO DEEPFAKE DETECTOR")
    print("----------------------")

    audio_file = input(
        "Enter audio file path: "
    ).strip().strip('"')

    try:

        result = predict_audio(audio_file)

        print("\n--- DETECTION RESULT ---")

        for key, value in result.items():
            print(f"{key}: {value}")

    except Exception as error:

        print("\nPrediction failed:")
        print(error)
