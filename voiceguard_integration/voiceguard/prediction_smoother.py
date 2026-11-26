from collections import deque
from dataclasses import dataclass
import math

from .config import SmoothingConfig


@dataclass(frozen=True)
class SmoothingState:
    moving_average_score: float
    exponential_average_score: float
    smoothed_score: float
    stable_assessment: bool
    spoof_state: bool
    raw_suspicious: bool
    suspicious_consecutive_windows: int
    suspicious_duration_seconds: float


class PredictionSmoother:
    """Keep raw decisions while deriving a smoothed, hysteretic stream state."""

    def __init__(
        self,
        threshold_logit: float,
        config: SmoothingConfig,
        update_seconds: float,
    ) -> None:
        self.threshold_logit = float(threshold_logit)
        self.config = config
        self.update_seconds = float(update_seconds)
        self._scores: deque[float] = deque(maxlen=config.window_size)
        self._ema: float | None = None
        self._spoof_state = False
        self._consecutive = 0

    @staticmethod
    def sigmoid(logit: float) -> float:
        if logit >= 0:
            return 1.0 / (1.0 + math.exp(-min(logit, 80.0)))
        exp_value = math.exp(max(logit, -80.0))
        return exp_value / (1.0 + exp_value)

    def update(self, raw_logit: float) -> SmoothingState:
        raw_score = self.sigmoid(raw_logit)
        self._scores.append(raw_score)
        moving_average = sum(self._scores) / len(self._scores)
        if self._ema is None:
            self._ema = raw_score
        else:
            alpha = self.config.ema_alpha
            self._ema = alpha * raw_score + (1.0 - alpha) * self._ema

        stable = len(self._scores) >= self.config.minimum_predictions
        threshold_score = self.sigmoid(self.threshold_logit)
        enter_threshold = min(1.0, threshold_score + self.config.hysteresis_margin)
        exit_threshold = max(0.0, threshold_score - self.config.hysteresis_margin)
        raw_suspicious = raw_logit >= self.threshold_logit
        if raw_suspicious or self._ema >= enter_threshold:
            self._consecutive += 1
        else:
            self._consecutive = 0
        if (
            not self._spoof_state
            and self._ema >= enter_threshold
            and self._consecutive >= self.config.alert_persistence
        ):
            self._spoof_state = True
        elif self._spoof_state and self._ema <= exit_threshold:
            self._spoof_state = False

        return SmoothingState(
            moving_average_score=moving_average,
            exponential_average_score=self._ema,
            smoothed_score=self._ema,
            stable_assessment=stable,
            spoof_state=self._spoof_state,
            raw_suspicious=raw_suspicious,
            suspicious_consecutive_windows=self._consecutive,
            suspicious_duration_seconds=self._consecutive * self.update_seconds,
        )

    def reset(self) -> None:
        self._scores.clear()
        self._ema = None
        self._spoof_state = False
        self._consecutive = 0
