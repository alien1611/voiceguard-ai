from .prevention_policy import PreventionPolicy
from .schemas import (
    AlertEvent,
    AlertType,
    AudioQuality,
    PredictionResult,
    RiskLevel,
)


class AlertManager:
    """Create structured transition and quality events for an integrating app."""

    def __init__(self, policy: PreventionPolicy | None = None):
        self.policy = policy or PreventionPolicy()
        self._risk_by_session: dict[str, RiskLevel] = {}
        self._quality_warnings_by_session: dict[str, set[tuple[str, ...]]] = {}

    def started(self, session_id: str) -> AlertEvent:
        self._risk_by_session[session_id] = RiskLevel.LOW
        self._quality_warnings_by_session[session_id] = set()
        return AlertEvent(
            event_type=AlertType.AUDIO_ANALYSIS_STARTED,
            session_id=session_id,
            risk_level=RiskLevel.LOW,
            reason="Audio analysis session started.",
            recommended_action="Begin monitoring audio chunks.",
        )

    def update(self, result: PredictionResult) -> tuple[AlertEvent, ...]:
        if result.session_id is None:
            return ()
        session_id = result.session_id
        previous = self._risk_by_session.get(session_id, RiskLevel.LOW)
        current = result.risk.risk_level
        events: list[AlertEvent] = []
        if result.audio_quality.status != "OK":
            warnings = tuple(result.audio_quality.warnings)
            known = self._quality_warnings_by_session.setdefault(session_id, set())
            if warnings not in known:
                known.add(warnings)
                events.append(
                    self._event(
                        AlertType.AUDIO_QUALITY_WARNING,
                        result,
                        " | ".join(warnings) or "Audio quality warning.",
                        "Check microphone level, clipping, and capture conditions.",
                    )
                )
        if current != previous:
            if current == RiskLevel.LOW and previous != RiskLevel.LOW:
                event_type = AlertType.SPOOF_ALERT_CLEARED
                reason = "The current smoothed assessment is below the alert state."
            elif current == RiskLevel.MEDIUM:
                event_type = AlertType.SUSPICIOUS_AUDIO_DETECTED
                reason = result.risk.reason
            elif current in (RiskLevel.HIGH, RiskLevel.CRITICAL):
                event_type = AlertType.HIGH_RISK_AUDIO_DETECTED
                reason = result.risk.reason
            else:
                event_type = None
                reason = ""
            if event_type is not None:
                recommendation = self.policy.recommend(current)
                events.append(
                    self._event(
                        event_type,
                        result,
                        reason,
                        " ".join(recommendation.actions),
                    )
                )
        self._risk_by_session[session_id] = current
        return tuple(events)

    def stopped(self, session_id: str) -> AlertEvent:
        self._risk_by_session.pop(session_id, None)
        self._quality_warnings_by_session.pop(session_id, None)
        return AlertEvent(
            event_type=AlertType.AUDIO_ANALYSIS_STOPPED,
            session_id=session_id,
            risk_level=RiskLevel.LOW,
            reason="Audio analysis session stopped.",
            recommended_action="Release session audio buffers.",
        )

    def processing_error(
        self, session_id: str | None, message: str
    ) -> AlertEvent:
        return AlertEvent(
            event_type=AlertType.AUDIO_PROCESSING_ERROR,
            session_id=session_id,
            risk_level=RiskLevel.LOW,
            reason=message,
            recommended_action="Check input format, sample rate, and stream state.",
        )

    @staticmethod
    def _event(
        event_type: AlertType,
        result: PredictionResult,
        reason: str,
        action: str,
    ) -> AlertEvent:
        return AlertEvent(
            event_type=event_type,
            session_id=result.session_id,
            risk_level=result.risk.risk_level,
            reason=reason,
            recommended_action=action,
            raw_logit=result.raw_logit,
            raw_spoof_score=result.spoof_score,
            smoothed_spoof_score=result.smoothed_score,
            model_threshold=result.threshold,
            suspicious_consecutive_windows=result.suspicious_consecutive_windows,
            audio_quality_status=result.audio_quality.status,
        )
