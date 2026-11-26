
import numpy as np

# Load saved features
data = np.load("train_features_test.npz")

X = data["X"]
y = data["y"]

print("Features shape:", X.shape)
print("Labels shape:", y.shape)

print("\nFirst recording:")
print("Feature matrix:", X[0].shape)
print("Label:", y[0])

print("\nClass distribution:")
print("Bonafide:", np.sum(y == 0))
print("Spoof:", np.sum(y == 1))

print("\nContains NaN:", np.isnan(X).any())
print("Contains Inf:", np.isinf(X).any())
