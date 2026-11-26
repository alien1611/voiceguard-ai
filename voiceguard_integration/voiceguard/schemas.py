from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any
import uuid


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertType(str, Enum):
    AUDIO_ANALYSIS_STARTED = "AUDIO_ANALYSIS_STARTED"
    AUDIO_QUALITY_WARNING = "AUDIO_QUALITY_WARNING"
    SUSPICIOUS_AUDIO_DETECTED = "SUSPICIOUS_AUDIO_DETECTED"
    HIGH_RISK_AUDIO_DETECTED = "HIGH_RISK_AUDIO_DETECTED"
    SPOOF_ALERT_CLEARED = "SPOOF_ALERT_CLEARED"
    AUDIO_ANALYSIS_STOPPED = "AUDIO_ANALYSIS_STOPPED"
    AUDIO_PROCESSING_ERROR = "AUDIO_PROCESSING_ERROR"


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class AudioQuality:
    status: str
    warnings: tuple[str, ...] = ()
    rms: float = 0.0
    peak_amplitude: float = 0.0
    clipped_fraction: float = 0.0
    sample_rate: int | None = None
    channels: int | None = None
    duration_seconds: float | None = None
    source_format: str | None = None

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["warnings"] = list(self.warnings)
        return data


@dataclass(frozen=True)
class RiskAssessment:
    risk_level: RiskLevel
    reason: str
    suspicious_consecutive_windows: int
    suspicious_duration_seconds: float
    provisional_boundaries: bool = True

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["risk_level"] = self.risk_level.value
        return data


@dataclass(frozen=True)
class AlertEvent:
    event_type: AlertType
    session_id: str | None
    risk_level: RiskLevel
    reason: str
    recommended_action: str
    raw_logit: float | None = None
    raw_spoof_score: float | None = None
    smoothed_spoof_score: float | None = None
    model_threshold: float | None = None
    suspicious_consecutive_windows: int = 0
    audio_quality_status: str = "UNKNOWN"
    timestamp: str = field(default_factory=utc_timestamp)
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["event_type"] = self.event_type.value
        data["risk_level"] = self.risk_level.value
        return data


@dataclass(frozen=True)
class PredictionResult:
    label: str
    predicted_label: int
    raw_logit: float
    spoof_score: float
    threshold: float
    timestamp: str
    inference_time_ms: float
    audio_quality: AudioQuality
    risk: RiskAssessment
    smoothed_score: float
    moving_average_score: float
    stable_assessment: bool
    suspicious_consecutive_windows: int
    smoothed_spoof_state: bool = False
    session_id: str | None = None
    sample_rate: int | None = None
    duration_seconds: float | None = None
    feature_shape: tuple[int, int] = (60, 398)
    score_semantics: str = "uncalibrated sigmoid model score; not a probability"
    events: tuple[AlertEvent, ...] = ()

    @property
    def risk_level(self) -> str:
        return self.risk.risk_level.value

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["risk"] = self.risk.to_dict()
        data["audio_quality"] = self.audio_quality.to_dict()
        data["risk_level"] = self.risk_level
        data["events"] = [event.to_dict() for event in self.events]
        data["feature_shape"] = list(self.feature_shape)
        return data


@dataclass(frozen=True)
class AudioChunkResult:
    status: str
    session_id: str
    buffered_samples: int
    required_samples: int
    predictions: tuple[PredictionResult, ...] = ()
    error: str | None = None

    @property
    def latest(self) -> PredictionResult | None:
        return self.predictions[-1] if self.predictions else None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "session_id": self.session_id,
            "buffered_samples": self.buffered_samples,
            "required_samples": self.required_samples,
            "predictions": [prediction.to_dict() for prediction in self.predictions],
            "error": self.error,
        }


@dataclass(frozen=True)
class ProcessingErrorResult:
    session_id: str
    error_type: str
    message: str
    events: tuple[AlertEvent, ...] = ()
    timestamp: str = field(default_factory=utc_timestamp)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["events"] = [event.to_dict() for event in self.events]
        return data


@dataclass(frozen=True)
class PolicyRecommendation:
    risk_level: RiskLevel
    actions: tuple[str, ...]
    caller_identity_verified: bool = False
    irreversible_actions_authorized: bool = False

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["risk_level"] = self.risk_level.value
        data["actions"] = list(self.actions)
        return data
