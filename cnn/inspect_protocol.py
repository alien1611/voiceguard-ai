
from pathlib import Path

dataset_path = Path(__file__).resolve().parent.parent / "datasets" / "LA"

protocol_path = dataset_path / "ASVspoof2019_LA_cm_protocols"

protocol_files = [
    "ASVspoof2019.LA.cm.train.trn.txt",
    "ASVspoof2019.LA.cm.dev.trl.txt",
    "ASVspoof2019.LA.cm.eval.trl.txt"
]

for filename in protocol_files:
    file_path = protocol_path / filename

    print(f"\n{'=' * 55}")
    print(filename)
    print("=" * 55)

    with open(file_path, "r") as file:
        for i, line in enumerate(file):
            if i == 5:
                break
            print(line.strip())
