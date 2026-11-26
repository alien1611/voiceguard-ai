"""
VoiceGuard Backend Automated Test Suite
========================================
Comprehensive automated tests verifying all Phase 2 backend requirements:
1. Backend startup and model loading.
2. Health endpoint.
3. Model-info endpoint.
4. Valid WAV upload.
5. Stereo audio handling.
6. Audio with different sample rate (resampling to 16 kHz).
7. Short audio handling (padding).
8. Long audio handling (cropping).
9. Invalid file upload (unsupported extension / non-audio).
10. Corrupted audio upload (unparseable payload).
11. End-to-end prediction execution.
12. Output structure and numerical score ranges.
"""

import io
import sys
from pathlib import Path
from typing import Generator

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

# Ensure project root is on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Setup legacy namespace resolution
import tests.conftest  # noqa: F401

from backend.main import app
from backend.model_loader import ModelLoader


def _create_wav_bytes(
    duration_sec: float = 4.0,
    sample_rate: int = 16000,
    channels: int = 1,
    freq: float = 440.0,
) -> bytes:
    """Generate in-memory WAV file bytes."""
    n_samples = int(duration_sec * sample_rate)
    t = np.linspace(0, duration_sec, n_samples, endpoint=False)
    data = 0.5 * np.sin(2 * np.pi * freq * t).astype(np.float32)

    if channels > 1:
        data = np.stack([data] * channels, axis=1)

    buf = io.BytesIO()
    sf.write(buf, data, sample_rate, format="WAV")
    return buf.getvalue()


def _create_speech_wav_bytes(duration_sec: float = 3.5, sample_rate: int = 16000) -> bytes:
    """Generate in-memory multi-harmonic speech-like audio."""
    n_samples = int(duration_sec * sample_rate)
    t = np.linspace(0, duration_sec, n_samples, endpoint=False)
    f0 = 135.0
    waveform = np.zeros(n_samples, dtype=np.float32)
    for h in range(1, 12):
        waveform += (1.0 / h) * np.sin(2 * np.pi * (h * f0) * t).astype(np.float32)
    waveform = waveform / (np.max(np.abs(waveform)) + 1e-8) * 0.7

    buf = io.BytesIO()
    sf.write(buf, waveform, sample_rate, format="WAV")
    return buf.getvalue()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    """TestClient that triggers the application lifespan startup and shutdown."""
    with TestClient(app) as test_client:
        yield test_client


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

class TestBackendStartupAndDiagnostics:
    """Tests 1, 2, 3: Startup, Health, and Model Info."""

    def test_01_startup_and_model_loading(self, client: TestClient):
        """Verify model loader singleton initialized and model is in eval mode."""
        loader = ModelLoader.get_instance()
        assert loader.is_ready is True
        assert loader.model is not None
        assert loader.extractor is not None
        assert loader.mean is not None and loader.std is not None
        assert loader.model.training is False, "Model must be in evaluation mode"

    def test_02_health_endpoint(self, client: TestClient):
        """GET /api/health returns HTTP 200 with healthy status and device."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["model_loaded"] is True
        assert data["device"] in ("cpu", "cuda")
        assert data["uptime_seconds"] >= 0.0

    def test_03_model_info_endpoint(self, client: TestClient):
        """GET /api/model-info returns architectural specs and expected shape."""
        response = client.get("/api/model-info")
        assert response.status_code == 200
        data = response.json()
        assert "AudioCNN" in data["model_name"]
        assert "60-Coefficient LFCC" in data["feature_extractor"]
        assert data["input_shape"] == [1, 1, 60, 398]
        assert data["target_sample_rate_hz"] == 16000
        assert data["target_duration_sec"] == 4.0
        assert data["decision_threshold"] == pytest.approx(0.159, abs=0.01)
        assert data["classes"]["0"] == "BONAFIDE"
        assert data["classes"]["1"] == "SPOOF"


class TestAudioIngestionVariants:
    """Tests 4-10: File handling, codecs, resampling, padding, and error validation."""

    def test_04_valid_wav_upload(self, client: TestClient):
        """POST /api/predict with standard 4-second 16 kHz mono WAV."""
        audio_bytes = _create_wav_bytes(duration_sec=4.0, sample_rate=16000, channels=1)
        response = client.post(
            "/api/predict",
            files={"file": ("test_voice.wav", audio_bytes, "audio/wav")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["predicted_class"] in ("BONAFIDE", "SPOOF")
        assert data["audio_metadata"]["original_sample_rate"] == 16000
        assert data["audio_metadata"]["original_channels"] == 1
        assert data["audio_metadata"]["processed_samples"] == 64000

    def test_05_stereo_audio_handling(self, client: TestClient):
        """Stereo audio is correctly downmixed to mono and processed."""
        stereo_bytes = _create_wav_bytes(duration_sec=3.0, sample_rate=16000, channels=2)
        response = client.post(
            "/api/predict",
            files={"file": ("stereo_sample.wav", stereo_bytes, "audio/wav")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["audio_metadata"]["original_channels"] == 2
        assert data["audio_metadata"]["processed_samples"] == 64000

    def test_06_different_sample_rate_resampling(self, client: TestClient):
        """Audio sampled at 44.1 kHz, 48 kHz, or 8 kHz is cleanly resampled to 16 kHz."""
        for orig_sr in (44100, 48000, 8000):
            resampled_bytes = _create_wav_bytes(duration_sec=3.0, sample_rate=orig_sr, channels=1)
            response = client.post(
                "/api/predict",
                files={"file": (f"audio_{orig_sr}.wav", resampled_bytes, "audio/wav")}
            )
            assert response.status_code == 200, f"Failed on sample rate {orig_sr}"
            data = response.json()
            assert data["audio_metadata"]["original_sample_rate"] == orig_sr
            assert data["audio_metadata"]["processed_samples"] == 64000

    def test_07_short_audio_padding(self, client: TestClient):
        """Audio shorter than 4 seconds (1.2 s) is padded to 64,000 samples."""
        short_bytes = _create_wav_bytes(duration_sec=1.2, sample_rate=16000, channels=1)
        response = client.post(
            "/api/predict",
            files={"file": ("short_sample.wav", short_bytes, "audio/wav")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["audio_metadata"]["original_duration_sec"] == 1.2
        assert data["audio_metadata"]["processed_samples"] == 64000

    def test_08_long_audio_cropping(self, client: TestClient):
        """Audio longer than 4 seconds (7.5 s) is cropped to 64,000 samples."""
        long_bytes = _create_wav_bytes(duration_sec=7.5, sample_rate=16000, channels=1)
        response = client.post(
            "/api/predict",
            files={"file": ("long_sample.wav", long_bytes, "audio/wav")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["audio_metadata"]["original_duration_sec"] == 7.5
        assert data["audio_metadata"]["processed_samples"] == 64000

    def test_09_invalid_file_upload(self, client: TestClient):
        """Reject non-audio file extensions (e.g., text or PDF) with HTTP 400."""
        text_bytes = b"Hello, this is plain text, not an audio file."
        response = client.post(
            "/api/predict",
            files={"file": ("notes.txt", text_bytes, "text/plain")}
        )
        assert response.status_code == 400
        assert "Unsupported file extension" in response.json()["detail"]

    def test_10_corrupted_audio_upload(self, client: TestClient):
        """Reject unparseable/corrupted audio bytes with HTTP 400."""
        corrupted_bytes = b"RIFF\x00\x00\x00\x00WAVEfmt \x10\x00\x00\x00CORRUPT_HEADER_GARBAGE"
        response = client.post(
            "/api/predict",
            files={"file": ("broken_audio.wav", corrupted_bytes, "audio/wav")}
        )
        assert response.status_code == 400
        assert "Could not decode audio file" in response.json()["detail"]


class TestEndToEndPredictionAndOutputs:
    """Tests 11, 12: End-to-end inference and numerical range validation."""

    def test_11_end_to_end_prediction_execution(self, client: TestClient):
        """Verify full end-to-end pipeline execution on synthetic speech recording."""
        speech_bytes = _create_speech_wav_bytes(duration_sec=4.0, sample_rate=16000)
        response = client.post(
            "/api/predict",
            files={"file": ("speech_utterance.wav", speech_bytes, "audio/wav")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["predicted_class"] in ("BONAFIDE", "SPOOF")
        assert data["processing_time_ms"] > 0.0
        assert data["model_status"] == "operational"

    def test_12_correct_output_structure_and_score_ranges(self, client: TestClient):
        """Verify score bounds: 0 <= score <= 1, bonafide + spoof == 1.0, confidence consistency."""
        test_bytes = _create_speech_wav_bytes(duration_sec=3.2, sample_rate=16000)
        response = client.post(
            "/api/predict",
            files={"file": ("evaluation.wav", test_bytes, "audio/wav")}
        )
        assert response.status_code == 200
        data = response.json()

        # Score range assertions
        assert 0.0 <= data["confidence"] <= 1.0
        assert 0.0 <= data["bonafide_score"] <= 1.0
        assert 0.0 <= data["spoof_score"] <= 1.0

        # Mathematical complementarity
        assert abs((data["bonafide_score"] + data["spoof_score"]) - 1.0) < 1e-3

        # Confidence logic consistency
        if data["predicted_class"] == "SPOOF":
            assert data["confidence"] == data["spoof_score"]
            assert data["spoof_score"] >= data["threshold"]
        else:
            assert data["confidence"] == data["bonafide_score"]
            assert data["spoof_score"] < data["threshold"]

        # Ensure disclaimer is present
        assert "disclaimer" in data
        assert len(data["disclaimer"]) > 20


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING VOICEGUARD BACKEND AUTOMATED TEST SUITE")
    print("=" * 60)

    with TestClient(app) as test_client:
        diag = TestBackendStartupAndDiagnostics()
        diag.test_01_startup_and_model_loading(test_client)
        print("[PASS] Test 1: Startup & Model Loading")
        diag.test_02_health_endpoint(test_client)
        print("[PASS] Test 2: Health Endpoint")
        diag.test_03_model_info_endpoint(test_client)
        print("[PASS] Test 3: Model Info Endpoint")

        ingest = TestAudioIngestionVariants()
        ingest.test_04_valid_wav_upload(test_client)
        print("[PASS] Test 4: Valid WAV Upload")
        ingest.test_05_stereo_audio_handling(test_client)
        print("[PASS] Test 5: Stereo Audio Handling")
        ingest.test_06_different_sample_rate_resampling(test_client)
        print("[PASS] Test 6: Different Sample Rate Resampling")
        ingest.test_07_short_audio_padding(test_client)
        print("[PASS] Test 7: Short Audio Zero-Padding")
        ingest.test_08_long_audio_cropping(test_client)
        print("[PASS] Test 8: Long Audio Cropping")
        ingest.test_09_invalid_file_upload(test_client)
        print("[PASS] Test 9: Invalid File Rejection")
        ingest.test_10_corrupted_audio_upload(test_client)
        print("[PASS] Test 10: Corrupted Audio Rejection")

        e2e = TestEndToEndPredictionAndOutputs()
        e2e.test_11_end_to_end_prediction_execution(test_client)
        print("[PASS] Test 11: End-to-End Prediction Execution")
        e2e.test_12_correct_output_structure_and_score_ranges(test_client)
        print("[PASS] Test 12: Output Structure & Score Range Consistency")

    print("\n" + "=" * 60)
    print("ALL 12 BACKEND TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)
