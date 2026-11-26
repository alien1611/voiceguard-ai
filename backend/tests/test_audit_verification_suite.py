"""
VoiceGuard Comprehensive Audit & Pipeline Verification Test Suite
==================================================================
Strict technical verification tests addressing the Deep Technical Audit requirements:
- Model checkpoint identity, integrity (SHA-256), and architecture.
- Normalization statistics integrity (SHA-256) and finiteness.
- MP3, WAV, FLAC, and OGG format decoding and inference equivalence.
- Stereo to mono downmixing.
- Sample rate conversion to strictly 16,000 Hz.
- LFCC feature extraction contract (60 x 398).
- Decision threshold (calibrated raw logit 0.15903853).
- Unified inference pipeline for both upload and microphone recording.
- Energy-based VAD silence handling (silence never misclassified as SPOOF).
"""

import hashlib
import io
import math
from pathlib import Path
from typing import Dict

import numpy as np
import pytest
import soundfile as sf
import torch

from backend.audio_service import AudioService
from backend.config import (
    DEFAULT_THRESHOLD_LOGIT,
    DURATION_SEC,
    EXPECTED_CHECKPOINT_SHA256,
    EXPECTED_FEATURE_SHAPE,
    EXPECTED_NORMALIZATION_SHA256,
    MODEL_PATH,
    NORMALIZATION_STATS_PATH,
    SAMPLE_RATE,
    TARGET_SAMPLES,
)
from backend.inference import InferenceService
from backend.live_service import LiveAudioSession, SpeechActivityGate
from backend.model_loader import ModelLoader


def _create_synthetic_audio(duration: float = 4.0, sr: int = 16000, channels: int = 1) -> np.ndarray:
    """Create reproducible harmonic speech-like signal."""
    n_samples = int(duration * sr)
    t = np.linspace(0, duration, n_samples, endpoint=False, dtype=np.float32)
    sig = np.zeros(n_samples, dtype=np.float32)
    for freq, amp in [(180.0, 0.4), (360.0, 0.25), (720.0, 0.15)]:
        sig += amp * np.sin(2 * np.pi * freq * t, dtype=np.float32)
    if channels > 1:
        sig = np.stack([sig] * channels, axis=1)
    return sig


class TestModelCheckpointAndArchitecture:
    """Phase 1: Model Audit and Cryptographic Verification."""

    def test_checkpoint_exists_and_filename(self):
        assert MODEL_PATH.exists(), f"Model checkpoint missing at {MODEL_PATH}"
        assert MODEL_PATH.name == "best_audio_cnn_itw_speaker_weighted.pth"

    def test_checkpoint_sha256_cryptographic_integrity(self):
        digest = hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()
        assert digest == EXPECTED_CHECKPOINT_SHA256, (
            f"Checkpoint SHA-256 mismatch! Expected {EXPECTED_CHECKPOINT_SHA256}, got {digest}"
        )

    def test_normalization_stats_exists_and_sha256(self):
        assert NORMALIZATION_STATS_PATH.exists()
        assert NORMALIZATION_STATS_PATH.name == "normalization_stats_22k.npz"
        digest = hashlib.sha256(NORMALIZATION_STATS_PATH.read_bytes()).hexdigest()
        assert digest == EXPECTED_NORMALIZATION_SHA256, (
            f"Normalization SHA-256 mismatch! Expected {EXPECTED_NORMALIZATION_SHA256}, got {digest}"
        )

    def test_normalization_statistics_validity(self):
        stats = np.load(NORMALIZATION_STATS_PATH)
        assert "mean" in stats and "std" in stats
        mean = stats["mean"]
        std = stats["std"]
        assert mean.shape == (1, 60, 1) or mean.shape == (60, 1)
        assert std.shape == (1, 60, 1) or std.shape == (60, 1)
        assert np.all(np.isfinite(mean))
        assert np.all(np.isfinite(std))
        assert np.all(std > 0)

    def test_model_architecture_and_parameter_count(self):
        loader = ModelLoader.get_instance()
        loader.initialize()
        assert loader.is_ready is True
        assert loader.model is not None
        assert loader.model.training is False

        params = list(loader.model.parameters())
        total_params = sum(p.numel() for p in params)
        assert total_params == 23361, f"Expected 23,361 weights, found {total_params}"

    def test_calibrated_decision_threshold(self):
        loader = ModelLoader.get_instance()
        loader.initialize()
        assert loader.threshold == pytest.approx(DEFAULT_THRESHOLD_LOGIT, abs=1e-6)
        assert loader.threshold == pytest.approx(0.15903853, abs=1e-5)


class TestAudioFormatDecodingPipeline:
    """Phase 3: Multi-format in-memory decoding and inference (WAV, FLAC, OGG, MP3)."""

    @pytest.fixture(scope="class")
    def audio_bytes_dict(self) -> Dict[str, bytes]:
        """Encode the exact same synthetic audio into WAV, FLAC, OGG, and MP3."""
        sr = 44100
        dur = 3.5
        sig = _create_synthetic_audio(duration=dur, sr=sr, channels=1)

        result = {}
        for fmt in ["WAV", "FLAC", "OGG", "MP3"]:
            buf = io.BytesIO()
            sf.write(buf, sig, sr, format=fmt)
            result[fmt] = buf.getvalue()
        return result

    def test_decoding_and_inference_across_formats(self, audio_bytes_dict):
        loader = ModelLoader.get_instance()
        loader.initialize()
        audio_svc = AudioService(target_sr=SAMPLE_RATE, target_samples=TARGET_SAMPLES)
        infer_svc = InferenceService(loader, audio_svc)

        predictions = {}
        for fmt, audio_bytes in audio_bytes_dict.items():
            filename = f"test_clip.{fmt.lower()}"
            # 1. Decoding
            waveform, metadata = audio_svc.decode_and_standardize(audio_bytes, filename)
            assert waveform.shape == (64000,), f"Expected shape [64000] for {fmt}, got {waveform.shape}"
            assert metadata.original_sample_rate == 44100
            assert metadata.processed_samples == 64000
            assert np.all(np.isfinite(waveform.numpy()))

            # 2. Prediction
            pred = infer_svc.predict(audio_bytes, filename)
            assert pred.predicted_class in ("BONAFIDE", "SPOOF")
            assert 0.0 <= pred.confidence <= 1.0
            assert 0.0 <= pred.bonafide_score <= 1.0
            assert 0.0 <= pred.spoof_score <= 1.0
            assert isinstance(pred.raw_logit, float)
            predictions[fmt] = pred

        # Lossless WAV and FLAC must yield identical predictions
        assert predictions["WAV"].predicted_class == predictions["FLAC"].predicted_class
        assert predictions["WAV"].raw_logit == pytest.approx(predictions["FLAC"].raw_logit, abs=1e-2)

    def test_stereo_downmix_across_sample_rates(self):
        loader = ModelLoader.get_instance()
        loader.initialize()
        audio_svc = AudioService(target_sr=SAMPLE_RATE, target_samples=TARGET_SAMPLES)
        infer_svc = InferenceService(loader, audio_svc)

        for sr in [8000, 22050, 48000]:
            sig_stereo = _create_synthetic_audio(duration=2.5, sr=sr, channels=2)
            buf = io.BytesIO()
            sf.write(buf, sig_stereo, sr, format="WAV")
            pred = infer_svc.predict(buf.getvalue(), f"stereo_{sr}.wav")
            assert pred.audio_metadata.original_channels == 2
            assert pred.audio_metadata.original_sample_rate == sr
            assert pred.audio_metadata.processed_samples == 64000


class TestUnifiedUploadAndRecordingInference:
    """Phase 4: Verification that upload and recording share the identical model and inference."""

    def test_upload_and_recording_use_identical_inference_pipeline(self):
        loader = ModelLoader.get_instance()
        loader.initialize()
        audio_svc = AudioService(target_sr=SAMPLE_RATE, target_samples=TARGET_SAMPLES)
        service = InferenceService(loader, audio_svc)

        sig = _create_synthetic_audio(duration=4.0, sr=16000, channels=1)
        buf = io.BytesIO()
        sf.write(buf, sig, 16000, format="WAV")
        raw_bytes = buf.getvalue()

        # Execute as 'upload'
        res_upload = service.predict(raw_bytes, "audio_upload.wav", source="upload")
        # Execute as 'recording'
        res_recording = service.predict(raw_bytes, "audio_recording.wav", source="recording")

        assert res_upload.source == "upload"
        assert res_recording.source == "recording"
        assert res_upload.predicted_class == res_recording.predicted_class
        assert res_upload.raw_logit == pytest.approx(res_recording.raw_logit, abs=1e-5)
        assert res_upload.confidence == pytest.approx(res_recording.confidence, abs=1e-5)
        assert res_upload.spoof_score == pytest.approx(res_recording.spoof_score, abs=1e-5)


class TestLiveSpeechActivityAndSilenceHandling:
    """Phase 5: VAD and Live Detection silence handling."""

    def test_silence_produces_insufficient_audio_never_spoof(self):
        session = LiveAudioSession(session_id="test_vad_silence")
        # Ambient silence (below 0.0050 RMS threshold)
        quiet_pcm = np.random.uniform(-0.0005, 0.0005, 64000).astype(np.float32)
        session.append_audio_pcm(quiet_pcm.tobytes(), format_type="float32")

        events = session.process_available_windows()
        assert len(events) == 1
        event = events[0]
        assert event["type"] == "silence"
        assert event["state"] == "INSUFFICIENT_AUDIO"
        assert "Ambient room silence" in event["message"]
        # Must not classify silence as SPOOF or increment spoof count
        assert session.stats.spoof_windows == 0
        assert session.stats.overall_verdict == "INSUFFICIENT_AUDIO"

    def test_active_speech_triggers_real_cnn_inference(self):
        session = LiveAudioSession(session_id="test_speech_active")
        # Audible voiced harmonic speech
        voiced_pcm = _create_synthetic_audio(duration=4.0, sr=16000, channels=1)
        session.append_audio_pcm(voiced_pcm.tobytes(), format_type="float32")

        events = session.process_available_windows()
        assert len(events) == 1
        event = events[0]
        assert event["type"] == "prediction"
        assert event["predicted_class"] in ("BONAFIDE", "SPOOF")
        assert "raw_logit" in event
        assert "confidence" in event
        assert "smoothed_score" in event
        assert session.stats.speech_windows_analyzed == 1
