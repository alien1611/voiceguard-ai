"""
VoiceGuard Live Streaming Audio Verification Engine
===================================================
Manages real-time microphone audio streaming, sliding window accumulation,
local speech activity detection (VAD), model-compatible 64,000-sample LFCC
feature extraction, AudioCNN inference, temporal smoothing, and session-level history.
Operates strictly local and in-memory with bounded buffer memory.
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
import math
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch

from backend.config import (
    DEFAULT_THRESHOLD_LOGIT,
    DURATION_SEC,
    EXPECTED_FEATURE_SHAPE,
    MODEL_PATH,
    SAMPLE_RATE,
    TARGET_SAMPLES,
)
from backend.database.detection_repository import DetectionRepository
from backend.model_loader import ModelLoader

logger = logging.getLogger("voiceguard.live")

# Audio Streaming Window Parameters
WINDOW_SAMPLES: int = TARGET_SAMPLES      # 64,000 samples (4.0s @ 16 kHz)
HOP_SAMPLES: int = int(SAMPLE_RATE * 1.0) # 16,000 samples (1.0s hop interval)
MIN_BUFFER_SAMPLES: int = WINDOW_SAMPLES

# Lightweight Speech Activity Detection (Energy-based VAD)
# Below this RMS floor, audio is considered room silence / background noise
SILENCE_RMS_THRESHOLD: float = 0.0050     # ~ -46 dBFS
MIN_VOICED_PEAK_RATIO: float = 0.0120     # Minimum peak threshold to prevent zero-crossing noise


@dataclass
class LiveSessionStats:
    session_id: str
    started_at: float = field(default_factory=time.time)
    ended_at: Optional[float] = None
    total_audio_seconds: float = 0.0
    total_windows_evaluated: int = 0
    speech_windows_analyzed: int = 0
    silence_windows_skipped: int = 0
    bonafide_windows: int = 0
    spoof_windows: int = 0
    raw_logits: List[float] = field(default_factory=list)
    spoof_scores: List[float] = field(default_factory=list)
    smoothed_scores: List[float] = field(default_factory=list)

    @property
    def duration_seconds(self) -> float:
        end = self.ended_at or time.time()
        return max(0.0, end - self.started_at)

    @property
    def overall_verdict(self) -> str:
        if not self.speech_windows_analyzed:
            return "INSUFFICIENT_AUDIO"
        return "SPOOF" if self.spoof_windows > self.bonafide_windows else "BONAFIDE"

    @property
    def average_spoof_score(self) -> float:
        if not self.spoof_scores:
            return 0.50
        return float(np.mean(self.spoof_scores))

    @property
    def average_confidence(self) -> float:
        if not self.spoof_scores:
            return 0.50
        if self.overall_verdict == "SPOOF":
            return self.average_spoof_score
        return 1.0 - self.average_spoof_score


class SpeechActivityGate:
    """Fast local energy-based speech activity detector."""

    @staticmethod
    def evaluate(samples: np.ndarray) -> Tuple[bool, float, float]:
        """
        Evaluate whether the audio chunk contains sufficient vocal acoustic energy.
        Returns: (has_speech: bool, rms_energy: float, peak_amplitude: float)
        """
        if len(samples) == 0:
            return False, 0.0, 0.0

        peak = float(np.max(np.abs(samples)))
        rms = float(np.sqrt(np.mean(samples ** 2)))

        has_speech = (rms >= SILENCE_RMS_THRESHOLD) and (peak >= MIN_VOICED_PEAK_RATIO)
        return has_speech, rms, peak


class LiveAudioSession:
    """Manages active streaming session state, audio buffering, and inference."""

    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or f"live_{uuid.uuid4().hex[:10]}"
        self.loader = ModelLoader.get_instance()
        if not self.loader.is_ready:
            self.loader.initialize()

        self.threshold_logit = self.loader.threshold
        self.stats = LiveSessionStats(session_id=self.session_id)

        # Ring/sliding buffer for 16 kHz mono float32 samples
        self.buffer = np.zeros(0, dtype=np.float32)
        self.smoothed_spoof_score: Optional[float] = None
        self.last_prediction: Optional[Dict[str, Any]] = None
        self.smoothing_alpha: float = 0.40  # EMA smoothing weight
        self.is_active: bool = True

    def append_audio_pcm(self, pcm_bytes: bytes, format_type: str = "float32") -> int:
        """
        Ingest raw audio PCM bytes from browser WebSocket into 1-D float32 array.
        Supports Float32Array or Int16Array binary formats.
        """
        if not pcm_bytes:
            return len(self.buffer)

        try:
            if format_type == "int16":
                # Convert 16-bit signed PCM to normalized [-1.0, 1.0] float32
                raw = np.frombuffer(pcm_bytes, dtype="<i2").astype(np.float32) / 32768.0
            else:
                # Direct 32-bit float PCM from Web Audio API AudioWorklet/ScriptProcessor
                raw = np.frombuffer(pcm_bytes, dtype=np.float32)

            # Sanitize NaNs or Infs
            if not np.all(np.isfinite(raw)):
                raw = np.nan_to_num(raw, nan=0.0, posinf=0.0, neginf=0.0)

            # Cap max buffer to prevent unbounded memory growth if processing stalls (max 10s)
            max_allowed = SAMPLE_RATE * 10
            combined = np.concatenate((self.buffer, raw)) if len(self.buffer) > 0 else raw
            if len(combined) > max_allowed:
                combined = combined[-max_allowed:]

            self.buffer = combined
            self.stats.total_audio_seconds += len(raw) / float(SAMPLE_RATE)
            return len(self.buffer)
        except Exception as exc:
            logger.warning("Error ingesting PCM chunk in session '%s': %s", self.session_id, exc)
            return len(self.buffer)

    def process_available_windows(self) -> List[Dict[str, Any]]:
        """
        Extract model-compatible 64,000-sample windows from buffer, apply VAD,
        and perform forward inference on active speech windows.
        Advances buffer by HOP_SAMPLES (16,000 = 1.0s) per analysis.
        """
        events: List[Dict[str, Any]] = []

        # 1. Check if we have accumulated the required 4.0-second window (64,000 samples)
        while len(self.buffer) >= WINDOW_SAMPLES:
            window = self.buffer[:WINDOW_SAMPLES]
            # Slide buffer by 1.0s hop
            self.buffer = self.buffer[HOP_SAMPLES:]
            self.stats.total_windows_evaluated += 1

            # 2. Local Speech Activity Detection
            has_speech, rms, peak = SpeechActivityGate.evaluate(window)

            if not has_speech:
                self.stats.silence_windows_skipped += 1
                event = {
                    "type": "silence",
                    "session_id": self.session_id,
                    "state": "INSUFFICIENT_AUDIO",
                    "message": "Ambient room silence / low audio energy",
                    "rms_energy": round(rms, 5),
                    "peak_amplitude": round(peak, 4),
                    "buffered_seconds": round(len(self.buffer) / SAMPLE_RATE, 2),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                events.append(event)
                continue

            # 3. Speech detected -> run model inference
            t_start = time.perf_counter()
            try:
                extractor = self.loader.get_extractor()
                model = self.loader.get_model()
                mean, std = self.loader.get_stats()
                device = self.loader.device

                # LFCC extraction (60, 398)
                features = extractor.extract_from_waveform(window)
                if features.shape != EXPECTED_FEATURE_SHAPE:
                    raise RuntimeError(f"Unexpected feature shape: {features.shape}")

                with torch.inference_mode():
                    feat_tensor = torch.from_numpy(features).to(device)
                    norm_features = (feat_tensor - mean) / (std + 1e-8)
                    input_tensor = norm_features.unsqueeze(0).unsqueeze(0)

                    logit = model(input_tensor).squeeze()
                    raw_logit = float(logit.item())
                    raw_spoof = float(torch.sigmoid(logit).item())

                bonafide_score = float(max(0.0, min(1.0, 1.0 - raw_spoof)))
                spoof_score = float(max(0.0, min(1.0, raw_spoof)))

                # Decision threshold on raw logit
                is_spoof = raw_logit >= self.threshold_logit
                predicted_class = "SPOOF" if is_spoof else "BONAFIDE"
                confidence = spoof_score if is_spoof else bonafide_score

                # Temporal smoothing (Exponential Moving Average for smooth presentation)
                if self.smoothed_spoof_score is None:
                    self.smoothed_spoof_score = spoof_score
                else:
                    self.smoothed_spoof_score = (
                        self.smoothing_alpha * spoof_score +
                        (1.0 - self.smoothing_alpha) * self.smoothed_spoof_score
                    )

                smoothed_label = "SPOOF" if self.smoothed_spoof_score >= 0.50 else "BONAFIDE"
                elapsed_ms = (time.perf_counter() - t_start) * 1000.0

                # Record statistics
                self.stats.speech_windows_analyzed += 1
                if is_spoof:
                    self.stats.spoof_windows += 1
                else:
                    self.stats.bonafide_windows += 1

                self.stats.raw_logits.append(round(raw_logit, 4))
                self.stats.spoof_scores.append(round(spoof_score, 4))
                self.stats.smoothed_scores.append(round(self.smoothed_spoof_score, 4))

                pred_event = {
                    "type": "prediction",
                    "session_id": self.session_id,
                    "state": predicted_class,
                    "predicted_class": predicted_class,
                    "confidence": round(confidence, 4),
                    "bonafide_score": round(bonafide_score, 4),
                    "spoof_score": round(spoof_score, 4),
                    "raw_logit": round(raw_logit, 4),
                    "threshold": round(self.threshold_logit, 4),
                    "smoothed_score": round(self.smoothed_spoof_score, 4),
                    "smoothed_label": smoothed_label,
                    "rms_energy": round(rms, 5),
                    "peak_amplitude": round(peak, 4),
                    "window_index": self.stats.speech_windows_analyzed,
                    "processing_time_ms": round(elapsed_ms, 2),
                    "session_duration_sec": round(self.stats.duration_seconds, 1),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                self.last_prediction = pred_event
                events.append(pred_event)

            except Exception as exc:
                logger.exception("Inference error in live session '%s': %s", self.session_id, exc)
                events.append({
                    "type": "error",
                    "session_id": self.session_id,
                    "state": "ERROR",
                    "message": f"Inference processing error: {exc}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

        # If no windows are ready yet, emit a buffering progress event
        if not events and len(self.buffer) < WINDOW_SAMPLES:
            buffered_sec = len(self.buffer) / float(SAMPLE_RATE)
            events.append({
                "type": "buffering",
                "session_id": self.session_id,
                "state": "COLLECTING",
                "buffered_seconds": round(buffered_sec, 2),
                "required_seconds": round(DURATION_SEC, 1),
                "progress_pct": round(min(100.0, (buffered_sec / DURATION_SEC) * 100.0), 1),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        return events

    def close_and_persist_summary(self) -> Dict[str, Any]:
        """
        Finalize active session and save a single concise session record to MongoDB
        if at least one speech window was analyzed.
        """
        self.is_active = False
        self.stats.ended_at = time.time()

        summary = {
            "session_id": self.session_id,
            "duration_seconds": round(self.stats.duration_seconds, 2),
            "total_windows": self.stats.total_windows_evaluated,
            "speech_windows": self.stats.speech_windows_analyzed,
            "silence_windows": self.stats.silence_windows_skipped,
            "bonafide_windows": self.stats.bonafide_windows,
            "spoof_windows": self.stats.spoof_windows,
            "overall_verdict": self.stats.overall_verdict,
            "average_confidence": round(self.stats.average_confidence, 4),
            "average_spoof_score": round(self.stats.average_spoof_score, 4),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Persist single session-level history record if speech audio was evaluated
        if self.stats.speech_windows_analyzed > 0:
            try:
                repo = DetectionRepository()
                doc = {
                    "detection_id": f"live_{self.session_id[-8:]}",
                    "filename": f"Live Session ({self.stats.speech_windows_analyzed} windows)",
                    "file_extension": ".live",
                    "source": "live",
                    "audio_duration_sec": round(self.stats.duration_seconds, 1),
                    "original_sample_rate": SAMPLE_RATE,
                    "target_sample_rate": SAMPLE_RATE,
                    "predicted_class": self.stats.overall_verdict,
                    "confidence": round(self.stats.average_confidence, 4),
                    "bonafide_score": round(1.0 - self.stats.average_spoof_score, 4),
                    "spoof_score": round(self.stats.average_spoof_score, 4),
                    "raw_logit": float(np.mean(self.stats.raw_logits)) if self.stats.raw_logits else 0.0,
                    "processing_time_ms": 0.0,
                    "model_name": "AudioCNN (ITW Speaker-Weighted)",
                    "model_version": NEW_MODEL_PATH.name,
                    "audio_metadata": {
                        "live_session": True,
                        "speech_windows": self.stats.speech_windows_analyzed,
                        "silence_windows": self.stats.silence_windows_skipped,
                        "bonafide_windows": self.stats.bonafide_windows,
                        "spoof_windows": self.stats.spoof_windows,
                    },
                }
                success, doc_id, err = repo.insert_detection(doc)
                if success:
                    summary["db_saved"] = True
                    summary["detection_id"] = doc_id
                else:
                    summary["db_saved"] = False
                    summary["db_warning"] = err
            except Exception as exc:
                logger.warning("Could not persist live session summary: %s", exc)
                summary["db_saved"] = False

        return summary
