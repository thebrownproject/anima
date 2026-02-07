"""Async SQLite database layer for the Sprite runtime."""

from __future__ import annotations

import logging
import sqlite3

import aiosqlite

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = "/workspace/agent.db"

# Schema DDL -- must match bridge/src/bootstrap.ts lines 51-89 exactly
SCHEMA = """\
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    status TEXT DEFAULT 'processing' CHECK(status IN ('processing','ocr_complete','completed','failed')),
    display_name TEXT,
    tags TEXT,
    summary TEXT,
    session_id TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ocr_results (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL UNIQUE REFERENCES documents(id),
    ocr_file_path TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS extractions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    extracted_fields TEXT NOT NULL,
    confidence_scores TEXT,
    mode TEXT NOT NULL,
    custom_fields TEXT,
    status TEXT DEFAULT 'completed' CHECK(status IN ('pending','in_progress','completed','failed')),
    session_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    chunk_id, content, source_file, agent_id
);
"""


class Database:
    """Async SQLite wrapper. Single connection for MVP, WAL mode for concurrent reads."""

    def __init__(self, db_path: str = DEFAULT_DB_PATH) -> None:
        self.db_path = db_path
        self._conn: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        self._conn = await aiosqlite.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        await self._conn.execute("PRAGMA journal_mode=WAL")
        await self._conn.execute("PRAGMA foreign_keys=ON")
        await self._conn.executescript(SCHEMA)
        logger.info("Database connected: %s", self.db_path)

    async def close(self) -> None:
        if self._conn:
            await self._conn.close()
            self._conn = None

    async def execute(self, sql: str, params: tuple = ()) -> aiosqlite.Cursor:
        """Execute a write operation (INSERT/UPDATE/DELETE). Auto-commits."""
        cursor = await self._conn.execute(sql, params)
        await self._conn.commit()
        return cursor

    async def executemany(self, sql: str, params_list: list[tuple]) -> aiosqlite.Cursor:
        cursor = await self._conn.executemany(sql, params_list)
        await self._conn.commit()
        return cursor

    async def fetchone(self, sql: str, params: tuple = ()) -> dict | None:
        """Execute a query and return one row as a dict, or None."""
        cursor = await self._conn.execute(sql, params)
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def fetchall(self, sql: str, params: tuple = ()) -> list[dict]:
        """Execute a query and return all rows as dicts."""
        cursor = await self._conn.execute(sql, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    # Alias expected by downstream tool factories (m7b.3.2)
    query = fetchall

    async def __aenter__(self) -> Database:
        await self.connect()
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()
