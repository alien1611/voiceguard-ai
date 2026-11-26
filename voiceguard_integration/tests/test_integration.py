import json
import math
from threading import Event
from pathlib import Path
import sys
import tempfile
from types import ModuleType
import unittest
from unittest.mock import patch

import numpy as np
import soundfile as sf

from voiceguard import (
    AlertType,
    AudioFormatError,
    AudioProcessor,
    AudioQuality,
    AudioValidationError,
    MicrophoneRunner,
    PredictionResult,
    PredictionSmoother,
    RiskAssessment,
    RiskConfig,
    RiskEngine,
    RiskLevel,
    SmoothingConfig,
    VoiceGuardDetector,
)
from voiceguard.alert_manager import AlertManager
from voiceguard.config import VoiceGuardConfig
from voiceguard.model_loader import ModelLoader, sha256_file
from voiceguard.prevention_policy import PreventionPolicy


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = PACKAGE_ROOT / "models"


class VoiceGuardIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        config = VoiceGuardConfig(model_dir=MODEL_DIR, device="cpu")
        cls.detector = VoiceGuardDetector(config, ModelLoader(config).load())

    def test_artifacts_match_metadata_and_threshold(self):
        metadata = self.detector.model_metadata
        self.assertEqual(
            sha256_file(MODEL_DIR / metadata["checkpoint"]),
            metadata["checkpoint_sha256"],
        )
        self.assertEqual(
            sha256_file(MODEL_DIR / metadata["normalization_stats"]),
            metadata["normalization_stats_sha256"],
        )
        self.assertAlmostEqual(self.detector.threshold, 0.15903852880001068, places=8)
        default_detector = VoiceGuardDetector.from_config(device="cpu")
        self.assertEqual(default_detector.threshold, self.detector.threshold)

    def test_wav_resampling_padding_and_invalid_file(self):
        processor = AudioProcessor()
        source = np.full(16000, 0.1, dtype=np.float32)
        with tempfile.TemporaryDirectory() as temporary:
            wav_path = Path(temporary) / "short.wav"
            sf.write(wav_path, source, 8000, subtype="FLOAT")
            prepared, quality = processor.prepare_file(wav_path)
            self.assertEqual(prepared.shape, (64000,))
            self.assertEqual(quality.sample_rate, 8000)
            self.assertAlmostEqual(quality.duration_seconds, 2.0, places=3)
            self.assertTrue(np.all(prepared[32000:] == 0))

            invalid_path = Path(temporary) / "broken.wav"
            invalid_path.write_bytes(b"not audio")
            with self.assertRaises(AudioFormatError):
                processor.prepare_file(invalid_path)

    def test_raw_pcm_and_lfcc_dimensions(self):
        processor = AudioProcessor()
        decoded = processor.decode_raw_pcm(
            np.asarray([0, 32767, -32768], dtype="<i2").tobytes(),
            16000,
            1,
            "int16",
        )
        self.assertEqual(decoded.shape, (3, 1))
        with self.assertRaises(AudioValidationError):
            processor.decode_raw_pcm(b"\x00", 16000, 1, "int16")
        result = self.detector.predict_audio(np.zeros(64000, dtype=np.float32), 16000)
        self.assertEqual(tuple(result.feature_shape), (60, 398))

    def test_prediction_output_is_serializable(self):
        result = self.detector.predict_audio(np.zeros(64000, dtype=np.float32), 16000)
        output = result.to_dict()
        self.assertIn(output["label"], {"BONAFIDE", "SPOOF"})
        self.assertIn("not a probability", output["score_semantics"])
        self.assertEqual(output["threshold"], self.detector.threshold)
        json.dumps(output)

    def test_smoothing_persistence_and_hysteresis(self):
        smoother = PredictionSmoother(
            0.0,
            SmoothingConfig(
                window_size=3,
                ema_alpha=1.0,
                minimum_predictions=2,
                hysteresis_margin=0.01,
                alert_persistence=2,
            ),
            1.0,
        )
        first = smoother.update(1.0)
        second = smoother.update(1.0)
        self.assertTrue(first.raw_suspicious)
        self.assertFalse(first.spoof_state)
        self.assertTrue(second.stable_assessment)
        self.assertTrue(second.spoof_state)
        self.assertEqual(second.suspicious_duration_seconds, 2.0)
        cleared = smoother.update(-2.0)
        self.assertFalse(cleared.spoof_state)

    def test_risk_policy_alert_and_verification(self):
        engine = RiskEngine(RiskConfig())
        quality = AudioQuality(status="OK")
        for score, count, expected in (
            (0.2, 0, RiskLevel.LOW),
            (0.6, 1, RiskLevel.MEDIUM),
            (0.8, 1, RiskLevel.HIGH),
            (0.95, 3, RiskLevel.CRITICAL),
        ):
            logit = math.log(score / (1.0 - score))
            assessment = engine.assess(
                raw_logit=logit,
                raw_score=score,
                smoothed_score=score,
                threshold_logit=self.detector.threshold,
                suspicious_consecutive_windows=count,
                suspicious_duration_seconds=float(count),
                stable_assessment=True,
                audio_quality=quality,
            )
            self.assertEqual(assessment.risk_level, expected)

        critical = engine.assess(
            raw_logit=3.0,
            raw_score=0.95,
            smoothed_score=0.92,
            threshold_logit=self.detector.threshold,
            suspicious_consecutive_windows=3,
            suspicious_duration_seconds=3.0,
            stable_assessment=True,
            audio_quality=quality,
        )
        self.assertEqual(critical.risk_level, RiskLevel.CRITICAL)
        quality_limited = engine.assess(
            raw_logit=3.0,
            raw_score=0.95,
            smoothed_score=0.92,
            threshold_logit=self.detector.threshold,
            suspicious_consecutive_windows=3,
            suspicious_duration_seconds=3.0,
            stable_assessment=True,
            audio_quality=AudioQuality(
                status="WARNING", warnings=("possible clipping",)
            ),
        )
        self.assertEqual(quality_limited.risk_level, RiskLevel.HIGH)
        self.assertIn("quality warnings", quality_limited.reason)
        prediction = PredictionResult(
            label="SPOOF",
            predicted_label=1,
            raw_logit=3.0,
            spoof_score=0.95,
            threshold=self.detector.threshold,
            timestamp="2026-01-01T00:00:00+00:00",
            inference_time_ms=2.0,
            audio_quality=quality,
            risk=critical,
            smoothed_score=0.92,
            moving_average_score=0.92,
            stable_assessment=True,
            suspicious_consecutive_windows=3,
            session_id="alert-test",
        )
        manager = AlertManager()
        self.assertEqual(
            manager.started("alert-test").event_type,
            AlertType.AUDIO_ANALYSIS_STARTED,
        )
        events = manager.update(prediction)
        self.assertEqual(events[0].event_type, AlertType.HIGH_RISK_AUDIO_DETECTED)
        self.assertEqual(events[0].model_threshold, self.detector.threshold)
        recommendation = PreventionPolicy().recommend(RiskLevel.CRITICAL)
        self.assertFalse(recommendation.irreversible_actions_authorized)

    def test_file_chunk_parity_session_isolation_and_lifecycle(self):
        samples = np.random.default_rng(42).normal(0, 0.1, 64000).astype(np.float32)
        with tempfile.TemporaryDirectory() as temporary:
            wav_path = Path(temporary) / "four-seconds.wav"
            sf.write(wav_path, samples, 16000, subtype="FLOAT")
            offline = self.detector.predict_file(wav_path)

        self.detector.start_session("one", sample_rate=16000)
        self.detector.start_session("two", sample_rate=16000)
        result_one = self.detector.process_audio_chunk(
            samples, 16000, session_id="one"
        )
        result_two = self.detector.process_audio_chunk(
            np.zeros(64000, dtype=np.float32), 16000, session_id="two"
        )
        self.assertEqual(result_one.status, "ANALYZED")
        self.assertEqual(result_two.status, "ANALYZED")
        self.assertEqual(len(result_one.predictions), 1)
        self.assertAlmostEqual(
            result_one.latest.raw_logit, offline.raw_logit, places=5
        )
        self.assertNotEqual(
            result_one.latest.raw_logit, result_two.latest.raw_logit
        )
        self.assertEqual(
            self.detector.stop_session("one")[0].event_type,
            AlertType.AUDIO_ANALYSIS_STOPPED,
        )
        self.detector.stop_session("two")

    def test_chunk_error_does_not_break_other_sessions(self):
        self.detector.start_session("bad-rate", sample_rate=16000)
        self.detector.start_session("healthy", sample_rate=16000)
        self.detector.process_audio_chunk(
            np.zeros(8000, dtype=np.float32), 16000, session_id="bad-rate"
        )
        failed = self.detector.process_audio_chunk(
            np.zeros(8000, dtype=np.float32), 8000, session_id="bad-rate"
        )
        self.assertEqual(failed.error_type, "SessionError")
        healthy = self.detector.process_audio_chunk(
            np.zeros(64000, dtype=np.float32), 16000, session_id="healthy"
        )
        self.assertEqual(healthy.status, "ANALYZED")
        self.detector.stop_session("bad-rate")
        self.detector.stop_session("healthy")

    def test_microphone_adapter_flushes_and_saves_raw_wav(self):
        stop_event = Event()
        predictions = []
        events = []
        sounddevice = ModuleType("sounddevice")
        sounddevice.query_devices = lambda device=None, kind=None: {
            "default_samplerate": 16000
        }

        class FakeInputStream:
            active = True

            def __init__(self, *, callback, **kwargs):
                self.callback = callback

            def __enter__(self):
                block = np.full((1024, 1), 0.01, dtype=np.float32)
                for _ in range(64):
                    self.callback(block, len(block), None, None)
                stop_event.set()
                return self

            def __exit__(self, exc_type, exc_value, traceback):
                self.active = False

        sounddevice.InputStream = FakeInputStream
        with tempfile.TemporaryDirectory() as temporary:
            recording = Path(temporary) / "capture.wav"
            with patch.dict(sys.modules, {"sounddevice": sounddevice}):
                stats = MicrophoneRunner(self.detector).run(
                    session_id="mock-mic",
                    stop_event=stop_event,
                    save_recording=recording,
                    on_prediction=predictions.append,
                    on_event=events.append,
                )
            samples, sample_rate = sf.read(recording, dtype="float32", always_2d=True)
            self.assertEqual(sample_rate, 16000)
            self.assertEqual(samples.shape, (65536, 1))
            self.assertEqual(stats["recorded_frames"], 65536)
            self.assertEqual(len(predictions), 1)
            self.assertEqual(events[0].event_type, AlertType.AUDIO_ANALYSIS_STARTED)
            self.assertEqual(events[-1].event_type, AlertType.AUDIO_ANALYSIS_STOPPED)
            offline = self.detector.predict_file(recording)
            self.assertAlmostEqual(predictions[0].raw_logit, offline.raw_logit, places=5)


if __name__ == "__main__":
    unittest.main()
