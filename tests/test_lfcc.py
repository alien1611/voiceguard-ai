"""
Tests for ml.features.lfcc_extractor
======================================
All audio fixtures are generated synthetically.
No real WAV files or the ASVspoof dataset are required.
"""

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

from ml.features.lfcc_extractor import LFCC_CONFIG, LFCCExtractor  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_temp_wav(duration: float = 1.0, sr: int = 16_000, freq: float = 440.0) -> str:
    n = int(sr * duration)
    t = np.linspace(0, duration, n, endpoint=False)
    wave = np.sin(2 * np.pi * freq * t).astype(np.float32)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        sf.write(f.name, wave, sr)
        return f.name


@pytest.fixture(scope="module")
def extractor():
    """Shared LFCCExtractor instance for all tests in this module."""
    return LFCCExtractor()


@pytest.fixture
def wav_path():
    path = _make_temp_wav()
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def wav_path2():
    """Second WAV path for batch tests."""
    path = _make_temp_wav(freq=880.0)
    yield path
    if os.path.exists(path):
        os.unlink(path)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestLFCCConfig:
    def test_config_accessible(self):
        """LFCC_CONFIG is a module-level dict with required keys."""
        assert LFCC_CONFIG["n_lfcc"] == 40
        assert LFCC_CONFIG["sample_rate"] == 16_000
        assert LFCC_CONFIG["n_filter"] == 128
        assert LFCC_CONFIG["n_fft"] == 512
        assert LFCC_CONFIG["win_length"] == 400
        assert LFCC_CONFIG["hop_length"] == 160
        assert LFCC_CONFIG["center"] is False
        assert LFCC_CONFIG["log_lf"] is False


class TestOutputShape:
    def test_lfcc_output_shape(self, extractor, wav_path):
        """extract() returns a tensor of shape [1, 40, T] with T > 0."""
        features = extractor.extract(wav_path)
        assert features.ndim == 3, f"Expected 3-D tensor, got shape {features.shape}"
        assert features.shape[0] == 1, f"Expected channel dim=1, got {features.shape[0]}"
        assert features.shape[1] == 40, f"Expected n_lfcc=40, got {features.shape[1]}"
        assert features.shape[2] > 0, "Time dimension must be > 0"

    def test_lfcc_expected_time_frames(self, extractor, wav_path):
        """Time dimension matches the pre-computed expected_time_frames (297)."""
        features = extractor.extract(wav_path)
        T = features.shape[2]
        assert T == extractor.expected_time_frames, (
            f"Expected T={extractor.expected_time_frames}, got T={T}"
        )

    def test_expected_time_frames_value(self, extractor):
        """expected_time_frames is exactly 297 for the canonical configuration."""
        import math
        frame_len = max(LFCC_CONFIG["win_length"], LFCC_CONFIG["n_fft"])
        expected = math.floor((48_000 - frame_len) / LFCC_CONFIG["hop_length"]) + 1
        assert expected == 297
        assert extractor.expected_time_frames == 297


class TestNumericalSafety:
    def test_lfcc_no_nan(self, extractor, wav_path):
        """LFCC features must not contain NaN."""
        features = extractor.extract(wav_path)
        assert not torch.any(torch.isnan(features)), "LFCC output contains NaN"

    def test_lfcc_no_inf(self, extractor, wav_path):
        """LFCC features must not contain Inf."""
        features = extractor.extract(wav_path)
        assert not torch.any(torch.isinf(features)), "LFCC output contains Inf"

    def test_lfcc_dtype(self, extractor, wav_path):
        """LFCC output tensor dtype is float32."""
        features = extractor.extract(wav_path)
        assert features.dtype == torch.float32, f"Expected float32, got {features.dtype}"


class TestInputVariants:
    def test_lfcc_from_waveform_tensor(self, extractor):
        """extract() accepts a pre-processed [1, 48000] tensor directly."""
        waveform = torch.randn(1, 48_000)
        features = extractor.extract(waveform)
        assert features.shape[0] == 1
        assert features.shape[1] == 40
        assert features.shape[2] > 0

    def test_lfcc_missing_file_raises(self, extractor):
        """extract() raises an exception for a non-existent file path."""
        with pytest.raises(Exception):  # FileNotFoundError or wrapped
            extractor.extract("definitely_not_a_real_file_xyz_999.wav")


class TestBatch:
    def test_lfcc_batch_shape(self, extractor, wav_path, wav_path2):
        """extract_batch([p1, p2]) returns shape [2, 1, 40, T]."""
        batch = extractor.extract_batch([wav_path, wav_path2])
        assert batch.ndim == 4, f"Expected 4-D tensor, got {batch.shape}"
        assert batch.shape[0] == 2, f"Expected batch size 2, got {batch.shape[0]}"
        assert batch.shape[1] == 1
        assert batch.shape[2] == 40
        assert batch.shape[3] > 0
