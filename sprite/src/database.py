"""Async SQLite database layer — TranscriptDB, MemoryDB, and WorkspaceDB.

Three databases with distinct access patterns:
- TranscriptDB: append-only conversation log (hooks write, daemon reads)
- MemoryDB: searchable learnings archive (daemon writes, agent reads via search_memory)
- WorkspaceDB: stacks, cards, and chat messages (gateway + agent tools)

Schemas must match bridge/src/bootstrap.ts INIT_DB_SCRIPT exactly.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time

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


WORKSPACE_SCHEMA = """\
CREATE TABLE IF NOT EXISTS stacks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    archived_at REAL,
    created_at REAL
);
CREATE TABLE IF NOT EXISTS cards (
    card_id TEXT PRIMARY KEY,
    stack_id TEXT NOT NULL,
    title TEXT NOT NULL,
    blocks TEXT,
    size TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'active',
    archived_at REAL,
    updated_at REAL,
    position_x REAL DEFAULT 0.0,
    position_y REAL DEFAULT 0.0,
    z_index INTEGER DEFAULT 0,
    FOREIGN KEY (stack_id) REFERENCES stacks(id)
);
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp REAL
);
CREATE TABLE IF NOT EXISTS documents (
    doc_id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT,
    file_path TEXT NOT NULL,
    card_id TEXT,
    status TEXT DEFAULT 'processing',
    created_at TEXT DEFAULT (datetime('now'))
);
"""


class WorkspaceDB(_BaseDB):
    """Stacks, cards, and chat messages. Gateway writes, agent reads via tools."""

    _schema = WORKSPACE_SCHEMA
    _default_path = "/workspace/.os/workspace.db"

    async def connect(self) -> None:
        await super().connect()
        await self._migrate_card_position_columns()
        await self._migrate_documents_table()

    async def _migrate_card_position_columns(self) -> None:
        """Add position columns to existing cards tables (CREATE TABLE IF NOT EXISTS won't)."""
        for col, typedef in [
            ("position_x", "REAL DEFAULT 0.0"),
            ("position_y", "REAL DEFAULT 0.0"),
            ("z_index", "INTEGER DEFAULT 0"),
        ]:
            try:
                await self._conn.execute(f"ALTER TABLE cards ADD COLUMN {col} {typedef}")
                await self._conn.commit()
                logger.info("Migrated cards table: added %s", col)
            except Exception:
                pass  # Column already exists

    async def _migrate_documents_table(self) -> None:
        """Create documents table on existing DBs that predate the schema addition."""
        try:
            await self._conn.execute(
                "CREATE TABLE IF NOT EXISTS documents ("
                "doc_id TEXT PRIMARY KEY, filename TEXT NOT NULL, mime_type TEXT, "
                "file_path TEXT NOT NULL, card_id TEXT, status TEXT DEFAULT 'processing', "
                "created_at TEXT DEFAULT (datetime('now')))"
            )
            await self._conn.commit()
        except Exception as e:
            logger.warning("_migrate_documents_table: %s", e)

    # -- Stacks ----------------------------------------------------------------

    async def create_stack(
        self, stack_id: str, name: str, color: str | None = None, sort_order: int = 0
    ) -> dict:
        now = time.time()
        await self.execute(
            "INSERT INTO stacks (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
            (stack_id, name, color, sort_order, now),
        )
        return await self.fetchone("SELECT * FROM stacks WHERE id = ?", (stack_id,))

    async def list_stacks(self) -> list[dict]:
        return await self.fetchall(
            "SELECT * FROM stacks WHERE status = 'active' ORDER BY sort_order"
        )

    async def list_all_stacks(self) -> list[dict]:
        return await self.fetchall("SELECT * FROM stacks ORDER BY sort_order")

    async def rename_stack(self, stack_id: str, name: str) -> None:
        await self.execute("UPDATE stacks SET name = ? WHERE id = ?", (name, stack_id))

    async def archive_stack(self, stack_id: str) -> None:
        """Archive stack and cascade to all its cards (transactional)."""
        now = time.time()
        await self._conn.execute(
            "UPDATE stacks SET status = 'archived', archived_at = ? WHERE id = ?",
            (now, stack_id),
        )
        await self._conn.execute(
            "UPDATE cards SET status = 'archived', archived_at = ? WHERE stack_id = ?",
            (now, stack_id),
        )
        await self._conn.commit()

    async def restore_stack(self, stack_id: str) -> None:
        """Restore stack and all its cards (transactional)."""
        await self._conn.execute(
            "UPDATE stacks SET status = 'active', archived_at = NULL WHERE id = ?",
            (stack_id,),
        )
        await self._conn.execute(
            "UPDATE cards SET status = 'active', archived_at = NULL WHERE stack_id = ?",
            (stack_id,),
        )
        await self._conn.commit()

    # -- Cards -----------------------------------------------------------------

    async def upsert_card(
        self,
        card_id: str,
        stack_id: str,
        title: str,
        blocks: list,
        size: str = "medium",
        position_x: float = 0.0,
        position_y: float = 0.0,
        z_index: int = 0,
    ) -> dict:
        now = time.time()
        blocks_json = json.dumps(blocks)
        await self.execute(
            "INSERT INTO cards (card_id, stack_id, title, blocks, size, updated_at, "
            "position_x, position_y, z_index) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(card_id) DO UPDATE SET "
            "title = excluded.title, blocks = excluded.blocks, "
            "size = excluded.size, updated_at = excluded.updated_at, "
            "position_x = excluded.position_x, position_y = excluded.position_y, "
            "z_index = excluded.z_index",
            (card_id, stack_id, title, blocks_json, size, now,
             position_x, position_y, z_index),
        )
        return await self.fetchone("SELECT * FROM cards WHERE card_id = ?", (card_id,))

    async def update_card_content(
        self, card_id: str, blocks: list, size: str | None = None
    ) -> dict | None:
        """Update only blocks (and optionally size) on an existing card."""
        now = time.time()
        if size:
            await self.execute(
                "UPDATE cards SET blocks = ?, size = ?, updated_at = ? WHERE card_id = ?",
                (json.dumps(blocks), size, now, card_id),
            )
        else:
            await self.execute(
                "UPDATE cards SET blocks = ?, updated_at = ? WHERE card_id = ?",
                (json.dumps(blocks), now, card_id),
            )
        return await self.fetchone("SELECT * FROM cards WHERE card_id = ?", (card_id,))

    async def update_card_position(
        self, card_id: str, position_x: float, position_y: float, z_index: int
    ) -> dict | None:
        """Update only position on an existing card. Returns None if card not found."""
        now = time.time()
        cursor = await self.execute(
            "UPDATE cards SET position_x = ?, position_y = ?, z_index = ?, updated_at = ? "
            "WHERE card_id = ?",
            (position_x, position_y, z_index, now, card_id),
        )
        if cursor.rowcount == 0:
            return None
        return await self.fetchone("SELECT * FROM cards WHERE card_id = ?", (card_id,))

    async def archive_card(self, card_id: str) -> None:
        now = time.time()
        await self.execute(
            "UPDATE cards SET status = 'archived', archived_at = ? WHERE card_id = ?",
            (now, card_id),
        )

    async def restore_card(self, card_id: str) -> None:
        await self.execute(
            "UPDATE cards SET status = 'active', archived_at = NULL WHERE card_id = ?",
            (card_id,),
        )

    async def get_cards_by_stack(self, stack_id: str) -> list[dict]:
        return await self.fetchall(
            "SELECT * FROM cards WHERE stack_id = ? AND status = 'active'",
            (stack_id,),
        )

    async def get_all_cards(self) -> list[dict]:
        return await self.fetchall("SELECT * FROM cards")

    # -- Chat ------------------------------------------------------------------

    async def add_chat_message(self, role: str, content: str) -> dict:
        now = time.time()
        cursor = await self.execute(
            "INSERT INTO chat_messages (role, content, timestamp) VALUES (?, ?, ?)",
            (role, content, now),
        )
        return await self.fetchone(
            "SELECT * FROM chat_messages WHERE id = ?", (cursor.lastrowid,)
        )

    async def get_chat_history(self, limit: int = 100) -> list[dict]:
        return await self.fetchall(
            "SELECT * FROM chat_messages ORDER BY id ASC "
            "LIMIT ? OFFSET MAX(0, (SELECT COUNT(*) FROM chat_messages) - ?)",
            (limit, limit),
        )

    # -- Documents -------------------------------------------------------------

    async def create_document(
        self, doc_id: str, filename: str, mime_type: str, file_path: str, card_id: str | None = None
    ) -> dict:
        await self.execute(
            "INSERT INTO documents (doc_id, filename, mime_type, file_path, card_id) "
            "VALUES (?, ?, ?, ?, ?)",
            (doc_id, filename, mime_type, file_path, card_id),
        )
        return await self.fetchone("SELECT * FROM documents WHERE doc_id = ?", (doc_id,))

    async def update_document_status(self, doc_id: str, status: str, card_id: str | None = None) -> None:
        if card_id is not None:
            await self.execute(
                "UPDATE documents SET status = ?, card_id = ? WHERE doc_id = ?",
                (status, card_id, doc_id),
            )
        else:
            await self.execute(
                "UPDATE documents SET status = ? WHERE doc_id = ?",
                (status, doc_id),
            )

    async def list_documents(self) -> list[dict]:
        return await self.fetchall("SELECT * FROM documents ORDER BY created_at DESC")
