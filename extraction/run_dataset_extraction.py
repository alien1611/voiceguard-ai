
import csv
import gc
import logging
from pathlib import Path

from ml.extraction.batch_extractor import BatchExtractor


PROJECT_ROOT = Path(__file__).resolve().parents[2]

METADATA_DIR = PROJECT_ROOT / "ml" / "datasets" / "metadata"
OUTPUT_ROOT = PROJECT_ROOT / "ml" / "outputs" / "features"

CHUNK_SIZE = 256

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)


def load_records(csv_path):
    with csv_path.open("r", newline="", encoding="utf-8") as f:
        records = list(csv.DictReader(f))

    for record in records:
        if not record.get("audio_path"):
            raise ValueError(
                f"Missing audio_path for {record.get('recording_id')}"
            )

        if record["label"] not in ("bonafide", "spoof"):
            raise ValueError(
                f"Invalid label for {record['recording_id']}"
            )

        if not Path(record["audio_path"]).is_file():
            raise FileNotFoundError(record["audio_path"])

    return records



def process_split(split):
    print(f"\n{'=' * 60}")
    print(f"STARTING {split.upper()} EXTRACTION")
    print(f"{'=' * 60}")

    csv_path = METADATA_DIR / f"{split}_labels.csv"
    records = load_records(csv_path)

    

    output_dir = OUTPUT_ROOT / split
    extractor = BatchExtractor(output_dir=output_dir)

    total = len(records)
    total_success = 0
    total_failed = 0
    total_skipped = 0
    total_elapsed = 0.0


    failures = []

    for start in range(0, total, CHUNK_SIZE):
        chunk = records[start:start + CHUNK_SIZE]

        paths = [record["audio_path"] for record in chunk]
        labels = [record["label"] for record in chunk]

        print(
            f"\nProcessing {start + 1}-{start + len(chunk)} "
            f"of {total} recordings..."
        )

        results, summary = extractor.extract_batch(
            file_paths=paths,
            labels=labels,
            batch_size=64,
        )

        total_success += summary["success"]
        total_failed += summary["failed"]
        total_skipped += summary["skipped"]
        total_elapsed += summary["elapsed_sec"]

        failures.extend(
            result
            for result in results
            if result.error and result.error != "already_processed"
        )

        print(
            f"Chunk complete | "
            f"Success: {summary['success']} | "
            f"Failed: {summary['failed']} | "
            f"Skipped: {summary['skipped']}"
        )

        del results, paths, labels, chunk
        gc.collect()

    extractor.save_labels_csv(
        results=failures,
        output_path=METADATA_DIR / f"{split}_feature_labels.csv",
    )

    print(f"\n{'=' * 60}")
    print(f"{split.upper()} EXTRACTION COMPLETE")
    print(f"Total recordings : {total}")
    print(f"New successes    : {total_success}")
    print(f"Already processed: {total_skipped}")
    print(f"Failures         : {total_failed}")
    print(f"Elapsed seconds  : {total_elapsed:.2f}")
    print(f"Feature directory: {output_dir}")
    print(f"{'=' * 60}")

    if total_failed:
        print(f"WARNING: {total_failed} recordings failed.")
    else:
        print("All recordings processed successfully.")

    return total_failed



def main():
    # EVAL is deliberately excluded to prevent data leakage.
    failed = 0

    for split in ("train","dev"):
        failed += process_split(split)

    print("\n========== FINAL EXTRACTION REPORT ==========")
    print(f"Total failed recordings: {failed}")

    if failed == 0:
        print("TRAIN and DEV extraction completed without failures.")
    else:
        print("Some recordings need investigation or retry.")


if __name__ == "__main__":
    main()
