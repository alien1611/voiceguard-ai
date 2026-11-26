from .schemas import PolicyRecommendation, RiskLevel


class PreventionPolicy:
    """Return reversible advice; never execute call, account, or financial actions."""

    _ACTIONS = {
        RiskLevel.LOW: (
            "Continue monitoring.",
            "No immediate intervention is recommended.",
        ),
        RiskLevel.MEDIUM: (
            "Display a caution warning.",
            "Independently verify sensitive requests through a trusted channel.",
        ),
        RiskLevel.HIGH: (
            "Display a high-risk warning.",
            "Verify the caller using a separate, established trusted channel.",
            "Do not share OTPs, passwords, or financial information based only on this audio.",
        ),
        RiskLevel.CRITICAL: (
            "Pause sensitive actions until independent verification is complete.",
            "Verify the caller using a separate, established trusted channel.",
            "Escalate to the integrating application for its configured human-reviewed response.",
        ),
    }

    def recommend(self, risk_level: RiskLevel) -> PolicyRecommendation:
        return PolicyRecommendation(
            risk_level=risk_level,
            actions=self._ACTIONS[risk_level],
            caller_identity_verified=False,
            irreversible_actions_authorized=False,
        )
