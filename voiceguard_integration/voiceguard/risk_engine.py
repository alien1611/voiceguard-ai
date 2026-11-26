from .config import RiskConfig
from .schemas import AudioQuality, RiskAssessment, RiskLevel


class RiskEngine:
    """Map model evidence to provisional, configurable alert levels."""

    def __init__(self, config: RiskConfig):
        self.config = config

    def assess(
        self,
        *,
        raw_logit: float,
        raw_score: float,
        smoothed_score: float,
        threshold_logit: float,
        suspicious_consecutive_windows: int,
        suspicious_duration_seconds: float,
        stable_assessment: bool,
        audio_quality: AudioQuality,
    ) -> RiskAssessment:
        raw_spoof_decision = raw_logit >= threshold_logit
        quality_reliable = audio_quality.status == "OK"
        persistent_high = (
            quality_reliable
            and (
                suspicious_consecutive_windows
                >= self.config.critical_consecutive_windows
            )
            and max(raw_score, smoothed_score) >= self.config.critical_score
        )
        if persistent_high:
            level = RiskLevel.CRITICAL
            reason = (
                "High spoof-like model scores persisted across multiple analysis "
                "windows; this is a provisional risk rule."
            )
        elif raw_score >= self.config.high_score or (
            quality_reliable
            and stable_assessment
            and smoothed_score >= self.config.high_score
        ):
            level = RiskLevel.HIGH
            reason = (
                "The raw or smoothed model score crossed the provisional high-risk "
                "boundary; the score is not a calibrated probability."
            )
        elif raw_spoof_decision or smoothed_score >= self.config.medium_score:
            level = RiskLevel.MEDIUM
            reason = (
                "The model produced suspicious audio evidence at its fixed raw-logit "
                "threshold or the provisional medium score boundary."
            )
        else:
            level = RiskLevel.LOW
            reason = "No strong spoof-like model evidence was observed in this window."

        if audio_quality.status != "OK":
            reason += " Audio quality warnings limit interpretation."
        return RiskAssessment(
            risk_level=level,
            reason=reason,
            suspicious_consecutive_windows=suspicious_consecutive_windows,
            suspicious_duration_seconds=suspicious_duration_seconds,
            provisional_boundaries=True,
        )
