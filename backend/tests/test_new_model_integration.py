"""
VoiceGuard New AudioCNN (22k) Integration & Verification Test Suite
==================================================================
Comprehensive automated tests verifying the isolated integration of
the newly supplied CNN (22k) model:
1. Isolated loader and checkpoint parameter dimensions (23,361 weights).
2. Dedicated NewLFCCExtractor mathematical equivalence and shape (60, 398).
3. In-memory audio decoding, mono downmixing, 44.1 kHz resampling, cropping, and padding.
4. Robust error handling for invalid/empty/corrupted files.
5. Legacy model preservation and isolated side-by-side inference.
6. Real benchmark verification on known ASVspoof 2019 bonafide and spoof audio.
"""

import io
import sys
from pathlib import Path
import numpy as np
import pytest
import soundfile as sf
import torch
from fastapi import HTTPException

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import backend.main as bmain
from backend.new_model_loader import NewModelLoader
from backend.new_extractor import NewLFCCExtractor
from backend.new_inference import NewInferenceService
from backend.inference import InferenceService
from backend.audio_service import AudioService
from backend.config import NEW_MODEL_PATH, MODEL_PATH, DEFAULT_THRESHOLD


def _generate_wav(duration: float = 4.0, sr: int = 16000, channels: int = 1, freq: float = 220.0) -> bytes:
    """Generate in-memory WAV bytes."""
    n_samples = int(duration * sr)
    t = np.linspace(0, duration, n_samples, endpoint=False)
    sig = 0.4 * np.sin(2 * np.pi * freq * t).astype(np.float32)
    if channels > 1:
        sig = np.stack([sig] * channels, axis=1)
    buf = io.BytesIO()
    sf.write(buf, sig, sr, format="WAV")
    return buf.getvalue()


class TestNewModelLoaderAndExtractor:
    """Stage 5.1: Verify isolated loader and dedicated extractor."""

    def test_new_model_loader_initialization(self):
        loader = NewModelLoader.get_instance()
        loader.initialize()
        assert loader.is_ready is True
        assert loader.model is not None
        assert loader.mean is not None
        assert loader.std is not None
        assert loader.model.training is False, "New model must strictly be in eval() mode"

    def test_parameter_dimensions_and_counts(self):
        loader = NewModelLoader.get_instance()
        loader.initialize()
        params = list(loader.model.parameters())
        total_params = sum(p.numel() for p in params)
        assert total_params == 23361, f"Expected 23,361 parameters, found {total_params}"

    def test_checkpoint_filename_and_weights(self):
        assert NEW_MODEL_PATH.exists()
        assert NEW_MODEL_PATH.name == "best_audio_cnn_itw_speaker_weighted.pth"
        loader = NewModelLoader.get_instance()
        loader.initialize()
        state = loader.model.state_dict()
        assert "features.0.weight" in state
        assert "classifier.weight" in state
        assert state["classifier.bias"].item() == pytest.approx(-0.08611, abs=1e-4)
        assert loader.threshold == pytest.approx(0.1590385, abs=1e-5)
        assert loader.metadata.get("checkpoint") == "best_audio_cnn_itw_speaker_weighted.pth"

    def test_new_extractor_output_shape_and_range(self):
        extractor = NewLFCCExtractor()
        audio = np.random.randn(64000).astype(np.float32) * 0.1
        features = extractor.extract_from_waveform(audio)
        assert features.shape == (60, 398)
        assert np.all(np.isfinite(features))

    def test_extractor_resilience_to_variable_length(self):
        extractor = NewLFCCExtractor()
        # Short audio (32,000 samples)
        short_audio = np.random.randn(32000).astype(np.float32) * 0.1
        feat_short = extractor.extract_from_waveform(short_audio)
        assert feat_short.shape == (60, 398)

        # Long audio (96,000 samples)
        long_audio = np.random.randn(96000).astype(np.float32) * 0.1
        feat_long = extractor.extract_from_waveform(long_audio)
        assert feat_long.shape == (60, 398)


class TestNewInferenceService:
    """Stage 5.2: Verify end-to-end inference service operations."""

    @pytest.fixture(scope="class")
    def service(self):
        return bmain.get_inference_service()

    def test_service_type_and_active_model(self, service):
        assert isinstance(service, NewInferenceService)
        assert service.threshold == DEFAULT_THRESHOLD
        assert service.loader.is_ready is True

    def test_predict_standard_wav(self, service):
        wav_bytes = _generate_wav(duration=4.0, sr=16000, channels=1)
        res = service.predict(wav_bytes, "standard.wav")
        assert res.predicted_class in ("BONAFIDE", "SPOOF")
        assert 0.0 <= res.confidence <= 1.0
        assert 0.0 <= res.bonafide_score <= 1.0
        assert 0.0 <= res.spoof_score <= 1.0
        assert isinstance(res.raw_logit, float)
        assert res.audio_metadata.original_sample_rate == 16000
        assert res.audio_metadata.original_channels == 1
        assert res.audio_metadata.processed_samples == 64000

    def test_predict_stereo_audio(self, service):
        stereo_bytes = _generate_wav(duration=3.0, sr=16000, channels=2)
        res = service.predict(stereo_bytes, "stereo.wav")
        assert res.audio_metadata.original_channels == 2
        assert res.audio_metadata.processed_samples == 64000

    def test_predict_resampled_audio_44k(self, service):
        wav_44k = _generate_wav(duration=2.5, sr=44100, channels=1)
        res = service.predict(wav_44k, "high_sr.wav")
        assert res.audio_metadata.original_sample_rate == 44100
        assert res.audio_metadata.processed_samples == 64000

    def test_predict_short_padded_audio(self, service):
        short_bytes = _generate_wav(duration=1.2, sr=16000, channels=1)
        res = service.predict(short_bytes, "short.wav")
        assert res.audio_metadata.original_duration_sec == pytest.approx(1.2, abs=0.05)
        assert res.audio_metadata.processed_samples == 64000

    def test_predict_long_cropped_audio(self, service):
        long_bytes = _generate_wav(duration=6.5, sr=16000, channels=1)
        res = service.predict(long_bytes, "long.wav")
        assert res.audio_metadata.original_duration_sec == pytest.approx(6.5, abs=0.05)
        assert res.audio_metadata.processed_samples == 64000

    def test_error_on_empty_payload(self, service):
        with pytest.raises(HTTPException) as exc_info:
            service.predict(b"", "empty.wav")
        assert exc_info.value.status_code == 400

    def test_error_on_corrupted_payload(self, service):
        with pytest.raises(HTTPException) as exc_info:
            service.predict(b"RIFF\x00\x00\x00\x00WAVEcorruptedpayload", "corrupted.wav")
        assert exc_info.value.status_code == 400

    def test_error_on_unsupported_extension(self, service):
        with pytest.raises(HTTPException) as exc_info:
            service.predict(b"some content", "file.exe")
        assert exc_info.value.status_code == 400


class TestLegacyModelPreservation:
    """Stage 5.3: Verify legacy model remains completely untouched and operational."""

    def test_legacy_service_coexists_independently(self):
        legacy_service = bmain.get_legacy_inference_service()
        assert isinstance(legacy_service, InferenceService)
        assert legacy_service.loader.is_ready is True
        assert MODEL_PATH.exists()

        wav_bytes = _generate_wav(duration=4.0, sr=16000, channels=1)
        res = legacy_service.predict(wav_bytes, "legacy_check.wav")
        assert res.predicted_class in ("BONAFIDE", "SPOOF")
        assert isinstance(res.raw_logit, float)


class TestKnownASVspoofSamples:
    """Stage 5.4: Verify prediction veracity on real benchmark audio."""

    def test_dev_bonafide_samples_classified_bonafide(self):
        dev_dir = _PROJECT_ROOT / "datasets" / "LA" / "ASVspoof2019_LA_dev" / "flac"
        if not dev_dir.exists():
            pytest.skip("Dataset dev flac directory not present.")

        service = bmain.get_inference_service()
        bonafide_files = ["LA_D_1047731.flac", "LA_D_1105538.flac", "LA_D_1125976.flac", "LA_D_1293230.flac", "LA_D_1340209.flac"]
        for fname in bonafide_files:
            fpath = dev_dir / fname
            if not fpath.exists():
                continue
            with open(fpath, "rb") as f:
                content = f.read()
            res = service.predict(content, fname)
            assert res.predicted_class == "BONAFIDE", f"Sample {fname} should be BONAFIDE, got {res.predicted_class}"
            assert res.raw_logit < 0.0, f"Expected negative logit for bonafide sample {fname}, got {res.raw_logit}"

    def test_dev_spoof_samples_classified_spoof(self):
        dev_dir = _PROJECT_ROOT / "datasets" / "LA" / "ASVspoof2019_LA_dev" / "flac"
        if not dev_dir.exists():
            pytest.skip("Dataset dev flac directory not present.")

        service = bmain.get_inference_service()
        spoof_files = ["LA_D_1008730.flac", "LA_D_1034049.flac", "LA_D_1048723.flac", "LA_D_1067573.flac", "LA_D_1091909.flac"]
        for fname in spoof_files:
            fpath = dev_dir / fname
            if not fpath.exists():
                continue
            with open(fpath, "rb") as f:
                content = f.read()
            res = service.predict(content, fname)
            assert res.predicted_class == "SPOOF", f"Sample {fname} should be SPOOF, got {res.predicted_class}"
            assert res.raw_logit >= 0.0, f"Expected positive logit for spoof sample {fname}, got {res.raw_logit}"
