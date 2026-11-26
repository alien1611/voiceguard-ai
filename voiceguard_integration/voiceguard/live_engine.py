from pathlib import Path
from queue import Empty, Full, Queue
from threading import Event
from typing import Callable
import logging
import math
import time

import numpy as np

from .audio_processor import AudioProcessor
from .exceptions import AudioValidationError, MicrophoneError, SessionError
from .schemas import AlertEvent, ProcessingErrorResult


LOGGER = logging.getLogger(__name__)


class RollingAudioBuffer:
    """Fixed-capacity source-rate mono ring with exact complete-window scheduling."""

    def __init__(
        self,
        sample_rate: int,
        window_seconds: float,
        update_seconds: float,
    ) -> None:
        self.sample_rate = sample_rate
        self.capacity = int(round(sample_rate * window_seconds))
        self.update_samples = int(round(sample_rate * update_seconds))
        if self.capacity < 1 or self.update_samples < 1:
            raise SessionError("Window/update durations are too small for this sample rate.")
        self.samples = np.zeros(self.capacity, dtype=np.float32)
        self.write_index = 0
        self.valid_samples = 0
        self.samples_since_prediction = 0
        self._first_window_pending = True
        self.total_samples = 0

    def append(self, chunk: np.ndarray) -> tuple[np.ndarray, ...]:
        windows: list[np.ndarray] = []
        offset = 0
        while offset < len(chunk):
            if self._first_window_pending:
                needed = self.capacity - self.valid_samples
            else:
                needed = self.update_samples - self.samples_since_prediction
            count = min(needed, len(chunk) - offset)
            self._append_part(chunk[offset : offset + count])
            offset += count
            self.samples_since_prediction += count
            self.total_samples += count
            ready = (
                self.valid_samples == self.capacity
                and (
                    self._first_window_pending
                    or self.samples_since_prediction >= self.update_samples
                )
            )
            if ready:
                windows.append(self.snapshot())
                self._first_window_pending = False
                self.samples_since_prediction = 0
        return tuple(windows)

    def _append_part(self, audio: np.ndarray) -> None:
        count = len(audio)
        if count >= self.capacity:
            self.samples[:] = audio[-self.capacity :]
            self.write_index = 0
            self.valid_samples = self.capacity
            return
        end = self.write_index + count
        if end <= self.capacity:
            self.samples[self.write_index : end] = audio
        else:
            first = self.capacity - self.write_index
            self.samples[self.write_index :] = audio[:first]
            self.samples[: end % self.capacity] = audio[first:]
        self.write_index = end % self.capacity
        self.valid_samples = min(self.capacity, self.valid_samples + count)

    def snapshot(self) -> np.ndarray:
        if self.valid_samples != self.capacity:
            raise SessionError("A partial audio window cannot be analyzed.")
        return np.concatenate(
            (self.samples[self.write_index :], self.samples[: self.write_index])
        )


class AudioChunkEngine:
    """Accept application-supplied chunks without microphone-library coupling."""

    def __init__(
        self,
        *,
        window_seconds: float,
        update_seconds: float,
        sample_rate: int | None = None,
        processor: AudioProcessor | None = None,
    ) -> None:
        if window_seconds <= 0 or update_seconds <= 0:
            raise SessionError("Window and update durations must be positive.")
        if update_seconds > window_seconds:
            raise SessionError("update_seconds cannot exceed window_seconds.")
        self.window_seconds = float(window_seconds)
        self.update_seconds = float(update_seconds)
        self.processor = processor or AudioProcessor()
        if sample_rate is not None and sample_rate <= 0:
            raise SessionError("Configured session sample rate must be positive.")
        self.sample_rate: int | None = sample_rate
        self.channels: int | None = None
        self.buffer: RollingAudioBuffer | None = (
            RollingAudioBuffer(sample_rate, window_seconds, update_seconds)
            if sample_rate is not None
            else None
        )

    def push(
        self, audio_chunk: np.ndarray, sample_rate: int
    ) -> tuple[np.ndarray, ...]:
        if isinstance(sample_rate, bool) or int(sample_rate) != sample_rate or sample_rate <= 0:
            raise AudioValidationError(f"Invalid chunk sample rate: {sample_rate!r}")
        sample_rate = int(sample_rate)
        mono, channels = self.processor.to_mono_float(audio_chunk)
        if self.sample_rate is None:
            self.sample_rate = sample_rate
            self.buffer = RollingAudioBuffer(
                sample_rate, self.window_seconds, self.update_seconds
            )
        elif sample_rate != self.sample_rate:
            raise SessionError(
                f"Session input rate changed from {self.sample_rate} to {sample_rate} Hz; "
                "resample consistently upstream or start a new session."
            )
        if self.channels is None:
            self.channels = channels
        elif channels != self.channels:
            raise SessionError(
                f"Session channel count changed from {self.channels} to {channels}."
            )
        return self.buffer.append(mono)

    @property
    def buffered_samples(self) -> int:
        return 0 if self.buffer is None else self.buffer.valid_samples

    @property
    def required_samples(self) -> int | None:
        if self.sample_rate is None:
            return None
        return int(round(self.sample_rate * self.window_seconds))


class MicrophoneRunner:
    """Optional sounddevice adapter; the core chunk engine has no sounddevice dependency."""

    def __init__(
        self, detector, queue_blocks: int | None = None, block_size: int = 1024
    ):
        queue_blocks = (
            detector.config.queue_blocks if queue_blocks is None else queue_blocks
        )
        if queue_blocks < 1 or block_size < 1:
            raise ValueError("queue_blocks and block_size must be positive.")
        self.detector = detector
        self.queue_blocks = queue_blocks
        self.block_size = block_size

    def run(
        self,
        *,
        session_id: str,
        device_index: int | None = None,
        stop_event: Event | None = None,
        save_recording: str | Path | None = None,
        on_prediction: Callable | None = None,
        on_event: Callable[[AlertEvent], None] | None = None,
        max_runtime_seconds: float | None = None,
    ) -> dict:
        try:
            import sounddevice as sd
            import soundfile as sf
        except ImportError as error:
            raise MicrophoneError(
                "Microphone capture requires the optional sounddevice and soundfile packages."
            ) from error
        if max_runtime_seconds is not None and (
            not math.isfinite(max_runtime_seconds) or max_runtime_seconds <= 0
        ):
            raise ValueError("max_runtime_seconds must be positive.")
        stop_event = stop_event or Event()
        try:
            device_info = sd.query_devices(device_index, kind="input")
            sample_rate = int(round(float(device_info["default_samplerate"])))
        except Exception as error:
            raise MicrophoneError(f"Could not query the input device: {error}") from error
        if sample_rate <= 0:
            raise MicrophoneError(f"Input device has an invalid sample rate: {sample_rate}.")

        recording_path = (
            Path(save_recording).expanduser().resolve()
            if save_recording is not None
            else None
        )
        writer = None
        file_handle = None
        recorded_frames = 0
        blocks: Queue = Queue(maxsize=self.queue_blocks)
        stream_statuses: Queue = Queue(maxsize=1)
        callback_dropped_frames = 0
        callback_frames = 0
        queue_overflow = Event()
        runtime_start = time.perf_counter()
        stats = {
            "prediction_count": 0,
            "inference_time_sum_ms": 0.0,
            "maximum_inference_time_ms": 0.0,
            "interval_count": 0,
            "interval_sum_seconds": 0.0,
            "maximum_interval_seconds": 0.0,
            "last_prediction_time": None,
            "queue_high_water_blocks": 0,
        }
        session_started = False

        def consume_block(block: np.ndarray) -> None:
            nonlocal recorded_frames
            if writer is not None:
                writer.write(block)
                recorded_frames += len(block)
            if not stream_statuses.empty():
                status = stream_statuses.get_nowait()
                LOGGER.warning("Microphone stream status: %s", status)
            chunk_result = self.detector.process_audio_chunk(
                block, sample_rate, session_id=session_id
            )
            if isinstance(chunk_result, ProcessingErrorResult):
                LOGGER.error(
                    "Audio chunk processing failed for %s: %s",
                    session_id,
                    chunk_result.message,
                )
                return
            for prediction in chunk_result.predictions:
                now = time.perf_counter()
                stats["prediction_count"] += 1
                stats["inference_time_sum_ms"] += prediction.inference_time_ms
                stats["maximum_inference_time_ms"] = max(
                    stats["maximum_inference_time_ms"],
                    prediction.inference_time_ms,
                )
                previous = stats["last_prediction_time"]
                if previous is not None:
                    interval = now - previous
                    stats["interval_count"] += 1
                    stats["interval_sum_seconds"] += interval
                    stats["maximum_interval_seconds"] = max(
                        stats["maximum_interval_seconds"], interval
                    )
                stats["last_prediction_time"] = now
                if on_prediction is not None:
                    on_prediction(prediction)

        def audio_callback(indata, frames, time_info, status):
            nonlocal callback_dropped_frames, callback_frames
            callback_frames += frames
            if status:
                try:
                    stream_statuses.put_nowait(str(status))
                except Full:
                    pass
            try:
                blocks.put_nowait(indata[:, 0].copy())
            except Full:
                callback_dropped_frames += frames
                queue_overflow.set()

        try:
            if recording_path is not None:
                if recording_path.suffix.casefold() != ".wav":
                    raise MicrophoneError("Recording export path must end in .wav.")
                if not recording_path.parent.is_dir():
                    raise MicrophoneError(
                        f"Recording directory does not exist: {recording_path.parent}"
                    )
                file_handle = recording_path.open("xb")
                try:
                    writer = sf.SoundFile(
                        file_handle,
                        mode="w",
                        samplerate=sample_rate,
                        channels=1,
                        format="WAV",
                        subtype="FLOAT",
                        closefd=True,
                    )
                except Exception:
                    file_handle.close()
                    recording_path.unlink(missing_ok=True)
                    raise

            start_events = self.detector.start_session(
                session_id,
                sample_rate=sample_rate,
                window_seconds=self.detector.config.window_seconds,
                update_seconds=self.detector.config.update_seconds,
            )
            session_started = True
            if on_event is not None:
                for event in start_events:
                    on_event(event)
            LOGGER.info(
                "Microphone session %s recording at %d Hz on device %s",
                session_id,
                sample_rate,
                device_index if device_index is not None else "default",
            )
            try:
                with sd.InputStream(
                    device=device_index,
                    samplerate=sample_rate,
                    channels=1,
                    dtype="float32",
                    blocksize=self.block_size,
                    callback=audio_callback,
                ) as stream:
                    while not stop_event.is_set():
                        if (
                            max_runtime_seconds is not None
                            and time.perf_counter() - runtime_start >= max_runtime_seconds
                        ):
                            break
                        if not stream.active:
                            raise MicrophoneError("Microphone stream disconnected.")
                        if queue_overflow.is_set():
                            raise MicrophoneError(
                                f"Audio queue overflowed; {callback_dropped_frames} frames "
                                "were dropped."
                            )
                        try:
                            block = blocks.get(timeout=0.25)
                        except Empty:
                            continue
                        stats["queue_high_water_blocks"] = max(
                            stats["queue_high_water_blocks"], blocks.qsize()
                        )
                        consume_block(block)
            except KeyboardInterrupt:
                LOGGER.info("Microphone session %s stopping after Ctrl+C.", session_id)
        except MicrophoneError:
            raise
        except Exception as error:
            raise MicrophoneError(f"Microphone capture failed: {error}") from error
        finally:
            cleanup_error = None
            while True:
                try:
                    block = blocks.get_nowait()
                except Empty:
                    break
                try:
                    consume_block(block)
                except Exception as error:
                    cleanup_error = error
                    break
            try:
                if writer is not None:
                    writer.close()
            except Exception as error:
                cleanup_error = cleanup_error or error
            finally:
                if file_handle is not None and not file_handle.closed:
                    try:
                        file_handle.close()
                    except Exception as error:
                        cleanup_error = cleanup_error or error
                if session_started:
                    try:
                        stop_events = self.detector.stop_session(session_id)
                        if on_event is not None:
                            for event in stop_events:
                                on_event(event)
                    except Exception as error:
                        cleanup_error = cleanup_error or error
            if cleanup_error is not None:
                raise MicrophoneError(
                    f"Microphone cleanup failed: {cleanup_error}"
                ) from cleanup_error

        elapsed = max(time.perf_counter() - runtime_start, 1e-9)
        if recording_path is not None:
            LOGGER.info(
                "Raw microphone WAV saved: %s (%.3f s, %d Hz, mono float32).",
                recording_path,
                recorded_frames / sample_rate,
                sample_rate,
            )
        stats["elapsed_seconds"] = elapsed
        stats["captured_frames"] = callback_frames
        stats["recorded_frames"] = recorded_frames
        stats["dropped_frames"] = callback_dropped_frames
        stats["sample_rate"] = sample_rate
        stats["average_inference_time_ms"] = (
            stats["inference_time_sum_ms"] / stats["prediction_count"]
            if stats["prediction_count"]
            else None
        )
        stats["average_prediction_interval_seconds"] = (
            stats["interval_sum_seconds"] / stats["interval_count"]
            if stats["interval_count"]
            else None
        )
        return stats
