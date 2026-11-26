
import numpy as np
import pandas as pd
from pathlib import Path

from dataset_loader import load_protocol
from lfcc_extractor import extract_lfcc

OUTPUT_DIR = Path("dev_features_batches")
OUTPUT_DIR.mkdir(exist_ok=True)

# Load official development partition
dev_data = load_protocol("dev")

# Select 50 recordings from each class
bonafide = dev_data[dev_data["label"] == 0].sample(
    n=50,
    random_state=42
)

spoof = dev_data[dev_data["label"] == 1].sample(
    n=50,
    random_state=42
)

# Combine and shuffle
dev_data = pd.concat(
    [bonafide, spoof],
    ignore_index=True
).sample(frac=1, random_state=42).reset_index(drop=True)

features = []
labels = []

# Extract LFCC features
for i, (_, row) in enumerate(dev_data.iterrows()):

    print(f"Processing {i + 1}/100: {row['audio_id']}")

    lfcc = extract_lfcc(row["audio_path"])

    features.append(lfcc)
    labels.append(row["label"])

X = np.stack(features).astype(np.float32)
y = np.array(labels, dtype=np.int64)

# Save validation features
np.savez_compressed(
    OUTPUT_DIR / "dev_features.npz",
    X=X,
    y=y
)

print("\nValidation extraction complete!")
print("Features:", X.shape)
print("Bonafide:", np.sum(y == 0))
print("Spoof:", np.sum(y == 1))
