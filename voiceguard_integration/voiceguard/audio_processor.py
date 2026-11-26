from dataclasses import dataclass
from math import gcd
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from .exceptions import AudioDecodeError, AudioFormatError, AudioValidationError
from .feature_extractor import SAMPLE_RATE
from .schemas import AudioQuality


MODEL_DURATION_SECONDS = 4
TARGET_LENGTH = SAMPLE_RATE * MODEL_DURATION_SECONDS
SILENCE_RMS_THRESHOLD = 1e-4
LOW_VOLUME_RMS_THRESHOLD = 1e-3
CLIPPED_SAMPLE_THRESHOLD = 0.999
CLIPPED_FRACTION_THRESHOLD = 0.001

_FORMAT_SIGNATURES = (
    (lambda data: len(data) >= 12 and data[:4] in (b"RIFF", b"RIFX", b"RF64") and data[8:12] == b"WAVE", "WAV"),
    (lambda data: data.startswith(b"fLaC"), "FLAC"),
    (lambda data: data.startswith(b"OggS"), "OGG"),
    (lambda data: data.startswith(b"FORM") and data[8:12] in (b"AIFF", b"AIFC"), "AIFF"),
    (lambda data: data.startswith(b"ID3"), "MP3"),
    (lambda data: len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0, "MP3"),
)
_SUPPORTED_SOUNDFILE_FORMATS = {"WAV", "FLAC", "OGG", "AIFF", "MP3"}


@dataclass(frozen=True)
class DecodedAudio:
    samples: np.ndarray
    sample_rate: int
    channels: int
    source_format: str


class AudioProcessor:
    """Decode input and apply the existing mono/16 kHz/four-second policy."""

    def detect_format(self, header: bytes) -> str:
        for matches, audio_format in _FORMAT_SIGNATURES:
            if matches(header):
                return audio_format
        raise AudioFormatError(
            "Audio format was not identified from its header. Raw PCM must be "
            "provided with explicit sample rate, channel count, and encoding."
        )

    def decode_file(
        self,
        path: str | Path,
        *,
        raw_sample_rate: int | None = None,
        raw_channels: int | None = None,
        raw_encoding: str | None = None,
    ) -> DecodedAudio:
        audio_path = Path(path).expanduser()
        if not audio_path.is_file():
            raise FileNotFoundError(f"Audio file does not exist: {audio_path}")
        try:
            with audio_path.open("rb") as source:
                header = source.read(16)
        except OSError as error:
            raise AudioDecodeError(f"Could not read audio file {audio_path}: {error}") from error

        try:
            audio_format = self.detect_format(header)
        except AudioFormatError:
            if audio_path.suffix.casefold() not in {".pcm", ".raw"}:
                raise AudioFormatError(
                    f"Unsupported or unrecognized audio file {audio_path.name!r}. "
                    "The extension is not used as a substitute for format detection."
                )
            if raw_sample_rate is None or raw_channels is None or raw_encoding is None:
                raise AudioFormatError(
                    "Raw PCM requires raw_sample_rate, raw_channels, and raw_encoding."
                )
            try:
                payload = audio_path.read_bytes()
            except OSError as error:
                raise AudioDecodeError(f"Could not read raw PCM file: {error}") from error
            samples = self.decode_raw_pcm(
                payload, raw_sample_rate, raw_channels, raw_encoding
            )
            return DecodedAudio(
                samples=samples,
                sample_rate=int(raw_sample_rate),
                channels=int(raw_channels),
                source_format=f"PCM/{raw_encoding}",
            )

        if audio_format not in _SUPPORTED_SOUNDFILE_FORMATS:
            raise AudioFormatError(f"Unsupported audio format: {audio_format}")
        if audio_format == "MP3" and "MP3" not in sf.available_formats():
            raise AudioFormatError(
                "MP3 was identified, but this SoundFile/libsndfile build has no "
                "MP3 decoder. Install a SoundFile build with MPEG support."
            )
        try:
            samples, sample_rate = sf.read(
                audio_path,
                dtype="float32",
                always_2d=True,
            )
        except Exception as error:
            if audio_format == "MP3":
                message = (
                    "MP3 header was detected, but the installed SoundFile/libsndfile "
                    f"decoder could not decode it: {error}"
                )
            else:
                message = (
                    f"{audio_format} header was detected, but decoding failed for "
                    f"{audio_path.name}: {error}"
                )
            raise AudioDecodeError(message) from error
        return DecodedAudio(
            samples=samples,
            sample_rate=int(sample_rate),
            channels=int(samples.shape[1]),
            source_format=audio_format,
        )

    @staticmethod
    def decode_raw_pcm(
        payload: bytes,
        sample_rate: int,
        channels: int,
        encoding: str,
    ) -> np.ndarray:
        if (
            isinstance(sample_rate, bool)
            or int(sample_rate) != sample_rate
            or sample_rate <= 0
            or isinstance(channels, bool)
            or int(channels) != channels
            or channels <= 0
        ):
            raise AudioValidationError("Raw PCM sample rate and channels must be positive.")
        channels = int(channels)
        encodings = {
            "int16": (np.dtype("<i2"), 32768.0),
            "s16le": (np.dtype("<i2"), 32768.0),
            "int32": (np.dtype("<i4"), 2147483648.0),
            "s32le": (np.dtype("<i4"), 2147483648.0),
            "uint8": (np.dtype("u1"), None),
            "float32": (np.dtype("<f4"), None),
            "f32le": (np.dtype("<f4"), None),
        }
        normalized_encoding = encoding.casefold()
        if normalized_encoding not in encodings:
            raise AudioFormatError(
                f"Unsupported raw PCM encoding {encoding!r}; use int16, int32, "
                "uint8, or float32."
            )
        dtype, scale = encodings[normalized_encoding]
        if len(payload) % dtype.itemsize:
            raise AudioValidationError(
                f"Raw PCM byte count is not aligned to {dtype.itemsize}-byte samples."
            )
        values = np.frombuffer(payload, dtype=dtype).copy()
        if len(values) % channels:
            raise AudioValidationError(
                "Raw PCM sample count is not divisible by the channel count."
            )
        if scale is not None:
            values = values.astype(np.float32) / scale
        elif normalized_encoding == "uint8":
            values = (values.astype(np.float32) - 128.0) / 128.0
        else:
            values = values.astype(np.float32)
        return values.reshape(-1, channels)

    @staticmethod
    def to_mono_float(samples: np.ndarray) -> tuple[np.ndarray, int]:
        array = np.asarray(samples)
        if array.ndim == 1:
            channels = 1
        elif array.ndim == 2 and array.shape[1] > 0:
            channels = int(array.shape[1])
        else:
            raise AudioValidationError(
                f"Audio must have shape (frames,) or (frames, channels), got {array.shape}."
            )
        if not np.issubdtype(array.dtype, np.number) or np.issubdtype(
            array.dtype, np.complexfloating
        ):
            raise AudioValidationError(f"Audio dtype must be numeric, got {array.dtype}.")
        if np.issubdtype(array.dtype, np.integer):
            info = np.iinfo(array.dtype)
            scale = float(max(abs(info.min), abs(info.max) + 1))
            array = array.astype(np.float32) / scale
        else:
            array = array.astype(np.float32, copy=False)
        if array.ndim == 2:
            array = np.mean(array, axis=1, dtype=np.float32)
        if not len(array):
            raise AudioValidationError("Audio contains no samples.")
        if not np.isfinite(array).all():
            raise AudioValidationError("Audio contains NaN or Inf values.")
        return np.ascontiguousarray(array, dtype=np.float32), channels

    def prepare(
        self,
        samples: np.ndarray,
        sample_rate: int,
        *,
        source_format: str | None = None,
        source_channels: int | None = None,
    ) -> tuple[np.ndarray, AudioQuality]:
        if isinstance(sample_rate, bool) or int(sample_rate) != sample_rate or sample_rate <= 0:
            raise AudioValidationError(f"Invalid sample rate: {sample_rate!r}")
        sample_rate = int(sample_rate)
        mono, channels = self.to_mono_float(samples)
        duration = len(mono) / sample_rate
        raw_rms = float(np.sqrt(np.mean(np.square(mono))))
        peak = float(np.max(np.abs(mono)))
        clipped_fraction = float(np.mean(np.abs(mono) >= CLIPPED_SAMPLE_THRESHOLD))
        warnings: list[str] = []
        if raw_rms < SILENCE_RMS_THRESHOLD:
            warnings.append("near-silence; model score is not reliable for this window")
        elif raw_rms < LOW_VOLUME_RMS_THRESHOLD:
            warnings.append("very low volume")
        if clipped_fraction >= CLIPPED_FRACTION_THRESHOLD:
            warnings.append("possible clipping")

        if sample_rate != SAMPLE_RATE:
            divisor = gcd(sample_rate, SAMPLE_RATE)
            mono = resample_poly(
                mono,
                SAMPLE_RATE // divisor,
                sample_rate // divisor,
            ).astype(np.float32)
        if len(mono) > TARGET_LENGTH:
            mono = mono[:TARGET_LENGTH]
        elif len(mono) < TARGET_LENGTH:
            mono = np.pad(mono, (0, TARGET_LENGTH - len(mono)))
        mono = np.ascontiguousarray(mono, dtype=np.float32)
        quality = AudioQuality(
            status="WARNING" if warnings else "OK",
            warnings=tuple(warnings),
            rms=raw_rms,
            peak_amplitude=peak,
            clipped_fraction=clipped_fraction,
            sample_rate=sample_rate,
            channels=source_channels or channels,
            duration_seconds=duration,
            source_format=source_format,
        )
        return mono, quality

    def prepare_file(
        self,
        path: str | Path,
        *,
        raw_sample_rate: int | None = None,
        raw_channels: int | None = None,
        raw_encoding: str | None = None,
    ) -> tuple[np.ndarray, AudioQuality]:
        decoded = self.decode_file(
            path,
            raw_sample_rate=raw_sample_rate,
            raw_channels=raw_channels,
            raw_encoding=raw_encoding,
        )
        return self.prepare(
            decoded.samples,
            decoded.sample_rate,
            source_format=decoded.source_format,
        )

    @staticmethod
    def normalize_features(
        features: np.ndarray, mean: np.ndarray, std: np.ndarray
    ) -> np.ndarray:
        normalized = (features[None, :, :] - mean) / (std + 1e-8)
        if not np.isfinite(normalized).all():
            raise AudioValidationError("Normalized LFCC contains NaN or Inf.")
        return normalized.astype(np.float32, copy=False)
