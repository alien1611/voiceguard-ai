import numpy as np
import torch
from pathlib import Path
from torch.utils.data import Dataset, DataLoader

# Load all extracted batches
BATCH_DIR = Path("train_features_balanced_batches")

features = []
labels = []

for file in sorted(BATCH_DIR.glob("batch_*.npz")):

    data = np.load(file)

    features.append(data["X"])
    labels.append(data["y"])

X = np.concatenate(features, axis=0)
y = np.concatenate(labels, axis=0)

# Convert to PyTorch tensors
X = torch.tensor(X, dtype=torch.float32)
y = torch.tensor(y, dtype=torch.float32)


# Custom Dataset
class AudioDataset(Dataset):

    def __init__(self, features, labels):
        self.features = features
        self.labels = labels

    def __len__(self):
        return len(self.features)

    def __getitem__(self, index):

        feature = self.features[index]

        # Add channel dimension
        feature = feature.unsqueeze(0)

        label = self.labels[index]

        return feature, label


# Create Dataset and DataLoader
dataset = AudioDataset(X, y)

dataloader = DataLoader(
    dataset,
    batch_size=16,
    shuffle=True
)

# Test one batch
for batch_features, batch_labels in dataloader:

    print("Batch features:", batch_features.shape)
    print("Batch labels:", batch_labels.shape)

    print("Feature data type:", batch_features.dtype)
    print("Label data type:", batch_labels.dtype)

    print("Total recordings:", len(dataset))
    print("Bonafide:", torch.sum(y == 0).item())
    print("Spoof:", torch.sum(y == 1).item())

    break
