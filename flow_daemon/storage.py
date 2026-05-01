from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


class Storage:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def start_session(self, model_name: str, device_name: str, language: str) -> int:
        with sqlite3.connect(self.database_path) as connection:
            cursor = connection.execute(
                """
                INSERT INTO sessions (started_at, model_name, device_name, language)
                VALUES (?, ?, ?, ?)
                """,
                (self._now(), model_name, device_name, language),
            )
            return int(cursor.lastrowid)

    def end_session(self, session_id: int) -> None:
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                "UPDATE sessions SET ended_at = ? WHERE id = ?",
                (self._now(), session_id),
            )

    def add_utterance(
        self,
        session_id: int,
        text: str,
        duration_ms: int,
        latency_ms: int,
        injected: bool,
    ) -> int:
        with sqlite3.connect(self.database_path) as connection:
            cursor = connection.execute(
                """
                INSERT INTO utterances (
                    session_id,
                    created_at,
                    text,
                    duration_ms,
                    latency_ms,
                    injected
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (session_id, self._now(), text, duration_ms, latency_ms, int(injected)),
            )
            return int(cursor.lastrowid)

    def mark_injected(self, utterance_id: int, injected: bool) -> None:
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                "UPDATE utterances SET injected = ? WHERE id = ?",
                (int(injected), utterance_id),
            )

    def list_recent_utterances(self, limit: int = 100) -> list[dict[str, Any]]:
        with sqlite3.connect(self.database_path) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT
                    utterances.id,
                    utterances.text,
                    utterances.created_at,
                    utterances.duration_ms,
                    utterances.latency_ms,
                    utterances.injected,
                    sessions.id AS session_id,
                    sessions.model_name,
                    sessions.device_name,
                    sessions.language
                FROM utterances
                JOIN sessions ON sessions.id = utterances.session_id
                ORDER BY utterances.created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [dict(row) for row in rows]

    def _initialize(self) -> None:
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    model_name TEXT NOT NULL,
                    device_name TEXT NOT NULL,
                    language TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS utterances (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    text TEXT NOT NULL,
                    duration_ms INTEGER NOT NULL,
                    latency_ms INTEGER NOT NULL,
                    injected INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (session_id) REFERENCES sessions(id)
                )
                """
            )

    @staticmethod
    def _now() -> str:
        return datetime.now(UTC).isoformat(timespec="seconds")
