
import torch
import torch.nn as nn
import torch.optim as optim

from cnn_model import AudioCNN
from prepare_data import train_loader, dev_loader


# Select computing device
device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("Using device:", device)


# Initialize model
model = AudioCNN().to(device)


# Loss function and optimizer
criterion = nn.BCEWithLogitsLoss()

optimizer = optim.Adam(
    model.parameters(),
    lr=0.001
)


# Training configuration
EPOCHS = 10

best_dev_loss = float("inf")
best_dev_accuracy = 0.0
best_epoch = 0


# Training loop
for epoch in range(EPOCHS):

    model.train()

    total_train_loss = 0
    correct_train = 0
    total_train = 0

    for features, labels in train_loader:

        features = features.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()

        outputs = model(features).squeeze(1)

        loss = criterion(outputs, labels)

        loss.backward()
        optimizer.step()

        total_train_loss += loss.item() * labels.size(0)

        predictions = (outputs >= 0).float()

        correct_train += (
            predictions == labels
        ).sum().item()

        total_train += labels.size(0)

    train_loss = total_train_loss / total_train
    train_accuracy = correct_train / total_train


    # Validation
    model.eval()

    total_dev_loss = 0
    correct_dev = 0
    total_dev = 0

    with torch.no_grad():

        for features, labels in dev_loader:

            features = features.to(device)
            labels = labels.to(device)

            outputs = model(features).squeeze(1)

            loss = criterion(outputs, labels)

            total_dev_loss += loss.item() * labels.size(0)

            predictions = (outputs >= 0).float()

            correct_dev += (
                predictions == labels
            ).sum().item()

            total_dev += labels.size(0)

    dev_loss = total_dev_loss / total_dev
    dev_accuracy = correct_dev / total_dev


    # Display results
    print(f"\nEpoch [{epoch + 1}/{EPOCHS}]")

    print(f"Training Loss: {train_loss:.4f}")
    print(f"Training Accuracy: {train_accuracy * 100:.2f}%")

    print(f"Validation Loss: {dev_loss:.4f}")
    print(f"Validation Accuracy: {dev_accuracy * 100:.2f}%")


    # Save best model based on validation loss
    if dev_loss < best_dev_loss:

        best_dev_loss = dev_loss
        best_dev_accuracy = dev_accuracy
        best_epoch = epoch + 1

        torch.save(
            model.state_dict(),
            "best_audio_cnn.pth"
        )

        print("Best model saved!")


# Save final epoch model separately
torch.save(
    model.state_dict(),
    "audio_cnn.pth"
)


print("\nTraining completed!")
print("Final model saved as audio_cnn.pth")
print("Best model saved as best_audio_cnn.pth")
print("Best epoch:", best_epoch)
print(f"Best validation loss: {best_dev_loss:.4f}")
print(f"Accuracy at best epoch: {best_dev_accuracy * 100:.2f}%")
