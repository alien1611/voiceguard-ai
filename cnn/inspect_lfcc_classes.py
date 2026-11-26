
import numpy as np
import matplotlib.pyplot as plt

# Load validation features
data = np.load("dev_features_batches/dev_features.npz")

X = data["X"]
y = data["y"]

# Separate the two classes
bonafide = X[y == 0]
spoof = X[y == 1]

# Calculate average LFCC matrices
bonafide_mean = np.mean(bonafide, axis=0)
spoof_mean = np.mean(spoof, axis=0)

# Calculate absolute difference
difference = np.abs(bonafide_mean - spoof_mean)

# Plot the three matrices
fig, axes = plt.subplots(1, 3, figsize=(18, 5))

axes[0].imshow(bonafide_mean, aspect="auto", origin="lower")
axes[0].set_title("Bonafide Average LFCC")

axes[1].imshow(spoof_mean, aspect="auto", origin="lower")
axes[1].set_title("Spoof Average LFCC")

axes[2].imshow(difference, aspect="auto", origin="lower")
axes[2].set_title("Absolute Difference")

for ax in axes:
    ax.set_xlabel("Time Frames")
    ax.set_ylabel("LFCC Coefficients")

plt.tight_layout()
plt.show()

print("Bonafide mean:", np.mean(bonafide_mean))
print("Spoof mean:", np.mean(spoof_mean))
print("Average absolute difference:", np.mean(difference))
