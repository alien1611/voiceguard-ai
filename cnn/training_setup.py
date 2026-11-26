import torch
import torch.nn as nn
import torch.optim as optim

from cnn_model import AudioCNN

# Create model
model = AudioCNN()

# Define loss function
criterion = nn.BCEWithLogitsLoss()

# Define optimizer
optimizer = optim.Adam(
    model.parameters(),
    lr=0.001
)

print("Model created successfully")
print("Loss function:", criterion)
print("Optimizer:", optimizer)