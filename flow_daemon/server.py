from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any

from websockets.asyncio.server import ServerConnection, serve

from flow_daemon.audio import Recorder
from flow_daemon.storage import Storage
from flow_daemon.transcription import WhisperEngine

STATE_CHANGED_EVENT = "state.changed"
TRANSCRIPT_FINAL_EVENT = "transcript.final"


class FlowDaemon:
    def __init__(self) -> None:
        self.model_name = os.getenv("FLOW_MODEL", "small.en")
        self.language = os.getenv("FLOW_LANGUAGE", "en")
        self.recorder = Recorder()
        self.engine = WhisperEngine(model_name=self.model_name)
        db_path = os.getenv("FLOW_DATABASE_PATH", Path(".flow") / "history.db")
        self.storage = Storage(Path(db_path))
        self.clients: set[ServerConnection] = set()
        self.current_session_id: int | None = None

    async def handle(self, websocket: ServerConnection) -> None:
        self.clients.add(websocket)
        await websocket.send(json.dumps(self._event(STATE_CHANGED_EVENT, self._state())))
        try:
            async for message in websocket:
                payload = json.loads(message)
                response = await self._dispatch(payload)
                await websocket.send(json.dumps(response))
        finally:
            self.clients.discard(websocket)

    async def _dispatch(self, payload: dict[str, Any]) -> dict[str, Any]:
        command = payload.get("command")
        request_id = payload.get("id")

        try:
            if command == "ping":
                data = {"pong": True}
            elif command == "state.get":
                data = self._state()
            elif command == "dictation.start":
                data = await self._start_dictation()
            elif command == "dictation.stop":
                data = await self._stop_dictation()
            elif command == "dictation.toggle":
                data = await self._stop_dictation() if self.recorder.is_recording else await self._start_dictation()
            elif command == "history.list":
                limit = int(payload.get("payload", {}).get("limit", 100))
                data = {"items": self.storage.list_recent_utterances(limit=limit)}
            elif command == "history.mark_injected":
                utterance_id = int(payload.get("payload", {}).get("utteranceId"))
                injected = bool(payload.get("payload", {}).get("injected"))
                self.storage.mark_injected(utterance_id, injected)
                data = {"utteranceId": utterance_id, "injected": injected}
            else:
                raise ValueError(f"Unknown command: {command}")

            return {"id": request_id, "ok": True, "data": data}
        except Exception as exc:  # noqa: BLE001
            return {"id": request_id, "ok": False, "error": str(exc)}

    async def _start_dictation(self) -> dict[str, Any]:
        if self.recorder.is_recording:
            return self._state()

        self.current_session_id = self.storage.start_session(
            model_name=self.model_name,
            device_name="default",
            language=self.language,
        )
        self.recorder.start()
        state = self._state()
        await self._broadcast(self._event(STATE_CHANGED_EVENT, state))
        return state

    async def _stop_dictation(self) -> dict[str, Any]:
        if not self.recorder.is_recording:
            return self._state()

        session_id = self.current_session_id
        result = self.recorder.stop()
        self.current_session_id = None

        if session_id is None:
            return self._state()

        started = time.perf_counter()
        transcript = await asyncio.to_thread(self.engine.transcribe, result.samples, self.language)
        latency_ms = int((time.perf_counter() - started) * 1000)
        text = transcript["text"].strip()

        utterance_id: int | None = None
        if text:
            utterance_id = self.storage.add_utterance(
                session_id=session_id,
                text=text,
                duration_ms=result.duration_ms,
                latency_ms=latency_ms,
                injected=False,
            )
            await self._broadcast(
                self._event(
                    TRANSCRIPT_FINAL_EVENT,
                    {
                        "utteranceId": utterance_id,
                        "sessionId": session_id,
                        "text": text,
                        "durationMs": result.duration_ms,
                        "latencyMs": latency_ms,
                        "language": transcript["language"],
                    },
                )
            )

        self.storage.end_session(session_id)
        state = self._state()
        await self._broadcast(self._event(STATE_CHANGED_EVENT, state))
        return {**state, "text": text, "utteranceId": utterance_id}

    async def _broadcast(self, payload: dict[str, Any]) -> None:
        if not self.clients:
            return

        message = json.dumps(payload)
        for client in self.clients.copy():
            try:
                await client.send(message)
            except Exception:  # noqa: BLE001
                self.clients.discard(client)

    def _event(self, event: str, data: dict[str, Any]) -> dict[str, Any]:
        return {"event": event, "data": data}

    def _state(self) -> dict[str, Any]:
        return {
            "recording": self.recorder.is_recording,
            "model": self.model_name,
            "language": self.language,
        }


async def run() -> None:
    daemon = FlowDaemon()
    host = os.getenv("FLOW_DAEMON_HOST", "127.0.0.1")
    port = int(os.getenv("FLOW_DAEMON_PORT", "8765"))
    async with serve(daemon.handle, host, port):
        print(f"Flow daemon listening on ws://{host}:{port}")
        await asyncio.Future()


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
