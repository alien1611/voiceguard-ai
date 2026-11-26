"""
VoiceGuard – Batch LFCC Extractor
================================
Processes audio files one at a time, saves individual LFCC feature tensors,
tracks successful extractions in a JSON manifest, and exports a labels CSV
for the CNN training pipeline.

Design principles:
- Never loads the full dataset into RAM.
- Handles missing/corrupt files without stopping the entire batch.
- Supports resuming interrupted extraction runs.
- Keeps extraction independent of the CNN implementation.
- Preserves labels and feature paths across resumed runs.
"""

import csv
import json
import logging
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import torch

# ---------------------------------------------------------------------------
# Make the project root importable regardless of working directory
# ---------------------------------------------------------------------------

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.features.lfcc_extractor import LFCCExtractor  # noqa: E402

logger = logging.getLogger(__name__)

_MANIFEST_FILENAME = ".extraction_manifest.json"
_MANIFEST_SAVE_INTERVAL = 100


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class ExtractionResult:
    """Outcome of one audio-file extraction attempt."""

    file_path: str
    recording_id: str
    label: Optional[str] = None
    feature_tensor: Optional[torch.Tensor] = None
    error: Optional[str] = None
    processing_time_sec: float = 0.0


# ---------------------------------------------------------------------------
# BatchExtractor
# ---------------------------------------------------------------------------

class BatchExtractor:
    """
    Batch LFCC feature extractor.

    Each recording is processed individually and saved as a .pt tensor.
    A JSON manifest stores successful recording IDs, labels, source paths,
    and feature paths so extraction can be resumed safely.

    Parameters
    ----------
    output_dir : str or Path
        Directory for .pt tensors and the extraction manifest.
    extractor : LFCCExtractor, optional
        Preconfigured LFCC extractor. A default instance is created if omitted.
    """

    def __init__(
        self,
        output_dir: Union[str, Path] = "ml/outputs/features",
        extractor: Optional[LFCCExtractor] = None,
    ) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.extractor = extractor or LFCCExtractor()

        self._manifest_path = self.output_dir / _MANIFEST_FILENAME
        self._records: Dict[str, Dict[str, str]] = {}
        self._processed_ids = self._load_manifest()
        self._pending_manifest_updates = 0

        logger.info(
            "BatchExtractor initialised. Output dir: %s | "
            "Already processed: %d recordings.",
            self.output_dir,
            len(self._processed_ids),
        )

    # ------------------------------------------------------------------
    # Manifest helpers
    # ------------------------------------------------------------------

    def _load_manifest(self) -> set:
        """
        Load processed IDs and metadata.

        Supports both the current manifest format and the older format
        containing only a 'processed_ids' list.
        """
        if not self._manifest_path.exists():
            return set()

        try:
            with open(self._manifest_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            processed_ids = set(data.get("processed_ids", []))

            # New format: metadata keyed by recording ID.
            records = data.get("records", {})
            if isinstance(records, dict):
                for recording_id, record in records.items():
                    if isinstance(record, dict):
                        self._records[str(recording_id)] = {
                            "file_path": str(record.get("file_path", "")),
                            "feature_file": str(
                                record.get(
                                    "feature_file",
                                    self.output_dir / f"{recording_id}.pt",
                                )
                            ),
                            "label": str(record.get("label") or ""),
                        }
                        processed_ids.add(str(recording_id))

            # Migrate old manifests that only stored processed IDs.
            for recording_id in processed_ids:
                self._records.setdefault(
                    recording_id,
                    {
                        "file_path": "",
                        "feature_file": str(
                            self.output_dir / f"{recording_id}.pt"
                        ),
                        "label": "",
                    },
                )

            return processed_ids

        except (json.JSONDecodeError, OSError, AttributeError, TypeError) as exc:
            logger.warning(
                "Manifest could not be loaded; starting with an empty "
                "in-memory manifest. File: %s | Error: %s",
                self._manifest_path,
                exc,
            )
            self._records = {}
            return set()

    def _save_manifest(self) -> None:
        """Atomically persist processed IDs and their metadata."""
        data = {
            "processed_ids": sorted(self._processed_ids),
            "records": self._records,
        }

        temp_path = self._manifest_path.with_suffix(
            self._manifest_path.suffix + ".tmp"
        )

        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        temp_path.replace(self._manifest_path)
        self._pending_manifest_updates = 0

    def _get_recording_id(self, file_path: Union[str, Path]) -> str:
        """Return the filename stem as the recording ID."""
        return Path(file_path).stem

    def _is_processed(self, recording_id: str) -> bool:
        """Return True only when the ID is recorded and its tensor exists."""
        if recording_id not in self._processed_ids:
            return False

        record = self._records.get(recording_id, {})
        feature_path = Path(
            record.get(
                "feature_file",
                str(self.output_dir / f"{recording_id}.pt"),
            )
        )

        # Stored paths may already include a relative output_dir. Check the
        # stored path first; only resolve against output_dir if needed.
        if not feature_path.exists() and not feature_path.is_absolute():
            feature_path = self.output_dir / feature_path

        if feature_path.exists():
            return True

        # The manifest may outlive a deleted or moved tensor. Re-extract it.
        logger.warning(
            "Manifest lists %s as processed, but its tensor is missing. "
            "It will be extracted again.",
            recording_id,
        )
        self._processed_ids.discard(recording_id)
        self._records.pop(recording_id, None)
        return False

    def _mark_processed(
        self,
        recording_id: str,
        file_path: Union[str, Path],
        label: Optional[str],
        feature_path: Union[str, Path],
    ) -> None:
        """Record a successful extraction and checkpoint periodically."""
        self._processed_ids.add(recording_id)
        self._records[recording_id] = {
            "file_path": str(file_path),
            "feature_file": str(feature_path),
            "label": label or "",
        }
        self._pending_manifest_updates += 1

        if self._pending_manifest_updates >= _MANIFEST_SAVE_INTERVAL:
            self._save_manifest()

    # ------------------------------------------------------------------
    # Single-file extraction
    # ------------------------------------------------------------------

    def extract_one(
        self,
        file_path: Union[str, Path],
        label: Optional[str] = None,
    ) -> ExtractionResult:
        """Extract and save LFCC features for one audio file."""
        file_path = Path(file_path)
        recording_id = self._get_recording_id(file_path)
        t0 = time.perf_counter()

        if self._is_processed(recording_id):
            # Refresh a missing label if this resumed run supplies one.
            record = self._records.get(recording_id, {})
            if label:
                record["label"] = label
                self._records[recording_id] = record
                self._pending_manifest_updates += 1

            return ExtractionResult(
                file_path=str(file_path),
                recording_id=recording_id,
                label=label or record.get("label") or None,
                error="already_processed",
                processing_time_sec=0.0,
            )

        try:
            features = self.extractor.extract(file_path)

            out_path = self.output_dir / f"{recording_id}.pt"
            temp_out_path = out_path.with_suffix(out_path.suffix + ".tmp")

            torch.save(features, temp_out_path)
            temp_out_path.replace(out_path)

            self._mark_processed(
                recording_id=recording_id,
                file_path=file_path,
                label=label,
                feature_path=out_path,
            )

            elapsed = time.perf_counter() - t0
            logger.debug(
                "Extracted %s -> %s (%.2f s)",
                recording_id,
                out_path,
                elapsed,
            )

            return ExtractionResult(
                file_path=str(file_path),
                recording_id=recording_id,
                label=label,
                feature_tensor=features,
                processing_time_sec=elapsed,
            )

        except Exception as exc:
            elapsed = time.perf_counter() - t0
            logger.warning(
                "Failed to extract '%s': %s (%.2f s)",
                file_path,
                exc,
                elapsed,
            )
            return ExtractionResult(
                file_path=str(file_path),
                recording_id=recording_id,
                label=label,
                error=str(exc),
                processing_time_sec=elapsed,
            )

    # ------------------------------------------------------------------
    # Batch extraction
    # ------------------------------------------------------------------

    def extract_batch(
        self,
        file_paths: List[Union[str, Path]],
        labels: Optional[List[str]] = None,
        batch_size: int = 32,
    ) -> Tuple[List[ExtractionResult], Dict]:
        """
        Extract LFCC features from a list of files.

        Files are processed individually; batch_size controls progress-log
        frequency, not the number of audio files held in memory.
        """
        if not isinstance(batch_size, int) or isinstance(batch_size, bool):
            raise TypeError("batch_size must be an integer")

        if batch_size <= 0:
            raise ValueError("batch_size must be greater than 0")

        if not file_paths:
            logger.warning("extract_batch called with an empty file list.")
            return [], {
                "total": 0,
                "success": 0,
                "failed": 0,
                "skipped": 0,
                "elapsed_sec": 0.0,
            }

        if labels is not None and len(labels) != len(file_paths):
            raise ValueError(
                f"Length mismatch: {len(file_paths)} paths vs "
                f"{len(labels)} labels."
            )

        t_start = time.perf_counter()
        results: List[ExtractionResult] = []
        success = failed = skipped = 0

        for i, fp in enumerate(file_paths):
            lbl = labels[i] if labels is not None else None
            result = self.extract_one(fp, label=lbl)
            results.append(result)

            if result.error == "already_processed":
                skipped += 1
            elif result.error is not None:
                failed += 1
            else:
                success += 1

            if (i + 1) % batch_size == 0:
                logger.info(
                    "Progress: %d/%d | success=%d failed=%d skipped=%d",
                    i + 1,
                    len(file_paths),
                    success,
                    failed,
                    skipped,
                )

        # Flush metadata updates, including the final partial checkpoint.
        self._save_manifest()

        elapsed = time.perf_counter() - t_start
        summary = {
            "total": len(file_paths),
            "success": success,
            "failed": failed,
            "skipped": skipped,
            "elapsed_sec": round(elapsed, 3),
        }

        logger.info("Batch extraction complete: %s", summary)
        return results, summary

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def save_labels_csv(
        self,
        results: List[ExtractionResult],
        output_path: Union[str, Path],
    ) -> None:
        """
        Export a complete CSV from the persistent manifest plus failures
        from the current run.

        Previously processed recordings are retained when extraction is
        resumed, rather than disappearing from the CSV.
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        rows: Dict[str, Dict[str, str]] = {}

        # Include every successful recording in the persistent manifest.
        for recording_id, record in self._records.items():
            rows[recording_id] = {
                "recording_id": recording_id,
                "feature_file": record.get("feature_file", ""),
                "label": record.get("label", ""),
                "error": "",
            }

        # Include failures from this run. Successful and skipped recordings
        # are already represented by the manifest.
        for result in results:
            if result.error and result.error != "already_processed":
                rows[result.recording_id] = {
                    "recording_id": result.recording_id,
                    "feature_file": "",
                    "label": result.label or "",
                    "error": result.error,
                }

        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "recording_id",
                    "feature_file",
                    "label",
                    "error",
                ],
            )
            writer.writeheader()
            for recording_id in sorted(rows):
                writer.writerow(rows[recording_id])

        logger.info("Labels CSV saved to %s", output_path)

    def load_feature(self, recording_id: str) -> Optional[torch.Tensor]:
        """Load a saved LFCC tensor by recording ID."""
        pt_path = self.output_dir / f"{recording_id}.pt"

        if not pt_path.exists():
            logger.warning("Feature file not found: %s", pt_path)
            return None

        return torch.load(pt_path, map_location="cpu", weights_only=True)

    def __repr__(self) -> str:
        return (
            f"BatchExtractor("
            f"output_dir={self.output_dir}, "
            f"processed={len(self._processed_ids)})"
        )
