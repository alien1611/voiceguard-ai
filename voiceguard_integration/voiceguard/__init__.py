"""VoiceGuard audio deepfake detection integration package."""

from .config import RiskConfig, SmoothingConfig, VoiceGuardConfig
from .detector import VoiceGuardDetector
from .audio_processor import AudioProcessor
from .alert_manager import AlertManager
from .exceptions import (
    AudioDecodeError,
    AudioFormatError,
    AudioValidationError,
    ConfigurationError,
    MicrophoneError,
    ModelLoadError,
    SessionError,
    VoiceGuardError,
)
from .live_engine import AudioChunkEngine, MicrophoneRunner
from .prediction_smoother import PredictionSmoother
from .prevention_policy import PreventionPolicy
from .risk_engine import RiskEngine
from .schemas import (
    AlertEvent,
    AlertType,
    AudioChunkResult,
    AudioQuality,
    PolicyRecommendation,
    PredictionResult,
    ProcessingErrorResult,
    RiskAssessment,
    RiskLevel,
)
from .verification import IndependentVerificationWorkflow, VerificationRequest

__all__ = [
    "AlertEvent",
    "AlertManager",
    "AlertType",
    "AudioChunkEngine",
    "AudioChunkResult",
    "AudioDecodeError",
    "AudioFormatError",
    "AudioProcessor",
    "AudioQuality",
    "AudioValidationError",
    "ConfigurationError",
    "IndependentVerificationWorkflow",
    "MicrophoneError",
    "MicrophoneRunner",
    "ModelLoadError",
    "PolicyRecommendation",
    "PreventionPolicy",
    "PredictionSmoother",
    "PredictionResult",
    "ProcessingErrorResult",
    "RiskAssessment",
    "RiskConfig",
    "RiskLevel",
    "RiskEngine",
    "SessionError",
    "SmoothingConfig",
    "VerificationRequest",
    "VoiceGuardConfig",
    "VoiceGuardDetector",
    "VoiceGuardError",
]
