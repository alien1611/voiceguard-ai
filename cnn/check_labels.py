import numpy as np

data = np.load("train_features_100.npz")

y = data["y"]

print("Total recordings:", len(y))
print("Bonafide:", np.sum(y == 0))
print("Spoof:", np.sum(y == 1))