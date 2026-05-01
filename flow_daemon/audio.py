from __future__ import annotations

import threading
from dataclasses import dataclass

import numpy as np
import sounddevice as sd


@dataclass(slots=True)
class AudioCaptureResult:
    samples: np.ndarray
    duration_ms: int


class Recorder:
    def __init__(self, samplerate: int = 16_000, channels: int = 1) -> None:
        self.samplerate = samplerate
        self.channels = channels
        self._chunks: list[np.ndarray] = []
        self._stream: sd.InputStream | None = None
        self._lock = threading.Lock()

    @property
    def is_recording(self) -> bool:
        return self._stream is not None

    def start(self) -> None:
        with self._lock:
            if self._stream is not None:
                return

            self._chunks = []
            self._stream = sd.InputStream(
                samplerate=self.samplerate,
                channels=self.channels,
                dtype="float32",
                callback=self._on_audio,
            )
            self._stream.start()

    def stop(self) -> AudioCaptureResult:
        with self._lock:
            if self._stream is None:
                return AudioCaptureResult(samples=np.array([], dtype=np.float32), duration_ms=0)

            stream = self._stream
            self._stream = None

        stream.stop()
        stream.close()

        if not self._chunks:
            return AudioCaptureResult(samples=np.array([], dtype=np.float32), duration_ms=0)

        samples = np.concatenate(self._chunks, axis=0).reshape(-1)
        duration_ms = int(len(samples) / self.samplerate * 1000)
        return AudioCaptureResult(samples=samples, duration_ms=duration_ms)

    def _on_audio(self, indata, frames, time, status) -> None:
        if status:
            return
        self._chunks.append(indata.copy())
