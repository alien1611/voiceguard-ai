"""
Tests for Harmonized 60-Coefficient LFCC Extractor
==================================================
Verifies mathematical parity between features/harmonized_lfcc.py and
the original CNN extraction pipeline (cnn/lfcc_extractor.py,
cnn/best_audio_cnn.pth, and cnn/normalized_train.npz).

Covers:
- Exact output dimensions: (60, 398)
- Numerical equivalence on random audio
- Equivalence on real speech audio
- Equivalence on silence (all zeros)
- Equivalence across varied amplitudes
- Normalization compatibility (cnn/normalized_train.npz)
- CNN prediction and spoof score equivalence (cnn/best_audio_cnn.pth)
- CPU inference stability and performance
"""

import sys
import tempfile
import time
import unittest.mock
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
import torch

# Ensure pandas mock is available if pandas is not installed (protects cnn/lfcc_extractor.py import)
if "pandas" not in sys.modules:
    try:
        import pandas
    except ImportError:
        sys.modules["pandas"] = unittest.mock.MagicMock()

# Setup project import paths
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_CNN_DIR = _PROJECT_ROOT / "cnn"

for p in (str(_PROJECT_ROOT), str(_CNN_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from cnn.cnn_model import AudioCNN
import cnn.lfcc_extractor as legacy_cnn_extractor
from features.harmonized_lfcc import HarmonizedLFCCExtractor, HARMONIZED_LFCC_CONFIG
from preprocessing.audio_preprocessor import AudioPreprocessor


def _run_legacy_pipeline(audio_array: np.ndarray) -> np.ndarray:
    """Run cnn/lfcc_extractor.py steps directly on an in-memory float32 array."""
    frames = legacy_cnn_extractor.frame_audio(audio_array)
    windowed = legacy_cnn_extractor.apply_window(frames)
    pwr = legacy_cnn_extractor.calculate_fft(windowed)
    filterbank_energy = legacy_cnn_extractor.apply_linear_filterbank(pwr)
    log_energy = legacy_cnn_extractor.apply_log(filterbank_energy)
    lfcc = legacy_cnn_extractor.apply_dct(log_energy)
    return lfcc.T  # Transposed to shape (60, 398)


def _generate_synthetic_speech(duration_sec: float = 4.0, sr: int = 16000) -> np.ndarray:
    """Generate multi-harmonic synthetic vowel signal with formant resonances."""
    n_samples = int(duration_sec * sr)
    t = np.linspace(0, duration_sec, n_samples, endpoint=False)
    # Fundamental frequency (f0 = 130 Hz) + harmonics
    f0 = 130.0
    waveform = np.zeros(n_samples, dtype=np.float32)
    for harmonic in range(1, 15):
        amp = 1.0 / harmonic
        # Add formant emphasis around 800 Hz and 2400 Hz
        freq = harmonic * f0
        if 600 <= freq <= 1000:
            amp *= 2.5
        elif 2200 <= freq <= 2600:
            amp *= 1.8
        waveform += amp * np.sin(2 * np.pi * freq * t).astype(np.float32)
    # Normalize amplitude
    waveform = waveform / (np.max(np.abs(waveform)) + 1e-8) * 0.7
    return waveform


@pytest.fixture(scope="module")
def extractor():
    """Shared HarmonizedLFCCExtractor instance."""
    return HarmonizedLFCCExtractor()


@pytest.fixture(scope="module")
def cnn_model():
    """Load the trained AudioCNN model checkpoint."""
    model_path = _CNN_DIR / "best_audio_cnn.pth"
    assert model_path.exists(), f"Model checkpoint not found: {model_path}"
    model = AudioCNN()
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()
    return model


@pytest.fixture(scope="module")
def normalization_stats():
    """Load training normalization mean and std from normalized_train.npz."""
    stats_path = _CNN_DIR / "normalized_train.npz"
    assert stats_path.exists(), f"Stats file not found: {stats_path}"
    data = np.load(stats_path)
    mean = data["mean"].reshape(60, 1)
    std = data["std"].reshape(60, 1)
    return mean, std


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

class TestHarmonizedDimensions:
    """Verify exact output dimensions and parameter compliance."""

    def test_single_audio_dimensions(self, extractor):
        """Single 4-second audio must output shape (60, 398) float32 tensor."""
        audio = torch.randn(64000, dtype=torch.float32)
        features = extractor.extract_from_waveform(audio)

        assert isinstance(features, torch.Tensor)
        assert features.shape == (60, 398), f"Expected (60, 398), got {features.shape}"
        assert features.dtype == torch.float32
        assert torch.isfinite(features).all(), "Features contain NaN or Inf"

    def test_batch_audio_dimensions(self, extractor):
        """Batch of 3 audio waveforms must output shape (3, 60, 398)."""
        batch = torch.randn(3, 64000, dtype=torch.float32)
        features = extractor.extract_from_waveform(batch)

        assert features.shape == (3, 60, 398), f"Expected (3, 60, 398), got {features.shape}"
        assert torch.isfinite(features).all()

    def test_padding_and_cropping(self, extractor):
        """Short audio (< 64000) is zero-padded, long audio (> 64000) is cropped."""
        short_audio = torch.randn(32000, dtype=torch.float32)  # 2.0 s
        long_audio = torch.randn(80000, dtype=torch.float32)   # 5.0 s

        f_short = extractor.extract_from_waveform(short_audio)
        f_long = extractor.extract_from_waveform(long_audio)

        assert f_short.shape == (60, 398)
        assert f_long.shape == (60, 398)


class TestNumericalParity:
    """Verify numerical equivalence against cnn/lfcc_extractor.py."""

    def test_random_audio_numerical_equivalence(self, extractor):
        """Random Gaussian noise audio must match within 1e-4 max error."""
        np.random.seed(101)
        audio_np = np.random.randn(64000).astype(np.float32)

        legacy_feat = _run_legacy_pipeline(audio_np)
        harmonized_feat = extractor.extract_from_waveform(torch.from_numpy(audio_np)).numpy()

        assert legacy_feat.shape == harmonized_feat.shape == (60, 398)

        abs_diff = np.abs(legacy_feat - harmonized_feat)
        max_err = float(np.max(abs_diff))
        mean_err = float(np.mean(abs_diff))

        print(f"\nRandom Audio: max error = {max_err:.2e}, mean error = {mean_err:.2e}")
        assert max_err < 1e-4, f"Max error {max_err} exceeds threshold 1e-4"
        assert mean_err < 5e-5, f"Mean error {mean_err} exceeds threshold 5e-5"

    def test_synthetic_speech_numerical_equivalence(self, extractor):
        """Harmonic speech waveform must match within 1e-4 max error."""
        speech = _generate_synthetic_speech(duration_sec=4.0, sr=16000)

        legacy_feat = _run_legacy_pipeline(speech)
        harmonized_feat = extractor.extract_from_waveform(torch.from_numpy(speech)).numpy()

        abs_diff = np.abs(legacy_feat - harmonized_feat)
        max_err = float(np.max(abs_diff))
        mean_err = float(np.mean(abs_diff))

        print(f"\nSynthetic Speech: max error = {max_err:.2e}, mean error = {mean_err:.2e}")
        assert max_err < 1e-4, f"Max error {max_err} exceeds threshold 1e-4"
        assert mean_err < 5e-5, f"Mean error {mean_err} exceeds threshold 5e-5"

    def test_real_speech_wav_file(self, extractor):
        """Verify on real speech WAV file (mira_cmd.wav or generated real WAV)."""
        candidate_paths = [
            _PROJECT_ROOT / "tests" / "fixtures" / "speech_sample.wav",
            _PROJECT_ROOT / "frontend" / "test_sample.wav",
        ]

        target_file = None
        for p in candidate_paths:
            try:
                if p.exists() and p.is_file():
                    # Test if readable
                    _data, _sr = sf.read(str(p))
                    target_file = p
                    break
            except (PermissionError, OSError, Exception):
                continue

        # If external file is not accessible, create a temporary 16 kHz WAV fixture
        if target_file is None:
            speech = _generate_synthetic_speech(duration_sec=3.5, sr=16000)
            tmp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            sf.write(tmp_wav.name, speech, 16000)
            target_file = Path(tmp_wav.name)

        # Preprocess both using the exact 4-second logic
        preprocessor = AudioPreprocessor(target_sr=16000, duration_sec=4.0)
        proc_audio = preprocessor.process(target_file).squeeze(0).numpy()

        legacy_feat = _run_legacy_pipeline(proc_audio)
        harmonized_feat = extractor.extract(target_file).numpy()

        abs_diff = np.abs(legacy_feat - harmonized_feat)
        max_err = float(np.max(abs_diff))
        mean_err = float(np.mean(abs_diff))

        print(f"\nReal Speech ({target_file.name}): max error = {max_err:.2e}, mean error = {mean_err:.2e}")
        assert max_err < 5e-4, f"Max error {max_err} exceeds 5e-4 on real speech"
        assert mean_err < 5e-5, f"Mean error {mean_err} exceeds 5e-5 on real speech"

    def test_silence_audio(self, extractor):
        """All-zeros waveform must match without division-by-zero or NaNs."""
        silence = np.zeros(64000, dtype=np.float32)

        legacy_feat = _run_legacy_pipeline(silence)
        harmonized_feat = extractor.extract_from_waveform(torch.from_numpy(silence)).numpy()

        assert np.isfinite(legacy_feat).all()
        assert np.isfinite(harmonized_feat).all()

        abs_diff = np.abs(legacy_feat - harmonized_feat)
        max_err = float(np.max(abs_diff))
        mean_err = float(np.mean(abs_diff))
        print(f"\nSilence: max error = {max_err:.2e}, mean error = {mean_err:.2e}")
        assert max_err < 5e-4
        assert mean_err < 5e-5

    def test_different_audio_amplitudes(self, extractor):
        """Verify numerical equivalence across wide dynamic range (low, normal, high)."""
        base_speech = _generate_synthetic_speech(duration_sec=4.0, sr=16000)

        for scale in [0.001, 0.05, 0.5, 2.0, 10.0]:
            scaled = (base_speech * scale).astype(np.float32)

            legacy_feat = _run_legacy_pipeline(scaled)
            harmonized_feat = extractor.extract_from_waveform(torch.from_numpy(scaled)).numpy()

            abs_diff = np.abs(legacy_feat - harmonized_feat)
            max_err = float(np.max(abs_diff))
            assert max_err < 5e-4, f"Failed at amplitude scale {scale}: max_err={max_err}"


class TestNormalizationAndCNNCompatibility:
    """Verify normalization statistics and model prediction equivalence."""

    def test_normalization_shape_and_values(self, extractor, normalization_stats):
        """Verify normalization broadcasting with cnn/normalized_train.npz."""
        mean, std = normalization_stats
        audio = torch.randn(64000, dtype=torch.float32)

        raw_feat = extractor.extract_from_waveform(audio)
        norm_feat = extractor.extract(audio, normalize=True, mean=mean, std=std)

        assert norm_feat.shape == (60, 398)

        # Manual calculation verification
        expected_norm = (raw_feat - torch.from_numpy(mean)) / (torch.from_numpy(std) + 1e-8)
        max_diff = float(torch.max(torch.abs(norm_feat - expected_norm)))
        assert max_diff < 1e-6

    def test_cnn_prediction_equivalence(self, extractor, cnn_model, normalization_stats):
        """Model logits and spoof scores must match between legacy and harmonized extractors."""
        mean, std = normalization_stats

        # Test on 5 different seed audio signals
        for seed in [1, 42, 99, 123, 777]:
            np.random.seed(seed)
            audio_np = np.random.randn(64000).astype(np.float32)

            # Legacy
            legacy_raw = _run_legacy_pipeline(audio_np)
            legacy_norm = (legacy_raw - mean) / (std + 1e-8)
            tensor_legacy = torch.from_numpy(legacy_norm.astype(np.float32)).unsqueeze(0).unsqueeze(0)

            # Harmonized
            harm_norm = extractor.extract(audio_np, normalize=True, mean=mean, std=std)
            tensor_harm = harm_norm.unsqueeze(0).unsqueeze(0)

            with torch.no_grad():
                logit_legacy = cnn_model(tensor_legacy).item()
                logit_harm = cnn_model(tensor_harm).item()

                score_legacy = torch.sigmoid(torch.tensor(logit_legacy)).item()
                score_harm = torch.sigmoid(torch.tensor(logit_harm)).item()

            logit_diff = abs(logit_legacy - logit_harm)
            score_diff = abs(score_legacy - score_harm)

            # Decision parity
            pred_legacy = "SPOOF" if score_legacy >= 0.5 else "BONAFIDE"
            pred_harm = "SPOOF" if score_harm >= 0.5 else "BONAFIDE"

            print(
                f"Seed {seed:3d} | Logit diff: {logit_diff:.2e} | "
                f"Score diff: {score_diff:.2e} | Pred: {pred_legacy}"
            )

            assert logit_diff < 1e-4, f"Logit difference too high: {logit_diff}"
            assert score_diff < 1e-4, f"Score difference too high: {score_diff}"
            assert pred_legacy == pred_harm, "Prediction class mismatch!"

    def test_cpu_inference_performance(self, extractor):
        """Extractor must run on CPU in under 50 ms per 4-second audio file."""
        audio = torch.randn(64000, dtype=torch.float32)

        # Warmup
        _ = extractor.extract_from_waveform(audio)

        times = []
        for _ in range(20):
            t0 = time.perf_counter()
            _ = extractor.extract_from_waveform(audio)
            times.append(time.perf_counter() - t0)

        avg_ms = np.mean(times) * 1000
        print(f"\nAverage CPU LFCC extraction time: {avg_ms:.2f} ms")
        assert avg_ms < 50.0, f"Extraction is too slow: {avg_ms:.2f} ms"


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING HARMONIZED LFCC EQUIVALENCE TEST SUITE")
    print("=" * 60)
    
    ext = HarmonizedLFCCExtractor()
    dim_tester = TestHarmonizedDimensions()
    dim_tester.test_single_audio_dimensions(ext)
    dim_tester.test_batch_audio_dimensions(ext)
    dim_tester.test_padding_and_cropping(ext)
    print("[PASS] TestHarmonizedDimensions")

    num_tester = TestNumericalParity()
    num_tester.test_random_audio_numerical_equivalence(ext)
    num_tester.test_synthetic_speech_numerical_equivalence(ext)
    num_tester.test_real_speech_wav_file(ext)
    num_tester.test_silence_audio(ext)
    num_tester.test_different_audio_amplitudes(ext)
    print("[PASS] TestNumericalParity")

    # Load model and stats
    model_path = _CNN_DIR / "best_audio_cnn.pth"
    model = AudioCNN()
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()

    stats_path = _CNN_DIR / "normalized_train.npz"
    data = np.load(stats_path)
    stats = (data["mean"].reshape(60, 1), data["std"].reshape(60, 1))

    cnn_tester = TestNormalizationAndCNNCompatibility()
    cnn_tester.test_normalization_shape_and_values(ext, stats)
    cnn_tester.test_cnn_prediction_equivalence(ext, model, stats)
    cnn_tester.test_cpu_inference_performance(ext)
    print("[PASS] TestNormalizationAndCNNCompatibility")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

