"""Tests for TranscriptDB, MemoryDB, and WorkspaceDB async SQLite layers."""

from __future__ import annotations

import asyncio
import json
import os
import time

import pytest

from src.database import TranscriptDB, MemoryDB, WorkspaceDB


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


# -- WorkspaceDB fixtures --------------------------------------------------

@pytest.fixture
async def workspace_db(tmp_path):
    path = str(tmp_path / "workspace.db")
    db = WorkspaceDB(db_path=path)
    await db.connect()
    yield db
    await db.close()


# -- WorkspaceDB schema ----------------------------------------------------

async def test_workspace_tables_created(workspace_db):
    """init() creates all 3 tables with status/archived_at columns."""
    rows = await workspace_db.fetchall(
        "SELECT name FROM sqlite_master WHERE type = 'table' "
        "AND name NOT LIKE 'sqlite_%'"
    )
    names = {r["name"] for r in rows}
    assert {"stacks", "cards", "chat_messages"}.issubset(names)

    # Verify status/archived_at columns exist on stacks
    stack_cols = await workspace_db.fetchall("PRAGMA table_info(stacks)")
    col_names = {c["name"] for c in stack_cols}
    assert "status" in col_names
    assert "archived_at" in col_names

    # Verify status/archived_at columns exist on cards
    card_cols = await workspace_db.fetchall("PRAGMA table_info(cards)")
    col_names = {c["name"] for c in card_cols}
    assert "status" in col_names
    assert "archived_at" in col_names


async def test_workspace_default_path():
    db = WorkspaceDB()
    assert db.db_path == "/workspace/.os/workspace.db"


# -- WorkspaceDB stacks CRUD -----------------------------------------------

async def test_create_stack_returns_active(workspace_db):
    """create_stack returns stack with status='active'."""
    stack = await workspace_db.create_stack("s1", "My Stack", "#ff0000")
    assert stack["id"] == "s1"
    assert stack["name"] == "My Stack"
    assert stack["color"] == "#ff0000"
    assert stack["status"] == "active"
    assert stack["created_at"] is not None


async def test_list_stacks_active_only(workspace_db):
    """list_stacks returns only active stacks, ordered by sort_order."""
    await workspace_db.create_stack("s1", "First", sort_order=2)
    await workspace_db.create_stack("s2", "Second", sort_order=1)
    await workspace_db.create_stack("s3", "Third", sort_order=3)
    await workspace_db.archive_stack("s3")

    stacks = await workspace_db.list_stacks()
    assert len(stacks) == 2
    assert stacks[0]["id"] == "s2"  # sort_order=1 first
    assert stacks[1]["id"] == "s1"  # sort_order=2 second
    assert all(s["status"] == "active" for s in stacks)


async def test_list_all_stacks_includes_archived(workspace_db):
    """list_all_stacks returns active + archived."""
    await workspace_db.create_stack("s1", "Active Stack")
    await workspace_db.create_stack("s2", "Archived Stack")
    await workspace_db.archive_stack("s2")

    all_stacks = await workspace_db.list_all_stacks()
    assert len(all_stacks) == 2
    statuses = {s["id"]: s["status"] for s in all_stacks}
    assert statuses["s1"] == "active"
    assert statuses["s2"] == "archived"


async def test_rename_stack(workspace_db):
    await workspace_db.create_stack("s1", "Old Name")
    await workspace_db.rename_stack("s1", "New Name")
    stack = await workspace_db.fetchone("SELECT * FROM stacks WHERE id = ?", ("s1",))
    assert stack["name"] == "New Name"


async def test_archive_stack_cascades_to_cards(workspace_db):
    """archive_stack sets status='archived' and cascades to all its cards."""
    await workspace_db.create_stack("s1", "Stack")
    await workspace_db.upsert_card("c1", "s1", "Card 1", [])
    await workspace_db.upsert_card("c2", "s1", "Card 2", [])
    # Card on different stack should not be affected
    await workspace_db.create_stack("s2", "Other")
    await workspace_db.upsert_card("c3", "s2", "Card 3", [])

    await workspace_db.archive_stack("s1")

    stack = await workspace_db.fetchone("SELECT * FROM stacks WHERE id = ?", ("s1",))
    assert stack["status"] == "archived"
    assert stack["archived_at"] is not None

    c1 = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c1",))
    c2 = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c2",))
    c3 = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c3",))
    assert c1["status"] == "archived"
    assert c2["status"] == "archived"
    assert c3["status"] == "active"  # untouched


async def test_restore_stack_restores_cards(workspace_db):
    """restore_stack sets status='active' and restores its cards."""
    await workspace_db.create_stack("s1", "Stack")
    await workspace_db.upsert_card("c1", "s1", "Card 1", [])
    await workspace_db.upsert_card("c2", "s1", "Card 2", [])
    await workspace_db.archive_stack("s1")

    await workspace_db.restore_stack("s1")

    stack = await workspace_db.fetchone("SELECT * FROM stacks WHERE id = ?", ("s1",))
    assert stack["status"] == "active"
    assert stack["archived_at"] is None

    c1 = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c1",))
    c2 = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c2",))
    assert c1["status"] == "active"
    assert c2["status"] == "active"


# -- WorkspaceDB cards CRUD ------------------------------------------------

async def test_upsert_card_creates_and_updates(workspace_db):
    """upsert_card creates and updates cards with status='active'."""
    await workspace_db.create_stack("s1", "Stack")

    # Create
    card = await workspace_db.upsert_card("c1", "s1", "Card 1", [{"type": "heading", "content": "Hi"}])
    assert card["card_id"] == "c1"
    assert card["status"] == "active"
    assert card["title"] == "Card 1"

    # Update
    updated = await workspace_db.upsert_card("c1", "s1", "Updated Card", [{"type": "stat", "value": "42"}], size="large")
    assert updated["title"] == "Updated Card"
    assert updated["size"] == "large"
    blocks = json.loads(updated["blocks"])
    assert blocks[0]["type"] == "stat"


async def test_archive_card(workspace_db):
    """archive_card sets status='archived' with archived_at timestamp."""
    await workspace_db.create_stack("s1", "Stack")
    await workspace_db.upsert_card("c1", "s1", "Card", [])

    before = time.time()
    await workspace_db.archive_card("c1")
    after = time.time()

    card = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c1",))
    assert card["status"] == "archived"
    assert before <= card["archived_at"] <= after


async def test_restore_card(workspace_db):
    await workspace_db.create_stack("s1", "Stack")
    await workspace_db.upsert_card("c1", "s1", "Card", [])
    await workspace_db.archive_card("c1")

    await workspace_db.restore_card("c1")

    card = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c1",))
    assert card["status"] == "active"
    assert card["archived_at"] is None


async def test_get_cards_by_stack_active_only(workspace_db):
    """get_cards_by_stack returns only active cards."""
    await workspace_db.create_stack("s1", "Stack")
    await workspace_db.upsert_card("c1", "s1", "Active Card", [])
    await workspace_db.upsert_card("c2", "s1", "Archived Card", [])
    await workspace_db.archive_card("c2")

    cards = await workspace_db.get_cards_by_stack("s1")
    assert len(cards) == 1
    assert cards[0]["card_id"] == "c1"


async def test_get_all_cards_includes_archived(workspace_db):
    """get_all_cards returns active + archived (for agent search)."""
    await workspace_db.create_stack("s1", "Stack")
    await workspace_db.upsert_card("c1", "s1", "Active", [])
    await workspace_db.upsert_card("c2", "s1", "Archived", [])
    await workspace_db.archive_card("c2")

    cards = await workspace_db.get_all_cards()
    assert len(cards) == 2
    statuses = {c["card_id"]: c["status"] for c in cards}
    assert statuses["c1"] == "active"
    assert statuses["c2"] == "archived"


# -- WorkspaceDB chat CRUD -------------------------------------------------

async def test_add_chat_message_persists(workspace_db):
    """add_chat_message persists with timestamp."""
    before = time.time()
    msg = await workspace_db.add_chat_message("user", "Hello there")
    after = time.time()

    assert msg["role"] == "user"
    assert msg["content"] == "Hello there"
    assert before <= msg["timestamp"] <= after
    assert msg["id"] is not None


async def test_get_chat_history_limit_and_order(workspace_db):
    """get_chat_history(limit) returns recent messages in order."""
    for i in range(5):
        await workspace_db.add_chat_message("user" if i % 2 == 0 else "assistant", f"msg-{i}")

    # Get last 3
    history = await workspace_db.get_chat_history(limit=3)
    assert len(history) == 3
    # Should be in chronological order (oldest first of the last 3)
    assert history[0]["content"] == "msg-2"
    assert history[1]["content"] == "msg-3"
    assert history[2]["content"] == "msg-4"

    # Get all
    all_msgs = await workspace_db.get_chat_history()
    assert len(all_msgs) == 5
    assert all_msgs[0]["content"] == "msg-0"
