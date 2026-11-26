import torch
from cnn_model import AudioCNN

# Create the model
model = AudioCNN()

# Create sample input (16 recordings)
sample_input = torch.randn(16, 1, 60, 398)

# Pass input through the model
output = model(sample_input)

print("Input shape:", sample_input.shape)
print("Output shape:", output.shape)
print("Output:", output)