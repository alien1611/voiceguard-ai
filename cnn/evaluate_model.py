
import torch
import numpy as np

from sklearn.metrics import (
    confusion_matrix,
    classification_report
)

from cnn_model import AudioCNN
from prepare_data import dev_loader


# --------------------------------------------------
# 1. Select device
# --------------------------------------------------

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("Using device:", device)


# --------------------------------------------------
# 2. Load the best trained model
# --------------------------------------------------

model = AudioCNN().to(device)

model.load_state_dict(
    torch.load(
        "best_audio_cnn.pth",
        map_location=device
    )
)

model.eval()


# --------------------------------------------------
# 3. Evaluate on validation data
# --------------------------------------------------

actual_labels = []
predicted_labels = []
all_logits = []

with torch.no_grad():

    for features, labels in dev_loader:

        features = features.to(device)

        outputs = model(features).squeeze(1)

        # Convert logits into binary predictions
        predictions = (outputs >= 0).int()

        actual_labels.extend(
            labels.cpu().numpy().astype(int)
        )

        predicted_labels.extend(
            predictions.cpu().numpy()
        )

        all_logits.extend(
            outputs.cpu().numpy()
        )


# Convert lists into NumPy arrays
actual_labels = np.array(actual_labels)
predicted_labels = np.array(predicted_labels)
all_logits = np.array(all_logits)


# --------------------------------------------------
# 4. Diagnostic information
# --------------------------------------------------

print("\n--- Diagnostic Results ---")

print("Logit minimum:", all_logits.min())
print("Logit maximum:", all_logits.max())
print("Logit mean:", all_logits.mean())

print(
    "Predicted bonafide:",
    np.sum(predicted_labels == 0)
)

print(
    "Predicted spoof:",
    np.sum(predicted_labels == 1)
)

accuracy = np.mean(
    actual_labels == predicted_labels
) * 100

print(f"Actual validation accuracy: {accuracy:.2f}%")


# --------------------------------------------------
# 5. Calculate confusion matrix
# --------------------------------------------------

cm = confusion_matrix(
    actual_labels,
    predicted_labels,
    labels=[0, 1]
)

print("\nConfusion Matrix:")
print(cm)


# --------------------------------------------------
# 6. Classification report
# --------------------------------------------------

print("\nClassification Report:")

print(
    classification_report(
        actual_labels,
        predicted_labels,
        labels=[0, 1],
        target_names=["Bonafide", "Spoof"],
        zero_division=0
    )
)
