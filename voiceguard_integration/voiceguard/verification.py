from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import uuid


@dataclass(frozen=True)
class VerificationRequest:
    """A request for the host application to perform independent verification."""

    session_id: str
    request_type: str
    reason: str
    recommended_steps: tuple[str, ...]
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    caller_identity_verified: bool = False

    def to_dict(self) -> dict:
        data = asdict(self)
        data["recommended_steps"] = list(self.recommended_steps)
        return data


class IndependentVerificationWorkflow:
    """Create workflow instructions without contacting anyone or making decisions."""

    _SENSITIVE_TERMS = ("otp", "password", "money", "transfer", "payment", "financial")

    def initiate(
        self, session_id: str, reason: str, request_type: str = "sensitive_request"
    ) -> VerificationRequest:
        normalized_reason = reason.casefold()
        steps = [
            "Use a previously established, independently trusted contact channel.",
            "Do not rely on the current audio, caller ID, or this model to establish identity.",
            "Require the integrating application's configured confirmation before proceeding.",
        ]
        if any(term in normalized_reason for term in self._SENSITIVE_TERMS):
            steps.append(
                "Do not share OTPs, passwords, or payment credentials during the verification."
            )
        return VerificationRequest(
            session_id=session_id,
            request_type=request_type,
            reason=reason,
            recommended_steps=tuple(steps),
        )
