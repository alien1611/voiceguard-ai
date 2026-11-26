
import random
from pathlib import Path

import torch

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FEATURE_ROOT = PROJECT_ROOT / "ml" / "outputs" / "features"

EXPECTED_SHAPE = (1, 40, 297)
SAMPLES_PER_SPLIT = 100
random.seed(42)


def validate_split(split):
    feature_dir = FEATURE_ROOT / split
    files = list(feature_dir.glob("*.pt"))

    if not files:
        raise RuntimeError(f"No feature tensors found for {split}")

    selected = random.sample(
        files, min(SAMPLES_PER_SPLIT, len(files))
    )

    errors = []

    for path in selected:
        try:
            tensor = torch.load(
                path,
                map_location="cpu",
                weights_only=True
            )

            if not isinstance(tensor, torch.Tensor):
                errors.append(f"{path.name}: not a tensor")
                continue

            if tuple(tensor.shape) != EXPECTED_SHAPE:
                errors.append(
                    f"{path.name}: unexpected shape {tuple(tensor.shape)}"
                )

            if tensor.dtype != torch.float32:
                errors.append(
                    f"{path.name}: unexpected dtype {tensor.dtype}"
                )

            if not torch.isfinite(tensor).all():
                errors.append(f"{path.name}: NaN or Inf detected")

        except Exception as exc:
            errors.append(f"{path.name}: {exc}")

    print(f"\n{split.upper()} VALIDATION")
    print(f"Total feature files : {len(files)}")
    print(f"Sampled tensors     : {len(selected)}")
    print(f"Validation errors   : {len(errors)}")

    for error in errors:
        print("ERROR:", error)

    if not errors:
        print("PASS: All sampled tensors are valid.")

    return len(errors)


def main():
    total_errors = 0

    for split in ("train", "dev"):
        total_errors += validate_split(split)

    print("\n========== VALIDATION SUMMARY ==========")

    if total_errors == 0:
        print("SUCCESS: All sampled LFCC tensors passed validation.")
    else:
        print(f"FAILED: {total_errors} validation errors found.")


if __name__ == "__main__":
    main()
