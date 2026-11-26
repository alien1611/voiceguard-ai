
import numpy as np

SAMPLE_RATE = 16000
N_FFT = 512
NUM_FILTERS = 60

# Frequency bins produced by the FFT
frequencies = np.linspace(
    0,
    SAMPLE_RATE / 2,
    N_FFT // 2 + 1
)

# Linear filter points
filter_points = np.linspace(
    0,
    SAMPLE_RATE / 2,
    NUM_FILTERS + 2
)

filterbank = np.zeros(
    (NUM_FILTERS, len(frequencies)),
    dtype=np.float32
)

# Construct triangular filters
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


# Analyse filterbank coverage
nonzero_bins = np.count_nonzero(filterbank, axis=1)
filter_sums = np.sum(filterbank, axis=1)

print("----- FILTERBANK DIAGNOSTICS -----")

print("Filterbank shape:", filterbank.shape)
print("Number of filters:", NUM_FILTERS)
print("Number of FFT bins:", len(frequencies))

print("\nNon-zero FFT bins per filter:")
print(nonzero_bins)

print("\nEmpty filters:", np.sum(nonzero_bins == 0))
print("Minimum bins per filter:", nonzero_bins.min())
print("Maximum bins per filter:", nonzero_bins.max())

print("\nMinimum filter sum:", filter_sums.min())
print("Maximum filter sum:", filter_sums.max())

if np.any(nonzero_bins == 0):
    print("\nWARNING: Some filters have no frequency coverage.")
else:
    print("\nAll filters have frequency coverage.")
