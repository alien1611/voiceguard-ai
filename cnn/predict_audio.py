
import torch
import numpy as np
from pathlib import Path

from cnn_model import AudioCNN
from lfcc_extractor import extract_lfcc
from dataset_loader import load_protocol


# 1. Select the audio file
AUDIO_PATH = Path(__file__).resolve().parent.parent / "datasets" / "LA" / "ASVspoof2019_LA_dev" / "flac" / "LA_D_9977363.flac"


# 2. Load training normalization statistics
data = np.load("normalized_train.npz")
mean = data["mean"]
std = data["std"]


# 3. Select GPU if available
device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("Using device:", device)


# 4. Load the trained CNN
model = AudioCNN().to(device)

model.load_state_dict(
    torch.load("best_audio_cnn.pth", map_location=device)
)

model.eval()


# 5. Extract LFCC features
if not AUDIO_PATH.exists():
    raise FileNotFoundError(f"Audio file not found: {AUDIO_PATH}")

features = extract_lfcc(AUDIO_PATH)


# 6. Apply training normalization
features = features - mean.reshape(60, 1)
features = features / (std.reshape(60, 1) + 1e-8)

features = features.astype(np.float32)


# 7. Convert features into a PyTorch tensor
input_tensor = torch.tensor(features).unsqueeze(0).unsqueeze(0)
input_tensor = input_tensor.to(device)


# 8. Get CNN prediction
with torch.no_grad():
    logit = model(input_tensor)
    score = torch.sigmoid(logit).item()


predicted_label = 1 if score >= 0.5 else 0

predicted_name = (
    "BONAFIDE" if predicted_label == 0 else "SPOOF"
)


# 9. Display prediction
print("\n----- CNN PREDICTION -----")
print("Audio file:", AUDIO_PATH.name)
print(f"Spoof score: {score:.4f}")
print("CNN prediction:", predicted_name)


# 10. Load actual label from ASVspoof dev protocol
dev_data = load_protocol("dev")

matching_row = dev_data[
    dev_data["audio_id"] == AUDIO_PATH.stem
]


# 11. Compare prediction with actual label
print("\n----- GROUND TRUTH COMPARISON -----")

if matching_row.empty:

    print("Audio file not found in dev protocol.")

else:

    actual_label = int(matching_row.iloc[0]["label"])

    actual_name = (
        "BONAFIDE" if actual_label == 0 else "SPOOF"
    )

    print("Actual label:", actual_name)
    print("CNN prediction:", predicted_name)

    if actual_label == predicted_label:
        print("Result: CORRECT")
    else:
        print("Result: INCORRECT")
