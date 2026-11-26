from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any
from importlib import resources
import logging
import time

import numpy as np
import torch

from .alert_manager import AlertManager
from .audio_processor import AudioProcessor, TARGET_LENGTH
from .config import VoiceGuardConfig
from .exceptions import AudioValidationError, SessionError, VoiceGuardError
from .feature_extractor import FEATURE_SHAPE, extract_lfcc_from_processed_audio
from .live_engine import AudioChunkEngine
from .model_loader import LoadedModel, ModelLoader
from .prediction_smoother import PredictionSmoother
from .risk_engine import RiskEngine
from .schemas import (
    AlertEvent,
    AudioChunkResult,
    AudioQuality,
    PredictionResult,
    ProcessingErrorResult,
    PolicyRecommendation,
)


LOGGER = logging.getLogger(__name__)


@dataclass
class _Session:
    session_id: str
    engine: AudioChunkEngine
    smoother: PredictionSmoother
    window_seconds: float
    update_seconds: float
    lock: Lock
    active: bool = True


class VoiceGuardDetector:
    """Portable inference API for files and externally supplied audio chunks."""

    def __init__(
        self,
        config: VoiceGuardConfig,
        loaded_model: LoadedModel,
        *,
        processor: AudioProcessor | None = None,
    ) -> None:
        self.config = config
        self.loaded_model = loaded_model
        self.processor = processor or AudioProcessor()
        self.risk_engine = RiskEngine(config.risk)
        self.alert_manager = AlertManager()
        self._sessions: dict[str, _Session] = {}
        self._sessions_lock = Lock()

    @classmethod
    def from_config(
        cls,
        model_dir: str | Path | None = None,
        *,
        config: VoiceGuardConfig | None = None,
        config_file: str | Path | None = None,
        device: str | None = None,
    ) -> "VoiceGuardDetector":
        if config is not None and config_file is not None:
            raise ValueError("Pass config or config_file, not both.")
        if model_dir is not None and (config is not None or config_file is not None):
            raise ValueError("Pass model_dir only when using default configuration.")
        if config_file is not None:
            if device is not None:
                raise ValueError("Set the device in the config file.")
            resolved_config = VoiceGuardConfig.from_json(config_file)
        elif config is not None:
            resolved_config = config
        else:
            local_model_dir = Path(__file__).resolve().parents[1] / "models"
            bundled_model_dir = (
                local_model_dir
                if local_model_dir.is_dir()
                else Path(str(resources.files("voiceguard_models")))
            )
            resolved_config = VoiceGuardConfig(
                model_dir=(
                    Path(model_dir)
                    if model_dir is not None
                    else bundled_model_dir
                ),
                device=device or "auto",
            )
        if device is not None and config is not None:
            raise ValueError("Set the device in the supplied config.")
        loaded = ModelLoader(resolved_config).load()
        return cls(resolved_config, loaded)

    @property
    def threshold(self) -> float:
        return self.loaded_model.threshold

    @property
    def device(self) -> torch.device:
        return self.loaded_model.device

    @property
    def model_metadata(self) -> dict[str, Any]:
        return dict(self.loaded_model.metadata)

    def predict_file(
        self,
        path: str | Path,
        *,
        raw_sample_rate: int | None = None,
        raw_channels: int | None = None,
        raw_encoding: str | None = None,
    ) -> PredictionResult:
        started = time.perf_counter()
        prepared, quality = self.processor.prepare_file(
            path,
            raw_sample_rate=raw_sample_rate,
            raw_channels=raw_channels,
            raw_encoding=raw_encoding,
        )
        smoother = PredictionSmoother(
            self.threshold,
            self.config.smoothing,
            self.config.update_seconds,
        )
        return self._predict_prepared(
            prepared,
            quality,
            smoother=smoother,
            session_id=None,
            started=started,
        )

    def predict_audio(
        self,
        audio: np.ndarray,
        sample_rate: int,
        *,
        session_id: str | None = None,
    ) -> PredictionResult:
        started = time.perf_counter()
        prepared, quality = self.processor.prepare(audio, sample_rate)
        smoother = PredictionSmoother(
            self.threshold,
            self.config.smoothing,
            self.config.update_seconds,
        )
        result = self._predict_prepared(
            prepared,
            quality,
            smoother=smoother,
            session_id=session_id,
            started=started,
        )
        if session_id is not None:
            events = self.alert_manager.update(result)
            result = replace(result, events=events)
        return result

    def start_session(
        self,
        session_id: str,
        *,
        sample_rate: int | None = None,
        window_seconds: float | None = None,
        update_seconds: float | None = None,
    ) -> tuple[AlertEvent, ...]:
        if not session_id:
            raise SessionError("session_id must be a non-empty string.")
        window = float(
            self.config.window_seconds if window_seconds is None else window_seconds
        )
        update = float(
            self.config.update_seconds if update_seconds is None else update_seconds
        )
        if window <= 0 or update <= 0 or update > window:
            raise SessionError("Require 0 < update_seconds <= window_seconds.")
        if sample_rate is not None and (
            isinstance(sample_rate, bool)
            or int(sample_rate) != sample_rate
            or sample_rate <= 0
        ):
            raise SessionError("sample_rate must be positive.")
        engine = AudioChunkEngine(
            window_seconds=window,
            update_seconds=update,
            sample_rate=sample_rate,
            processor=self.processor,
        )
        session = _Session(
            session_id=session_id,
            engine=engine,
            smoother=PredictionSmoother(
                self.threshold,
                self.config.smoothing,
                update,
            ),
            window_seconds=window,
            update_seconds=update,
            lock=Lock(),
        )
        with self._sessions_lock:
            if session_id in self._sessions:
                raise SessionError(f"Session already exists: {session_id}")
            self._sessions[session_id] = session
        return (self.alert_manager.started(session_id),)

    def process_audio_chunk(
        self,
        audio_chunk: np.ndarray,
        sample_rate: int,
        *,
        session_id: str,
    ) -> AudioChunkResult | ProcessingErrorResult:
        with self._sessions_lock:
            session = self._sessions.get(session_id)
        if session is None:
            error = SessionError(f"No active session named {session_id!r}.")
            event = self.alert_manager.processing_error(session_id, str(error))
            return ProcessingErrorResult(
                session_id=session_id,
                error_type=type(error).__name__,
                message=str(error),
                events=(event,),
            )

        with session.lock:
            if not session.active:
                return ProcessingErrorResult(
                    session_id=session_id,
                    error_type="SessionError",
                    message=f"Session {session_id!r} has already stopped.",
                    events=(
                        self.alert_manager.processing_error(
                            session_id, "Audio arrived after the session stopped."
                        ),
                    ),
                )
            try:
                windows = session.engine.push(audio_chunk, sample_rate)
                predictions = []
                source_rate = session.engine.sample_rate
                source_channels = session.engine.channels
                if source_rate is None or source_channels is None:
                    return AudioChunkResult(
                        status="BUFFERING",
                        session_id=session_id,
                        buffered_samples=session.engine.buffered_samples,
                        required_samples=session.engine.required_samples or 0,
                    )
                for window in windows:
                    started = time.perf_counter()
                    prepared, quality = self.processor.prepare(
                        window,
                        source_rate,
                        source_channels=source_channels,
                    )
                    prediction = self._predict_prepared(
                        prepared,
                        quality,
                        smoother=session.smoother,
                        session_id=session_id,
                        started=started,
                    )
                    events = self.alert_manager.update(prediction)
                    predictions.append(replace(prediction, events=events))
                return AudioChunkResult(
                    status="ANALYZED" if predictions else "BUFFERING",
                    session_id=session_id,
                    buffered_samples=session.engine.buffered_samples,
                    required_samples=session.engine.required_samples or 0,
                    predictions=tuple(predictions),
                )
            except Exception as error:
                LOGGER.exception("Audio chunk failed in session %s", session_id)
                event = self.alert_manager.processing_error(session_id, str(error))
                return ProcessingErrorResult(
                    session_id=session_id,
                    error_type=type(error).__name__,
                    message=str(error),
                    events=(event,),
                )

    def stop_session(self, session_id: str) -> tuple[AlertEvent, ...]:
        with self._sessions_lock:
            session = self._sessions.get(session_id)
        if session is None:
            raise SessionError(f"No active session named {session_id!r}.")
        with session.lock:
            with self._sessions_lock:
                if self._sessions.get(session_id) is not session:
                    raise SessionError(f"No active session named {session_id!r}.")
                session.active = False
                del self._sessions[session_id]
            return (self.alert_manager.stopped(session_id),)

    def _predict_prepared(
        self,
        prepared_audio: np.ndarray,
        quality: AudioQuality,
        *,
        smoother: PredictionSmoother,
        session_id: str | None,
        started: float,
    ) -> PredictionResult:
        if prepared_audio.shape != (TARGET_LENGTH,):
            raise AudioValidationError(
                f"Expected {TARGET_LENGTH:,} preprocessed samples, got {prepared_audio.shape}."
            )
        features = extract_lfcc_from_processed_audio(prepared_audio)
        if features.shape != FEATURE_SHAPE:
            raise AudioValidationError(f"Unexpected LFCC feature shape {features.shape}.")
        normalized = self.processor.normalize_features(
            features, self.loaded_model.mean, self.loaded_model.std
        )
        tensor = torch.from_numpy(normalized).unsqueeze(1).to(self.device)
        try:
            with torch.inference_mode():
                raw_logit = float(self.loaded_model.model(tensor).reshape(-1)[0].item())
        except Exception as error:
            raise VoiceGuardError(f"CNN inference failed: {error}") from error
        if not np.isfinite(raw_logit):
            raise AudioValidationError("CNN returned a non-finite logit.")
        raw_score = PredictionSmoother.sigmoid(raw_logit)
        smoothing = smoother.update(raw_logit)
        risk = self.risk_engine.assess(
            raw_logit=raw_logit,
            raw_score=raw_score,
            smoothed_score=smoothing.smoothed_score,
            threshold_logit=self.threshold,
            suspicious_consecutive_windows=smoothing.suspicious_consecutive_windows,
            suspicious_duration_seconds=smoothing.suspicious_duration_seconds,
            stable_assessment=smoothing.stable_assessment,
            audio_quality=quality,
        )
        prediction = PredictionResult(
            label="SPOOF" if raw_logit >= self.threshold else "BONAFIDE",
            predicted_label=int(raw_logit >= self.threshold),
            raw_logit=raw_logit,
            spoof_score=raw_score,
            threshold=self.threshold,
            timestamp=datetime.now(timezone.utc).isoformat(),
            inference_time_ms=(time.perf_counter() - started) * 1000,
            audio_quality=quality,
            risk=risk,
            smoothed_score=smoothing.smoothed_score,
            moving_average_score=smoothing.moving_average_score,
            stable_assessment=smoothing.stable_assessment,
            suspicious_consecutive_windows=smoothing.suspicious_consecutive_windows,
            smoothed_spoof_state=smoothing.spoof_state,
            session_id=session_id,
            sample_rate=quality.sample_rate,
            duration_seconds=quality.duration_seconds,
            feature_shape=FEATURE_SHAPE,
        )
        return prediction

    def recommend_action(self, result: PredictionResult) -> PolicyRecommendation:
        return self.alert_manager.policy.recommend(result.risk.risk_level)
