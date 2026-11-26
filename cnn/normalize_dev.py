
import numpy as np

# Load validation features
data = np.load("dev_features_batches/dev_features.npz")

X_dev = data["X"]
y_dev = data["y"]

# Load training statistics
train_data = np.load("normalized_train.npz")

mean = train_data["mean"]
std = train_data["std"]

# Apply training statistics to validation data
epsilon = 1e-8

X_dev_normalized = (
    X_dev - mean
) / (std + epsilon)

# Check results
print("Original shape:", X_dev.shape)
print("Normalized shape:", X_dev_normalized.shape)

print("Original mean:", X_dev.mean())
print("Normalized mean:", X_dev_normalized.mean())

print("Normalized std:", X_dev_normalized.std())

# Save
np.savez_compressed(
    "normalized_dev.npz",
    X=X_dev_normalized.astype(np.float32),
    y=y_dev
)

print("Normalized validation data saved!")

