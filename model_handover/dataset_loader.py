
from pathlib import Path
import pandas as pd


DATASET_PATH = Path(__file__).resolve().parent.parent / "datasets" / "LA"

PROTOCOL_PATH = DATASET_PATH / "ASVspoof2019_LA_cm_protocols"


def load_protocol(partition):

    protocol_files = {
        "train": "ASVspoof2019.LA.cm.train.trn.txt",
        "dev": "ASVspoof2019.LA.cm.dev.trl.txt",
        "eval": "ASVspoof2019.LA.cm.eval.trl.txt"
    }

    if partition not in protocol_files:
        raise ValueError("Invalid partition")

    file_path = PROTOCOL_PATH / protocol_files[partition]

    data = pd.read_csv(
        file_path,
        sep=r"\s+",
        header=None
    )

    data.columns = [
        "speaker_id",
        "audio_id",
        "unused",
        "attack_id",
        "label"
    ]

    data["label"] = data["label"].map({
        "bonafide": 0,
        "spoof": 1
    })

    audio_folder = DATASET_PATH / f"ASVspoof2019_LA_{partition}" / "flac"

    data["audio_path"] = data["audio_id"].apply(
        lambda audio_id: audio_folder / f"{audio_id}.flac"
    )

    return data


if __name__ == "__main__":

    train_data = load_protocol("train")

    print("\nFirst five records:")
    print(train_data.head())

    print("\nLabel distribution:")
    print(train_data["label"].value_counts())

    print("\nAudio files exist:")
    print(train_data["audio_path"].head().apply(
        lambda path: path.exists()
    ))
