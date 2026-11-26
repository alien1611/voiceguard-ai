
import numpy as np
from pathlib import Path

# Load training batches
batch_dir = Path("train_features_balanced_batches")

features = []

for file in sorted(batch_dir.glob("batch_*.npz")):
    data = np.load(file)
    features.append(data["X"])

X_train = np.concatenate(features, axis=0)

# Calculate statistics across recordings and time frames
mean = X_train.mean(axis=(0, 2), keepdims=True)
std = X_train.std(axis=(0, 2), keepdims=True)

# Avoid division by zero
epsilon = 1e-8

# Normalise training features
X_normalized = (X_train - mean) / (std + epsilon)

# Check the result
print("Original shape:", X_train.shape)
print("Normalized shape:", X_normalized.shape)

print("Original mean:", X_train.mean())
print("Normalized mean:", X_normalized.mean())

print("Original std:", X_train.std())
print("Normalized std:", X_normalized.std())

# Save normalised training data and statistics
np.savez_compressed(
    "normalized_train.npz",
    X=X_normalized.astype(np.float32),
    y=np.concatenate([
        np.load(file)["y"]
        for file in sorted(batch_dir.glob("batch_*.npz"))
    ]),
    mean=mean,
    std=std
)

print("Normalized training data saved!")
