"""Tests for TranscriptDB and MemoryDB async SQLite layers."""

from __future__ import annotations

import asyncio
import os

import pytest

from src.database import TranscriptDB, MemoryDB


# -- Fixtures ----------------------------------------------------------------

@pytest.fixture
async def transcript_db(tmp_path):
    path = str(tmp_path / "transcript.db")
    db = TranscriptDB(db_path=path)
    await db.connect()
    yield db
    await db.close()


@pytest.fixture
async def memory_db(tmp_path):
    path = str(tmp_path / "memory.db")
    db = MemoryDB(db_path=path)
    await db.connect()
    yield db
    await db.close()


# -- TranscriptDB schema ----------------------------------------------------

async def test_transcript_tables_created(transcript_db):
    """transcript.db has observations and sessions tables."""
    rows = await transcript_db.fetchall(
        "SELECT name FROM sqlite_master WHERE type IN ('table') "
        "AND name NOT LIKE 'sqlite_%'"
    )
    names = {r["name"] for r in rows}
    assert {"observations", "sessions"}.issubset(names)


async def test_transcript_wal_mode(transcript_db):
    row = await transcript_db.fetchone("PRAGMA journal_mode")
    assert row["journal_mode"] == "wal"


async def test_transcript_busy_timeout(transcript_db):
    row = await transcript_db.fetchone("PRAGMA busy_timeout")
    assert row["timeout"] == 5000


async def test_transcript_default_path():
    db = TranscriptDB()
    assert db.db_path == "/workspace/.os/memory/transcript.db"


# -- TranscriptDB CRUD ------------------------------------------------------

async def test_observations_insert_and_select(transcript_db):
    await transcript_db.execute(
        "INSERT INTO observations (timestamp, session_id, sequence_num, user_message, agent_response) "
        "VALUES (?, ?, ?, ?, ?)",
        (1707700000.0, "sess-1", 1, "Hello", "Hi there"),
    )
    row = await transcript_db.fetchone("SELECT * FROM observations WHERE session_id = ?", ("sess-1",))
    assert row["user_message"] == "Hello"
    assert row["agent_response"] == "Hi there"
    assert row["processed"] == 0  # default


async def test_observations_tool_calls_json(transcript_db):
    import json
    tools = json.dumps([{"tool": "bash", "input": "ls"}])
    await transcript_db.execute(
        "INSERT INTO observations (timestamp, session_id, sequence_num, user_message, tool_calls_json, agent_response) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (1707700001.0, "sess-1", 2, "List files", tools, "Here are the files"),
    )
    row = await transcript_db.fetchone("SELECT * FROM observations WHERE sequence_num = ?", (2,))
    assert json.loads(row["tool_calls_json"]) == [{"tool": "bash", "input": "ls"}]


async def test_sessions_insert_and_select(transcript_db):
    await transcript_db.execute(
        "INSERT INTO sessions (id, started_at, ended_at, message_count, observation_count) "
        "VALUES (?, ?, ?, ?, ?)",
        ("sess-abc", 1707700000.0, 1707703600.0, 10, 5),
    )
    row = await transcript_db.fetchone("SELECT * FROM sessions WHERE id = ?", ("sess-abc",))
    assert row["message_count"] == 10
    assert row["observation_count"] == 5


# -- MemoryDB schema --------------------------------------------------------

async def test_memory_tables_created(memory_db):
    """memory.db has learnings, pending_actions tables and learnings_fts virtual table."""
    rows = await memory_db.fetchall(
        "SELECT name FROM sqlite_master WHERE type IN ('table') "
        "AND name NOT LIKE 'sqlite_%'"
    )
    names = {r["name"] for r in rows}
    assert {"learnings", "pending_actions", "learnings_fts"}.issubset(names)


async def test_memory_fts5_virtual_table(memory_db):
    rows = await memory_db.fetchall(
        "SELECT sql FROM sqlite_master WHERE name = 'learnings_fts'"
    )
    assert len(rows) == 1
    assert "fts5" in rows[0]["sql"].lower()


async def test_memory_wal_mode(memory_db):
    row = await memory_db.fetchone("PRAGMA journal_mode")
    assert row["journal_mode"] == "wal"


async def test_memory_busy_timeout(memory_db):
    row = await memory_db.fetchone("PRAGMA busy_timeout")
    assert row["timeout"] == 5000


async def test_memory_default_path():
    db = MemoryDB()
    assert db.db_path == "/workspace/.os/memory/memory.db"


# -- MemoryDB CRUD ----------------------------------------------------------

async def test_learnings_insert_and_select(memory_db):
    await memory_db.execute(
        "INSERT INTO learnings (created_at, session_id, type, content, source_observation_id, confidence) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (1707700000.0, "sess-1", "FACT", "User prefers dark mode", 1, 0.9),
    )
    row = await memory_db.fetchone("SELECT * FROM learnings WHERE session_id = ?", ("sess-1",))
    assert row["type"] == "FACT"
    assert row["content"] == "User prefers dark mode"
    assert row["confidence"] == 0.9


async def test_learnings_fts_search(memory_db):
    await memory_db.execute(
        "INSERT INTO learnings (created_at, session_id, type, content, source_observation_id, confidence) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (1707700000.0, "sess-1", "FACT", "User prefers dark mode", 1, 0.9),
    )
    await memory_db.execute(
        "INSERT INTO learnings (created_at, session_id, type, content, source_observation_id, confidence) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (1707700001.0, "sess-1", "PREFERENCE", "Dates should be DD/MM/YYYY", 2, 0.95),
    )
    # FTS5 search
    rows = await memory_db.fetchall(
        "SELECT content, type FROM learnings_fts WHERE learnings_fts MATCH ?",
        ("dark mode",),
    )
    assert len(rows) == 1
    assert rows[0]["content"] == "User prefers dark mode"


async def test_pending_actions_insert_and_select(memory_db):
    await memory_db.execute(
        "INSERT INTO pending_actions (created_at, content, priority, status, source_learning_id) "
        "VALUES (?, ?, ?, ?, ?)",
        (1707700000.0, "Set up Xero integration", 1, "pending", 1),
    )
    row = await memory_db.fetchone("SELECT * FROM pending_actions WHERE status = ?", ("pending",))
    assert row["content"] == "Set up Xero integration"
    assert row["priority"] == 1


async def test_pending_actions_status_update(memory_db):
    await memory_db.execute(
        "INSERT INTO pending_actions (created_at, content, priority, status) "
        "VALUES (?, ?, ?, ?)",
        (1707700000.0, "Install pandas", 2, "pending"),
    )
    row = await memory_db.fetchone("SELECT * FROM pending_actions WHERE status = ?", ("pending",))
    await memory_db.execute(
        "UPDATE pending_actions SET status = ? WHERE id = ?",
        ("completed", row["id"]),
    )
    updated = await memory_db.fetchone("SELECT * FROM pending_actions WHERE id = ?", (row["id"],))
    assert updated["status"] == "completed"


# -- Old Database class is gone ---------------------------------------------

async def test_old_database_class_removed():
    """The old Database class no longer exists in database.py."""
    import importlib
    mod = importlib.import_module("src.database")
    assert not hasattr(mod, "Database"), "Old Database class should be deleted"


# -- Context manager --------------------------------------------------------

async def test_transcript_context_manager(tmp_path):
    path = str(tmp_path / "ctx_transcript.db")
    async with TranscriptDB(db_path=path) as db:
        rows = await db.fetchall(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'observations'"
        )
        assert len(rows) == 1


async def test_memory_context_manager(tmp_path):
    path = str(tmp_path / "ctx_memory.db")
    async with MemoryDB(db_path=path) as db:
        rows = await db.fetchall(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'learnings'"
        )
        assert len(rows) == 1


# -- Idempotent schema ------------------------------------------------------

async def test_transcript_schema_idempotent(tmp_path):
    path = str(tmp_path / "idem_transcript.db")
    db1 = TranscriptDB(db_path=path)
    await db1.connect()
    await db1.close()
    db2 = TranscriptDB(db_path=path)
    await db2.connect()
    rows = await db2.fetchall(
        "SELECT name FROM sqlite_master WHERE type IN ('table') AND name NOT LIKE 'sqlite_%'"
    )
    assert {"observations", "sessions"}.issubset({r["name"] for r in rows})
    await db2.close()


async def test_memory_schema_idempotent(tmp_path):
    path = str(tmp_path / "idem_memory.db")
    db1 = MemoryDB(db_path=path)
    await db1.connect()
    await db1.close()
    db2 = MemoryDB(db_path=path)
    await db2.connect()
    rows = await db2.fetchall(
        "SELECT name FROM sqlite_master WHERE type IN ('table') AND name NOT LIKE 'sqlite_%'"
    )
    assert {"learnings", "pending_actions", "learnings_fts"}.issubset({r["name"] for r in rows})
    await db2.close()


# -- File creation -----------------------------------------------------------

async def test_db_files_created_at_path(tmp_path):
    t_path = str(tmp_path / "t.db")
    m_path = str(tmp_path / "m.db")
    assert not os.path.exists(t_path)
    assert not os.path.exists(m_path)

    t = TranscriptDB(db_path=t_path)
    await t.connect()
    assert os.path.exists(t_path)
    await t.close()

    m = MemoryDB(db_path=m_path)
    await m.connect()
    assert os.path.exists(m_path)
    await m.close()


# -- Concurrent reads (WAL) -------------------------------------------------

async def test_concurrent_reads_transcript(transcript_db):
    await transcript_db.execute(
        "INSERT INTO observations (timestamp, session_id, sequence_num, user_message, agent_response) "
        "VALUES (?, ?, ?, ?, ?)",
        (1707700000.0, "sess-c", 1, "test", "reply"),
    )
    results = await asyncio.gather(*[
        transcript_db.fetchone("SELECT * FROM observations WHERE session_id = ?", ("sess-c",))
        for _ in range(10)
    ])
    assert all(r["session_id"] == "sess-c" for r in results)
