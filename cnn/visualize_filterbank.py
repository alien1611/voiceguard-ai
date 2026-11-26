
import numpy as np
import matplotlib.pyplot as plt

SAMPLE_RATE = 16000
N_FFT = 512
NUM_FILTERS = 60

frequencies = np.linspace(
    0,
    SAMPLE_RATE / 2,
    N_FFT // 2 + 1
)

filter_points = np.linspace(
    0,
    SAMPLE_RATE / 2,
    NUM_FILTERS + 2
)

filterbank = np.zeros(
    (NUM_FILTERS, len(frequencies)),
    dtype=np.float32
)

for i in range(NUM_FILTERS):

    left = filter_points[i]
    center = filter_points[i + 1]
    right = filter_points[i + 2]

    for j, frequency in enumerate(frequencies):

        if left <= frequency <= center:
            filterbank[i, j] = (
                (frequency - left) / (center - left)
            )

        elif center < frequency <= right:
            filterbank[i, j] = (
                (right - frequency) / (right - center)
            )

plt.figure(figsize=(14, 6))

for i in range(NUM_FILTERS):
    plt.plot(frequencies, filterbank[i])

plt.title("LFCC Linear Triangular Filterbank")
plt.xlabel("Frequency (Hz)")
plt.ylabel("Filter Weight")
plt.grid(alpha=0.3)

plt.show()
