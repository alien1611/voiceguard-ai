"""Evaluate a labeled, authorized audio manifest without training or recalibration."""

import argparse
import csv
import json
from pathlib import Path

from voiceguard import VoiceGuardDetector


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, default=Path("predictions.csv"))
    parser.add_argument("--model-dir", type=Path)
    args = parser.parse_args()
    detector = VoiceGuardDetector.from_config(model_dir=args.model_dir)

    with args.manifest.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        required = {"path", "label", "source_type"}
        if not required.issubset(reader.fieldnames or ()):
            raise ValueError("Manifest must contain path,label,source_type columns.")
        rows = list(reader)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    columns = (
        "path",
        "source_type",
        "ground_truth_label",
        "predicted_label",
        "raw_logit",
        "spoof_score",
        "threshold",
        "risk_level",
        "audio_quality",
    )
    confusion = [[0, 0], [0, 0]]
    with args.output.open("w", newline="", encoding="utf-8") as destination:
        writer = csv.DictWriter(destination, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            label = int(row["label"])
            if label not in (0, 1):
                raise ValueError(f"Unsupported label {row['label']!r} for {row['path']}")
            audio_path = Path(row["path"])
            if not audio_path.is_absolute():
                audio_path = args.manifest.resolve().parent / audio_path
            result = detector.predict_file(audio_path)
            confusion[label][result.predicted_label] += 1
            writer.writerow(
                {
                    "path": str(audio_path),
                    "source_type": row["source_type"],
                    "ground_truth_label": label,
                    "predicted_label": result.predicted_label,
                    "raw_logit": result.raw_logit,
                    "spoof_score": result.spoof_score,
                    "threshold": result.threshold,
                    "risk_level": result.risk_level,
                    "audio_quality": result.audio_quality.status,
                }
            )
    class_recall = [
        confusion[label][label] / sum(confusion[label]) if sum(confusion[label]) else None
        for label in (0, 1)
    ]
    metrics = {
        "samples": len(rows),
        "class_counts": {"BONAFIDE": sum(confusion[0]), "SPOOF": sum(confusion[1])},
        "confusion_matrix_actual_rows_predicted_columns": confusion,
        "accuracy": (
            sum(confusion[label][label] for label in (0, 1)) / len(rows)
            if rows
            else None
        ),
        "balanced_accuracy": (
            sum(class_recall) / 2
            if all(value is not None for value in class_recall)
            else None
        ),
        "recall_bonafide": class_recall[0],
        "recall_spoof": class_recall[1],
        "threshold_logit": detector.threshold,
        "threshold_recalibrated": False,
    }
    summary_path = args.output.with_name(args.output.stem + "_summary.json")
    summary_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote predictions to {args.output} and metrics to {summary_path}")


if __name__ == "__main__":
    main()
