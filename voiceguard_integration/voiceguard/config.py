from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
import json

from .exceptions import ConfigurationError


@dataclass(frozen=True)
class SmoothingConfig:
    window_size: int = 5
    ema_alpha: float = 0.35
    minimum_predictions: int = 2
    hysteresis_margin: float = 0.03
    alert_persistence: int = 2

    def __post_init__(self):
        if self.window_size < 1:
            raise ConfigurationError("Smoothing window_size must be positive.")
        if not 0 < self.ema_alpha <= 1:
            raise ConfigurationError("ema_alpha must be in (0, 1].")
        if self.minimum_predictions < 1:
            raise ConfigurationError("minimum_predictions must be positive.")
        if not 0 <= self.hysteresis_margin < 0.5:
            raise ConfigurationError("hysteresis_margin must be in [0, 0.5).")
        if self.alert_persistence < 1:
            raise ConfigurationError("alert_persistence must be positive.")


@dataclass(frozen=True)
class RiskConfig:
    medium_score: float = 0.56
    high_score: float = 0.75
    critical_score: float = 0.90
    critical_consecutive_windows: int = 3

    def __post_init__(self):
        for name, value in (
            ("medium_score", self.medium_score),
            ("high_score", self.high_score),
            ("critical_score", self.critical_score),
        ):
            if not 0 <= value <= 1:
                raise ConfigurationError(f"{name} must be in [0, 1].")
        if not self.medium_score <= self.high_score <= self.critical_score:
            raise ConfigurationError(
                "Risk score boundaries must satisfy medium <= high <= critical."
            )
        if self.critical_consecutive_windows < 1:
            raise ConfigurationError("critical_consecutive_windows must be positive.")


@dataclass(frozen=True)
class VoiceGuardConfig:
    model_dir: Path
    checkpoint_name: str = "best_audio_cnn_itw_speaker_weighted.pth"
    normalization_name: str = "normalization_stats_22k.npz"
    threshold_name: str = "calibrated_threshold_itw_speaker_weighted.npy"
    metadata_name: str = "audio_cnn_itw_speaker_weighted_metadata.json"
    device: str = "auto"
    window_seconds: float = 4.0
    update_seconds: float = 1.0
    queue_blocks: int = 128
    smoothing: SmoothingConfig = field(default_factory=SmoothingConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)

    @classmethod
    def from_json(cls, path: str | Path) -> "VoiceGuardConfig":
        config_path = Path(path).expanduser().resolve()
        try:
            data: dict[str, Any] = json.loads(config_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ConfigurationError(f"Could not read config {config_path}: {error}") from error
        base = config_path.parent
        model_dir = Path(data.get("model_dir", "models"))
        if not model_dir.is_absolute():
            model_dir = (base / model_dir).resolve()
        try:
            return cls(
                model_dir=model_dir,
                checkpoint_name=data.get("checkpoint_name", cls.__dataclass_fields__["checkpoint_name"].default),
                normalization_name=data.get("normalization_name", cls.__dataclass_fields__["normalization_name"].default),
                threshold_name=data.get("threshold_name", cls.__dataclass_fields__["threshold_name"].default),
                metadata_name=data.get("metadata_name", cls.__dataclass_fields__["metadata_name"].default),
                device=data.get("device", "auto"),
                window_seconds=float(data.get("window_seconds", 4.0)),
                update_seconds=float(data.get("update_seconds", 1.0)),
                queue_blocks=int(data.get("queue_blocks", 128)),
                smoothing=SmoothingConfig(**data.get("smoothing", {})),
                risk=RiskConfig(**data.get("risk", {})),
            )
        except (TypeError, ValueError) as error:
            raise ConfigurationError(f"Invalid config values in {config_path}: {error}") from error

    def __post_init__(self):
        object.__setattr__(self, "model_dir", Path(self.model_dir).expanduser().resolve())
        if self.device not in {"auto", "cpu", "cuda"}:
            raise ConfigurationError("device must be 'auto', 'cpu', or 'cuda'.")
        if self.window_seconds <= 0 or self.update_seconds <= 0:
            raise ConfigurationError("Window and update durations must be positive.")
        if self.update_seconds > self.window_seconds:
            raise ConfigurationError("update_seconds cannot exceed window_seconds.")
        if self.queue_blocks < 1:
            raise ConfigurationError("queue_blocks must be positive.")

    @property
    def checkpoint_path(self) -> Path:
        return self.model_dir / self.checkpoint_name

    @property
    def normalization_path(self) -> Path:
        return self.model_dir / self.normalization_name

    @property
    def threshold_path(self) -> Path:
        return self.model_dir / self.threshold_name

    @property
    def metadata_path(self) -> Path:
        return self.model_dir / self.metadata_name
