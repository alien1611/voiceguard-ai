
import numpy as np
import pandas as pd

from dataset_loader import load_protocol
from lfcc_extractor import extract_lfcc


# 1. Load training metadata
train_data = load_protocol("train")


# 2. Select 5 bonafide and 5 spoof recordings
bonafide = train_data[
    train_data["label"] == 0
].head(5)

spoof = train_data[
    train_data["label"] == 1
].head(5)


# 3. Combine both classes
test_data = pd.concat(
    [bonafide, spoof],
    ignore_index=True
)


# 4. Prepare feature and label lists
features = []
labels = []


# 5. Extract LFCC features
for i, (_, row) in enumerate(test_data.iterrows()):

    print(
        f"Processing {i + 1}/10: {row['audio_id']}",
        flush=True
    )

    lfcc = extract_lfcc(row["audio_path"])

    features.append(lfcc)
    labels.append(row["label"])


# 6. Convert lists into NumPy arrays
X = np.stack(features).astype(np.float32)

y = np.array(
    labels,
    dtype=np.int64
)


# 7. Save extracted features
np.savez_compressed(
    "train_features_test.npz",
    X=X,
    y=y
)


# 8. Display results
print("\nExtraction completed!")

print("Feature dataset shape:", X.shape)
print("Label dataset shape:", y.shape)
print("Labels:", y)

print("Feature data type:", X.dtype)
print("Label data type:", y.dtype)
