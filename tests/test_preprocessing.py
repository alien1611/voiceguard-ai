"""
Tests for ml.preprocessing.audio_preprocessor
==============================================
All audio fixtures are generated synthetically with numpy/soundfile.
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
# Make the project root importable from any working directory
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.preprocessing.audio_preprocessor import AudioPreprocessor  # noqa: E402


# ---------------------------------------------------------------------------
# Shared fixture helpers
# ---------------------------------------------------------------------------

def _make_temp_wav(
    duration: float = 1.0,
    sr: int = 16_000,
    freq: float = 440.0,
    channels: int = 1,
    silent: bool = False,
) -> str:
    """Write a temporary WAV file and return its path."""
    n_samples = int(sr * duration)
    if silent:
        wave = np.zeros(n_samples, dtype=np.float32)
    else:
        t = np.linspace(0, duration, n_samples, endpoint=False)
        wave = np.sin(2 * np.pi * freq * t).astype(np.float32)

    if channels == 2:
        wave = np.stack([wave, wave], axis=1)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        sf.write(f.name, wave, sr)
        return f.name


@pytest.fixture
def preprocessor():
    """Return a default AudioPreprocessor instance."""
    return AudioPreprocessor()


@pytest.fixture
def valid_wav():
    """Yield the path to a valid 1-second mono 16 kHz WAV; delete on teardown."""
    path = _make_temp_wav(duration=1.0, sr=16_000)
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def stereo_wav():
    path = _make_temp_wav(duration=1.0, sr=16_000, channels=2)
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def highsr_wav():
    """44.1 kHz WAV — requires resampling."""
    path = _make_temp_wav(duration=1.0, sr=44_100)
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def long_wav():
    """5-second WAV — longer than the target 3 s window."""
    path = _make_temp_wav(duration=5.0, sr=16_000)
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def silent_wav():
    path = _make_temp_wav(duration=1.0, sr=16_000, silent=True)
    yield path
    if os.path.exists(path):
        os.unlink(path)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestLoadAudio:
    def test_load_valid_wav(self, preprocessor, valid_wav):
        """load_audio returns a 1-D float32 tensor and the correct sample rate."""
        waveform, sr = preprocessor.load_audio(valid_wav)
        assert waveform.ndim == 1
        assert waveform.dtype == torch.float32
        assert sr == 16_000

    def test_stereo_to_mono(self, preprocessor, stereo_wav):
        """Stereo WAV is converted to a 1-D (mono) tensor."""
        waveform, _ = preprocessor.load_audio(stereo_wav)
        assert waveform.ndim == 1, (
            f"Expected 1-D tensor after stereo→mono conversion, got shape {waveform.shape}"
        )

    def test_missing_file_raises(self, preprocessor):
        """FileNotFoundError is raised for a non-existent path."""
        with pytest.raises(FileNotFoundError):
            preprocessor.load_audio("definitely_does_not_exist_xyz_123.wav")


class TestResample:
    def test_resample_different_sr(self, preprocessor, highsr_wav):
        """process() resamples a 44.1 kHz file to 16 kHz and pads to 48000 samples."""
        out = preprocessor.process(highsr_wav, warn_silent=False)
        assert out.shape == (1, preprocessor.target_samples), (
            f"Expected shape (1, {preprocessor.target_samples}), got {out.shape}"
        )

    def test_resample_same_sr_is_noop(self, preprocessor, valid_wav):
        """When orig_sr == target_sr, resample returns the same tensor."""
        waveform, sr = preprocessor.load_audio(valid_wav)
        resampled = preprocessor.resample(waveform, sr)
        assert resampled.shape == waveform.shape


class TestPadOrCrop:
    def test_pad_short_audio(self, preprocessor, valid_wav):
        """A 1-second file (16 000 samples) is zero-padded to 48 000 samples."""
        out = preprocessor.process(valid_wav, warn_silent=False)
        assert out.shape == (1, 48_000), (
            f"Expected (1, 48000) after padding, got {out.shape}"
        )

    def test_crop_long_audio(self, preprocessor, long_wav):
        """A 5-second file is cropped to exactly 48 000 samples."""
        out = preprocessor.process(long_wav, warn_silent=False)
        assert out.shape == (1, 48_000), (
            f"Expected (1, 48000) after cropping, got {out.shape}"
        )


class TestNumericalSafety:
    def test_no_nan_in_output(self, preprocessor, valid_wav):
        """process() output must not contain NaN values."""
        out = preprocessor.process(valid_wav, warn_silent=False)
        assert not torch.any(torch.isnan(out)), "Output contains NaN"

    def test_no_inf_in_output(self, preprocessor, valid_wav):
        """process() output must not contain Inf values."""
        out = preprocessor.process(valid_wav, warn_silent=False)
        assert not torch.any(torch.isinf(out)), "Output contains Inf"

    def test_output_dtype(self, preprocessor, valid_wav):
        """process() always returns float32."""
        out = preprocessor.process(valid_wav, warn_silent=False)
        assert out.dtype == torch.float32, f"Expected float32, got {out.dtype}"


class TestSilenceDetection:
    def test_silence_detection_silent_file(self, preprocessor, silent_wav):
        """check_silence returns True for an all-zero waveform."""
        waveform, _ = preprocessor.load_audio(silent_wav)
        assert preprocessor.check_silence(waveform) is True

    def test_silence_detection_non_silent(self, preprocessor, valid_wav):
        """check_silence returns False for a 440 Hz sine wave."""
        waveform, _ = preprocessor.load_audio(valid_wav)
        assert preprocessor.check_silence(waveform) is False
