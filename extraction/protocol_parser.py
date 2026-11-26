
"""
VoiceGuard - ASVspoof2019 LA Protocol Parser

Reads official CM protocol files, maps recordings to audio paths,
assigns binary labels, and exports split-specific CSV metadata.
"""

import csv
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATASET_ROOT = (
    PROJECT_ROOT
    / "ml"
    / "datasets"
    / "raw"
    / "ASVspoof2019_LA"
    / "LA"
)

PROTOCOL_DIR = DATASET_ROOT / "ASVspoof2019_LA_cm_protocols"

OUTPUT_DIR = PROJECT_ROOT / "ml" / "datasets" / "metadata"

SPLITS = {
    "train": "ASVspoof2019.LA.cm.train.trn.txt",
    "dev": "ASVspoof2019.LA.cm.dev.trl.txt",
    "eval": "ASVspoof2019.LA.cm.eval.trl.txt",
}


def parse_protocol(split: str):
    if split not in SPLITS:
        raise ValueError(f"Unknown split: {split}")

    protocol_file = PROTOCOL_DIR / SPLITS[split]
    audio_dir = DATASET_ROOT / f"ASVspoof2019_LA_{split}" / "flac"

    if not protocol_file.exists():
        raise FileNotFoundError(protocol_file)

    if not audio_dir.exists():
        raise FileNotFoundError(audio_dir)

    # Index audio files by recording ID.
    audio_index = {
        path.stem: path.resolve()
        for path in audio_dir.glob("*.flac")
    }

    records = []
    seen_ids = set()
    missing_ids = []
    malformed_lines = []

    with protocol_file.open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            parts = line.split()

            if len(parts) != 5:
                malformed_lines.append(line_number)
                continue

            speaker_id, recording_id, _, attack_id, label = parts

            if label not in ("bonafide", "spoof"):
                raise ValueError(
                    f"Unexpected label at line {line_number}: {label}"
                )

            if recording_id in seen_ids:
                raise ValueError(
                    f"Duplicate recording ID: {recording_id}"
                )

            seen_ids.add(recording_id)

            audio_path = audio_index.get(recording_id)

            if audio_path is None:
                missing_ids.append(recording_id)
                continue

            records.append({
                "recording_id": recording_id,
                "speaker_id": speaker_id,
                "attack_id": attack_id,
                "label": label,
                "label_id": 0 if label == "bonafide" else 1,
                "split": split,
                "audio_path": str(audio_path),
            })

    # Check for audio files absent from the protocol.
    extra_audio = set(audio_index) - seen_ids

    if malformed_lines:
        raise ValueError(
            f"{split}: malformed protocol lines: {malformed_lines[:10]}"
        )

    if missing_ids:
        raise FileNotFoundError(
            f"{split}: {len(missing_ids)} protocol recordings "
            f"have no matching FLAC. Examples: {missing_ids[:10]}"
        )

    if extra_audio:
        print(
            f"WARNING: {split}: ignoring {len(extra_audio)} "
            f"audio files not listed in the official protocol."
        )

    if len(records) != len(seen_ids):
        raise RuntimeError(f"{split}: protocol/record count mismatch")

    return records


def save_csv(records, split):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output_file = OUTPUT_DIR / f"{split}_labels.csv"

    fieldnames = [
        "recording_id",
        "speaker_id",
        "attack_id",
        "label",
        "label_id",
        "split",
        "audio_path",
    ]

    with output_file.open(
        "w", newline="", encoding="utf-8"
    ) as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    return output_file


def main():
    total = 0

    for split in ("train", "dev", "eval"):
        print(f"\nProcessing {split.upper()} protocol...")

        records = parse_protocol(split)
        output_file = save_csv(records, split)

        bonafide = sum(r["label_id"] == 0 for r in records)
        spoof = sum(r["label_id"] == 1 for r in records)

        total += len(records)

        print(f"Total recordings : {len(records)}")
        print(f"Bonafide         : {bonafide}")
        print(f"Spoof            : {spoof}")
        print(f"CSV saved        : {output_file}")

    print("\n" + "=" * 40)
    print(f"TOTAL RECORDINGS: {total}")
    print("ALL PROTOCOLS PARSED SUCCESSFULLY")
    print("=" * 40)


if __name__ == "__main__":
    main()

