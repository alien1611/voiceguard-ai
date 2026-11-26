
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader


class AudioDataset(Dataset):

    def __init__(self, features, labels):

        self.features = torch.tensor(
            features, dtype=torch.float32
        )

        self.labels = torch.tensor(
            labels, dtype=torch.float32
        )

    def __len__(self):
        return len(self.features)

    def __getitem__(self, index):

        feature = self.features[index]

        # Add channel dimension
        feature = feature.unsqueeze(0)

        label = self.labels[index]

        return feature, label


# Load normalised training data
train_data = np.load("normalized_train.npz")

X_train = train_data["X"]
y_train = train_data["y"]


# Load normalised validation data
dev_data = np.load("normalized_dev.npz")

X_dev = dev_data["X"]
y_dev = dev_data["y"]


# Create datasets
train_dataset = AudioDataset(X_train, y_train)
dev_dataset = AudioDataset(X_dev, y_dev)


# Create DataLoaders
train_loader = DataLoader(
    train_dataset,
    batch_size=16,
    shuffle=True
)

dev_loader = DataLoader(
    dev_dataset,
    batch_size=16,
    shuffle=False
)


# Verify
print("Training recordings:", len(train_dataset))
print("Validation recordings:", len(dev_dataset))

for features, labels in train_loader:
    print("Training batch:", features.shape)
    break

for features, labels in dev_loader:
    print("Validation batch:", features.shape)
    break
