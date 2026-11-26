"""
Tests for ml.extraction.batch_extractor
=========================================
All audio fixtures are generated synthetically.
No real WAV files or the ASVspoof dataset are required.
"""

import csv
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
import torch

# ---------------------------------------------------------------------------
# Make the project root importable
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.extraction.batch_extractor import BatchExtractor  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers & fixtures
# ---------------------------------------------------------------------------

def _make_temp_wav(duration: float = 1.0, sr: int = 16_000) -> str:
    n = int(sr * duration)
    t = np.linspace(0, duration, n, endpoint=False)
    wave = np.sin(2 * np.pi * 440.0 * t).astype(np.float32)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        sf.write(f.name, wave, sr)
        return f.name


@pytest.fixture
def valid_wav():
    path = _make_temp_wav()
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def valid_wav2():
    path = _make_temp_wav()
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def batch_extractor(tmp_path):
    """BatchExtractor writing to pytest's tmp_path."""
    return BatchExtractor(output_dir=tmp_path)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestEmptyInput:
    def test_empty_input_returns_empty_list(self, batch_extractor):
        """extract_batch([]) returns an empty list without raising."""
        results, summary = batch_extractor.extract_batch([])
        assert results == []
        assert isinstance(summary, dict)

    def test_empty_input_summary_keys(self, batch_extractor):
        """Summary dict contains the required keys."""
        _, summary = batch_extractor.extract_batch([])
        required_keys = {"total", "success", "failed", "skipped", "elapsed_sec"}
        assert required_keys.issubset(summary.keys())


class TestSingleFileExtraction:
    def test_single_file_success(self, batch_extractor, valid_wav):
        """A valid WAV produces a result with a non-None feature_tensor."""
        results, _ = batch_extractor.extract_batch([valid_wav])
        assert len(results) == 1
        assert results[0].feature_tensor is not None
        assert results[0].error is None

    def test_feature_saved_to_disk(self, batch_extractor, valid_wav, tmp_path):
        """The .pt feature file is written to output_dir after extraction."""
        results, _ = batch_extractor.extract_batch([valid_wav])
        recording_id = results[0].recording_id
        pt_file = tmp_path / f"{recording_id}.pt"
        assert pt_file.exists(), f"Expected {pt_file} to exist on disk."

    def test_load_feature_returns_tensor(self, batch_extractor, valid_wav):
        """load_feature() returns the saved tensor by recording ID."""
        results, _ = batch_extractor.extract_batch([valid_wav])
        recording_id = results[0].recording_id
        tensor = batch_extractor.load_feature(recording_id)
        assert tensor is not None
        assert isinstance(tensor, torch.Tensor)
        assert tensor.ndim == 3  # [1, 40, T]


class TestErrorHandling:
    def test_failed_file_logged_not_raised(self, batch_extractor):
        """A missing file returns an error result without raising an exception."""
        results, _ = batch_extractor.extract_batch(["nonexistent_xyz_000.wav"])
        assert len(results) == 1
        assert results[0].error is not None
        assert results[0].feature_tensor is None

    def test_mixed_valid_invalid(self, batch_extractor, valid_wav):
        """extract_batch with one valid and one invalid path returns partial results."""
        results, summary = batch_extractor.extract_batch(
            [valid_wav, "bad_path_xyz_999.wav"]
        )
        assert len(results) == 2
        assert summary["success"] == 1
        assert summary["failed"] == 1


class TestResumeSupport:
    def test_skip_already_processed(self, batch_extractor, valid_wav):
        """Processing the same file twice skips it on the second run."""
        batch_extractor.extract_batch([valid_wav])
        results, summary = batch_extractor.extract_batch([valid_wav])
        assert results[0].error == "already_processed"
        assert summary["skipped"] == 1


class TestSummaryDict:
    def test_summary_dict_keys(self, batch_extractor, valid_wav):
        """Summary dict has all required keys after a successful run."""
        _, summary = batch_extractor.extract_batch([valid_wav])
        required = {"total", "success", "failed", "skipped", "elapsed_sec"}
        assert required.issubset(summary.keys())

    def test_summary_total_matches_input(self, batch_extractor, valid_wav, valid_wav2):
        _, summary = batch_extractor.extract_batch([valid_wav, valid_wav2])
        assert summary["total"] == 2


class TestLabelsCsv:
    def test_labels_csv_created(self, batch_extractor, valid_wav, tmp_path):
        """save_labels_csv produces a CSV file at the specified path."""
        results, _ = batch_extractor.extract_batch([valid_wav], labels=["genuine"])
        csv_path = tmp_path / "labels.csv"
        batch_extractor.save_labels_csv(results, csv_path)
        assert csv_path.exists()

    def test_labels_csv_has_recording_id_column(self, batch_extractor, valid_wav, tmp_path):
        """The CSV file contains a 'recording_id' column."""
        results, _ = batch_extractor.extract_batch([valid_wav], labels=["genuine"])
        csv_path = tmp_path / "labels2.csv"
        batch_extractor.save_labels_csv(results, csv_path)
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
        assert "recording_id" in headers, f"'recording_id' not in CSV headers: {headers}"

    def test_labels_csv_label_value(self, batch_extractor, valid_wav, tmp_path):
        """The CSV correctly records the supplied label."""
        results, _ = batch_extractor.extract_batch([valid_wav], labels=["genuine"])
        csv_path = tmp_path / "labels3.csv"
        batch_extractor.save_labels_csv(results, csv_path)
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        assert len(rows) == 1
        assert rows[0]["label"] == "genuine"
