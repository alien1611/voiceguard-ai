class VoiceGuardError(Exception):
    """Base exception for VoiceGuard integration errors."""


class ConfigurationError(VoiceGuardError):
    """Model configuration or artifact metadata is invalid."""


class ModelLoadError(VoiceGuardError):
    """The configured model could not be loaded safely."""


class AudioFormatError(VoiceGuardError):
    """Audio input is unsupported or its format cannot be identified."""


class AudioDecodeError(VoiceGuardError):
    """Audio was identified but could not be decoded."""


class AudioValidationError(VoiceGuardError):
    """Decoded audio is empty, malformed, or contains invalid samples."""


class SessionError(VoiceGuardError):
    """A stream session is missing, duplicated, or incompatible."""


class MicrophoneError(VoiceGuardError):
    """Microphone capture could not start or continue."""
