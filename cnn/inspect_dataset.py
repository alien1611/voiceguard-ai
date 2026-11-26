
from pathlib import Path

dataset_path = Path(__file__).resolve().parent.parent / "datasets" / "LA"

print("Dataset exists:", dataset_path.exists())
print("\nDataset structure:\n")

for item in dataset_path.iterdir():
    print(item.name)

    if item.is_dir():
        for child in item.iterdir():
            print("   ", child.name)
