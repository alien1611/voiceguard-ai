
import numpy as np
import matplotlib.pyplot as plt

data = np.load("dev_features_batches/dev_features.npz")

X = data["X"]
y = data["y"]

bonafide = X[y == 0]
spoof = X[y == 1]

# Calculate mean for each coefficient
bonafide_mean = bonafide.mean(axis=(0, 2))
spoof_mean = spoof.mean(axis=(0, 2))

# Calculate standard deviation
bonafide_std = bonafide.std(axis=(0, 2))
spoof_std = spoof.std(axis=(0, 2))

# Calculate standardised difference
epsilon = 1e-8

pooled_std = np.sqrt(
    (bonafide_std**2 + spoof_std**2) / 2
)

effect_size = (
    bonafide_mean - spoof_mean
) / (pooled_std + epsilon)

print("Coefficient | Bonafide Mean | Spoof Mean | Effect Size")

for i in range(len(effect_size)):
    print(
        f"{i:11d} | "
        f"{bonafide_mean[i]:13.4f} | "
        f"{spoof_mean[i]:10.4f} | "
        f"{effect_size[i]:.4f}"
    )

# Plot effect size
plt.figure(figsize=(12, 5))

plt.bar(range(len(effect_size)), np.abs(effect_size))

plt.xlabel("LFCC Coefficient")
plt.ylabel("Absolute Standardised Difference")
plt.title("LFCC Class Separation by Coefficient")

plt.tight_layout()
plt.show()
