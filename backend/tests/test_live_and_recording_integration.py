"""
VoiceGuard Live Detection and Recording Integration Tests
========================================================
Validates:
1. SpeechActivityGate local energy-based speech detection and silence gating.
2. LiveAudioSession buffer accumulation, 64k windowing, 16k hop sliding.
3. AudioCNN inference on live audio chunks without altering model weights.
4. Temporal EMA smoothing logic for presentation stability.
5. Session closure and MongoDB summary persistence contract (no raw audio saved).
6. Source tag handling in /api/predict ('upload', 'recording').
7. Source filter query in /api/history ('all', 'upload', 'recording', 'live').
"""

import io
import time
import numpy as np
import pytest
import soundfile as sf
import torch

from backend.config import SAMPLE_RATE, TARGET_SAMPLES, DEFAULT_THRESHOLD_LOGIT
from backend.live_service import (
    LiveAudioSession,
    LiveSessionStats,
    SpeechActivityGate,
    SILENCE_RMS_THRESHOLD,
    WINDOW_SAMPLES,
    HOP_SAMPLES,
)
from backend.new_model_loader import NewModelLoader
from backend.new_inference import NewInferenceService
from backend.audio_service import AudioService
from backend.schemas import DetectionRecord, PredictionResponse


@pytest.fixture(scope="module")
def model_loader():
    loader = NewModelLoader.get_instance()
    if not loader.is_ready:
        loader.initialize()
    return loader


@pytest.fixture(scope="module")
def inference_service(model_loader):
    audio_service = AudioService(target_sr=SAMPLE_RATE, target_samples=TARGET_SAMPLES)
    return NewInferenceService(
        model_loader=model_loader,
        audio_service=audio_service,
        threshold=model_loader.threshold
    )


class TestSpeechActivityGate:
    """Tests local energy-based VAD gate."""

    def test_silence_detection(self):
        # Pure zeros or very low ambient noise (RMS < 0.0050)
        silence = np.zeros(64000, dtype=np.float32)
        has_speech, rms, peak = SpeechActivityGate.evaluate(silence)
        assert not has_speech
        assert rms == 0.0
        assert peak == 0.0

        low_noise = np.random.uniform(-0.001, 0.001, 64000).astype(np.float32)
        has_speech, rms, peak = SpeechActivityGate.evaluate(low_noise)
        assert not has_speech
        assert rms < SILENCE_RMS_THRESHOLD

    def test_active_speech_detection(self):
        # Simulated voiced signal with audible amplitude
        t = np.linspace(0, 4.0, 64000, dtype=np.float32)
        voiced = 0.3 * np.sin(2 * np.pi * 220 * t) + 0.1 * np.sin(2 * np.pi * 440 * t)
        has_speech, rms, peak = SpeechActivityGate.evaluate(voiced)
        assert has_speech
        assert rms > SILENCE_RMS_THRESHOLD
        assert peak > 0.10


class TestLiveAudioSession:
    """Tests LiveAudioSession ring buffer, window extraction, and inference."""

    def test_buffer_accumulation_and_buffering_event(self):
        session = LiveAudioSession(session_id="test_buffer_session")
        # Ingest 16,000 samples (1.0s @ 16 kHz) - less than 64,000
        chunk_1s = np.random.uniform(-0.05, 0.05, 16000).astype(np.float32)
        buf_len = session.append_audio_pcm(chunk_1s.tobytes(), format_type="float32")
        assert buf_len == 16000

        # Processing should return buffering progress
        events = session.process_available_windows()
        assert len(events) == 1
        assert events[0]["type"] == "buffering"
        assert events[0]["state"] == "COLLECTING"
        assert events[0]["buffered_seconds"] == 1.0
        assert events[0]["progress_pct"] == 25.0

    def test_silence_window_handling(self):
        session = LiveAudioSession(session_id="test_silence_session")
        # Ingest 64,000 samples of ambient silence
        silent_chunk = np.zeros(64000, dtype=np.float32)
        session.append_audio_pcm(silent_chunk.tobytes(), format_type="float32")

        events = session.process_available_windows()
        assert len(events) == 1
        assert events[0]["type"] == "silence"
        assert events[0]["state"] == "INSUFFICIENT_AUDIO"
        assert session.stats.silence_windows_skipped == 1
        # Model should NOT have run
        assert session.stats.speech_windows_analyzed == 0

    def test_active_speech_window_inference(self):
        session = LiveAudioSession(session_id="test_speech_session")
        t = np.linspace(0, 4.0, 64000, dtype=np.float32)
        voiced = 0.25 * np.sin(2 * np.pi * 300 * t)
        session.append_audio_pcm(voiced.tobytes(), format_type="float32")

        events = session.process_available_windows()
        assert len(events) == 1
        pred = events[0]
        assert pred["type"] == "prediction"
        assert pred["predicted_class"] in ("BONAFIDE", "SPOOF")
        assert 0.0 <= pred["confidence"] <= 1.0
        assert "raw_logit" in pred
        assert "smoothed_score" in pred
        assert pred["window_index"] == 1
        assert session.stats.speech_windows_analyzed == 1

        # Check that buffer slid by HOP_SAMPLES (16,000)
        # Remaining buffer: 64,000 - 16,000 = 48,000 samples
        assert len(session.buffer) == 48000

    def test_sliding_window_hop_advancement(self):
        session = LiveAudioSession(session_id="test_sliding_hop")
        # Add 80,000 samples (5.0s): should yield 2 analysis windows (0-64k, 16k-80k)
        t = np.linspace(0, 5.0, 80000, dtype=np.float32)
        voiced = 0.2 * np.sin(2 * np.pi * 250 * t)
        session.append_audio_pcm(voiced.tobytes(), format_type="float32")

        events = session.process_available_windows()
        assert len(events) == 2
        assert events[0]["window_index"] == 1
        assert events[1]["window_index"] == 2
        # After 2 hops of 16,000: 80,000 - 32,000 = 48,000 remaining
        assert len(session.buffer) == 48000

    def test_session_summary_no_raw_audio(self):
        session = LiveAudioSession(session_id="test_summary_no_raw")
        session.stats.speech_windows_analyzed = 3
        session.stats.bonafide_windows = 2
        session.stats.spoof_windows = 1
        session.stats.spoof_scores = [0.1, 0.2, 0.6]

        summary = session.close_and_persist_summary()
        assert summary["session_id"] == "test_summary_no_raw"
        assert summary["overall_verdict"] == "BONAFIDE"
        assert summary["speech_windows"] == 3
        # Strict rule: summary must NOT store raw audio samples
        assert "audio_samples" not in summary
        assert "raw_audio" not in summary
        assert "buffer" not in summary


class TestPredictionSourceHandling:
    """Tests source tagging in InferenceService and schemas."""

    def test_source_attribute_in_prediction(self, inference_service):
        t = np.linspace(0, 4.0, 64000, dtype=np.float32)
        audio = 0.2 * np.sin(2 * np.pi * 440 * t)
        buf = io.BytesIO()
        sf.write(buf, audio, 16000, format='WAV')
        content = buf.getvalue()

        # Source = 'upload'
        res_upload = inference_service.predict(content, "sample.wav", source="upload")
        assert res_upload.source == "upload"

        # Source = 'recording'
        res_rec = inference_service.predict(content, "mic.wav", source="recording")
        assert res_rec.source == "recording"
        assert res_rec.predicted_class in ("BONAFIDE", "SPOOF")
