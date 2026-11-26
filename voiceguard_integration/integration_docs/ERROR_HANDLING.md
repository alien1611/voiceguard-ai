# Errors and recovery

The package raises `VoiceGuardError` subclasses for initialization and direct
file/API errors:

- `ConfigurationError`: invalid package or metadata configuration.
- `ModelLoadError`: missing, mismatched, or unreadable model artifacts.
- `AudioFormatError`: unsupported/unknown input format or raw PCM metadata.
- `AudioDecodeError`: recognized container could not be decoded.
- `AudioValidationError`: empty, malformed, non-finite, or invalid-rate audio.
- `SessionError`: duplicate, missing, or incompatible session.
- `MicrophoneError`: optional capture device, stream, queue, or recording issue.

The chunk interface returns `ProcessingErrorResult` for errors that happen
during an active session. It preserves the error type/message and includes a
structured processing-error alert; it does not fabricate a prediction or stop
unrelated sessions. Applications should log the details, skip that chunk, and
decide whether to retry or end the affected session.

Microphone queue overflow is reported as an error rather than silently dropping
frames and continuing with a misleadingly continuous stream. A rate or channel
change within a session is rejected. Verify audio format, source sample rate,
and channel layout before retrying.

The historical `Illegal Audio-MPEG-Header` message shows that an MPEG decoder
could not parse the bytes it received; that message alone cannot prove whether
the original input was mislabeled, corrupted/truncated MP3, or non-MP3 data.
The exact original failing byte stream was not available for a definitive
root-cause finding. This package detects file signatures before decoding and
routes microphone arrays directly through PCM conversion, never through an
MP3 decoder.

File decoding errors propagate as exceptions from `predict_file`; chunk errors
are results. The microphone adapter stops the stream, closes an optional WAV
writer, and attempts to stop the session during cleanup. Exceptions raised by
the integrating application's prediction/event callbacks are not treated as
model predictions.
