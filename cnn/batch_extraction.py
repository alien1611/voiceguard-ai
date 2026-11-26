
import numpy as np
import pandas as pd
from pathlib import Path

from dataset_loader import load_protocol
from lfcc_extractor import extract_lfcc


# Configuration
BATCH_SIZE = 100
SAMPLE_SIZE = 250

# New output directory
OUTPUT_DIR = Path("train_features_balanced_batches")
OUTPUT_DIR.mkdir(exist_ok=True)

# Load complete training metadata
train_data = load_protocol("train")

# Select equal numbers from both classes
bonafide = train_data[train_data["label"] == 0].sample(
    n=SAMPLE_SIZE // 2,
    random_state=42
)

spoof = train_data[train_data["label"] == 1].sample(
    n=SAMPLE_SIZE // 2,
    random_state=42
)

# Combine and shuffle
train_data = pd.concat(
    [bonafide, spoof],
    ignore_index=True
).sample(frac=1, random_state=42).reset_index(drop=True)

print("Total recordings:", len(train_data))
print("Bonafide:", sum(train_data["label"] == 0))
print("Spoof:", sum(train_data["label"] == 1))


# Process batches
for start in range(0, len(train_data), BATCH_SIZE):

    end = min(start + BATCH_SIZE, len(train_data))
    batch_data = train_data.iloc[start:end]

    batch_features = []
    batch_labels = []

    print(f"\nProcessing {start + 1} to {end}")

    for _, row in batch_data.iterrows():

        lfcc = extract_lfcc(row["audio_path"])

        batch_features.append(lfcc)
        batch_labels.append(row["label"])

    # Convert to arrays
    X_batch = np.stack(batch_features).astype(np.float32)
    y_batch = np.array(batch_labels, dtype=np.int64)

    # Save batch separately
    output_file = OUTPUT_DIR / f"batch_{start // BATCH_SIZE:03d}.npz"

    np.savez_compressed(
        output_file,
        X=X_batch,
        y=y_batch
    )

    print("Saved:", output_file)
    print("Feature shape:", X_batch.shape)

print("\nAll batches saved successfully!")
