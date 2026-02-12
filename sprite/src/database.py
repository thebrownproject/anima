"""Async SQLite database layer — TranscriptDB and MemoryDB.

Two databases with distinct access patterns:
- TranscriptDB: append-only conversation log (hooks write, daemon reads)
- MemoryDB: searchable learnings archive (daemon writes, agent reads via search_memory)

Schemas must match bridge/src/bootstrap.ts INIT_DB_SCRIPT exactly.
"""

from __future__ import annotations

import logging
import sqlite3

import aiosqlite

logger = logging.getLogger(__name__)

TRANSCRIPT_SCHEMA = """\
CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY,
    timestamp REAL,
    session_id TEXT,
    sequence_num INTEGER,
    user_message TEXT,
    tool_calls_json TEXT,
    agent_response TEXT,
    processed INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at REAL,
    ended_at REAL,
    message_count INTEGER,
    observation_count INTEGER
);
"""

MEMORY_SCHEMA = """\
CREATE TABLE IF NOT EXISTS learnings (
    id INTEGER PRIMARY KEY,
    created_at REAL,
    session_id TEXT,
    type TEXT,
    content TEXT,
    source_observation_id INTEGER,
    confidence REAL
);
CREATE TABLE IF NOT EXISTS pending_actions (
    id INTEGER PRIMARY KEY,
    created_at REAL,
    content TEXT,
    priority INTEGER,
    status TEXT,
    source_learning_id INTEGER
);
CREATE VIRTUAL TABLE IF NOT EXISTS learnings_fts USING fts5(
    content, type, content=learnings, content_rowid=id
);
CREATE TRIGGER IF NOT EXISTS learnings_ai AFTER INSERT ON learnings BEGIN
    INSERT INTO learnings_fts(rowid, content, type) VALUES (new.id, new.content, new.type);
END;
CREATE TRIGGER IF NOT EXISTS learnings_ad AFTER DELETE ON learnings BEGIN
    INSERT INTO learnings_fts(learnings_fts, rowid, content, type) VALUES ('delete', old.id, old.content, old.type);
END;
CREATE TRIGGER IF NOT EXISTS learnings_au AFTER UPDATE ON learnings BEGIN
    INSERT INTO learnings_fts(learnings_fts, rowid, content, type) VALUES ('delete', old.id, old.content, old.type);
    INSERT INTO learnings_fts(learnings_fts, rowid, content, type) VALUES (new.id, new.content, new.type);
END;
"""


class _BaseDB:
    """Shared async SQLite wrapper. WAL mode, busy_timeout=5000, foreign_keys=ON."""

    _schema: str = ""
    _default_path: str = ""

    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = db_path or self._default_path
        self._conn: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        self._conn = await aiosqlite.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        await self._conn.execute("PRAGMA journal_mode=WAL")
        await self._conn.execute("PRAGMA foreign_keys=ON")
        await self._conn.execute("PRAGMA busy_timeout=5000")
        await self._conn.executescript(self._schema)
        logger.info("Database connected: %s", self.db_path)

    async def close(self) -> None:
        if self._conn:
            await self._conn.close()
            self._conn = None

    async def execute(self, sql: str, params: tuple = ()) -> aiosqlite.Cursor:
        cursor = await self._conn.execute(sql, params)
        await self._conn.commit()
        return cursor

    async def executemany(self, sql: str, params_list: list[tuple]) -> aiosqlite.Cursor:
        cursor = await self._conn.executemany(sql, params_list)
        await self._conn.commit()
        return cursor

    async def fetchone(self, sql: str, params: tuple = ()) -> dict | None:
        cursor = await self._conn.execute(sql, params)
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def fetchall(self, sql: str, params: tuple = ()) -> list[dict]:
        cursor = await self._conn.execute(sql, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()


class TranscriptDB(_BaseDB):
    """Append-only conversation transcript. Hooks write observations, daemon reads for processing."""
    _schema = TRANSCRIPT_SCHEMA
    _default_path = "/workspace/.os/memory/transcript.db"


class MemoryDB(_BaseDB):
    """Searchable learnings archive with FTS5. Daemon writes, agent reads via search_memory."""
    _schema = MEMORY_SCHEMA
    _default_path = "/workspace/.os/memory/memory.db"
