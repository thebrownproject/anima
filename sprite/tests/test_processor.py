"""Tests for ObservationProcessor — batch processing via mocked Haiku calls."""

from __future__ import annotations

import time
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from anthropic.types import Message, TextBlock, Usage

from src.database import TranscriptDB, MemoryDB
from src.memory.processor import ObservationProcessor, _parse_response


# -- Helpers -----------------------------------------------------------------

def _make_message(text: str) -> Message:
    """Build a mock Anthropic Message with given text content."""
    return Message(
        id="msg_test",
        type="message",
        role="assistant",
        model="claude-3-5-haiku-latest",
        content=[TextBlock(type="text", text=text)],
        stop_reason="end_turn",
        usage=Usage(input_tokens=100, output_tokens=50),
    )


def _mock_client(response_text: str) -> AsyncMock:
    """Create a mock Anthropic client that returns the given response text."""
    client = AsyncMock()
    client.messages.create = AsyncMock(return_value=_make_message(response_text))
    return client


async def _insert_observation(db, seq=1, user_msg="Hello", response="Hi there"):
    """Insert a single unprocessed observation."""
    await db.execute(
        "INSERT INTO observations "
        "(timestamp, session_id, sequence_num, user_message, tool_calls_json, agent_response) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (time.time(), "sess-1", seq, user_msg, "[]", response),
    )


def _write_memory_files(memory_dir: Path):
    """Write all 6 memory template files."""
    memory_dir.mkdir(parents=True, exist_ok=True)
    for name in ("soul", "os", "tools", "files", "user", "context"):
        (memory_dir / f"{name}.md").write_text(f"# {name}\ntest content")


# -- Fixtures ----------------------------------------------------------------

@pytest.fixture
async def transcript_db(tmp_path):
    db = TranscriptDB(db_path=str(tmp_path / "transcript.db"))
    await db.connect()
    yield db
    await db.close()


@pytest.fixture
async def memory_db(tmp_path):
    db = MemoryDB(db_path=str(tmp_path / "memory.db"))
    await db.connect()
    yield db
    await db.close()


@pytest.fixture
def memory_dir(tmp_path, monkeypatch):
    """Create tmp memory dir and monkeypatch the module-level path constants."""
    md = tmp_path / "memory"
    md.mkdir()
    _write_memory_files(md)

    import src.memory as mem_mod
    import src.memory.processor as proc_mod

    # Patch ALL_MEMORY_FILES and DAEMON_MANAGED_FILES to use tmp paths
    tmp_all = [md / f"{name}.md" for name in ("soul", "os", "tools", "files", "user", "context")]
    tmp_daemon = [md / f"{name}.md" for name in ("tools", "files", "user", "context")]

    monkeypatch.setattr(proc_mod, "ALL_MEMORY_FILES", tmp_all)
    monkeypatch.setattr(proc_mod, "DAEMON_MANAGED_FILES", tmp_daemon)
    monkeypatch.setattr(proc_mod, "TOOLS_MD", md / "tools.md")
    monkeypatch.setattr(proc_mod, "FILES_MD", md / "files.md")
    monkeypatch.setattr(proc_mod, "USER_MD", md / "user.md")
    monkeypatch.setattr(proc_mod, "CONTEXT_MD", md / "context.md")

    # Rebuild _MD_UPDATE_MAP with tmp paths
    monkeypatch.setattr(proc_mod, "_MD_UPDATE_MAP", {
        "TOOLS_MD_UPDATE:": md / "tools.md",
        "FILES_MD_UPDATE:": md / "files.md",
        "USER_MD_UPDATE:": md / "user.md",
        "CONTEXT_MD_UPDATE:": md / "context.md",
    })

    return md


@pytest.fixture
def processor(transcript_db, memory_db, memory_dir):
    """Build processor with a default no-op mock client. Override client in tests."""
    client = _mock_client("NONE")
    return ObservationProcessor(transcript_db, memory_db, client, memory_dir)


# -- Test: Haiku called with correct prompt ----------------------------------

async def test_haiku_called_with_all_md_files_and_observations(
    transcript_db, memory_db, memory_dir
):
    """Haiku called with correct prompt including all 6 md files + observation batch."""
    client = _mock_client("NONE")
    proc = ObservationProcessor(transcript_db, memory_db, client, memory_dir)

    await _insert_observation(transcript_db, seq=1, user_msg="What is 2+2?", response="4")

    await proc.process_batch()

    client.messages.create.assert_called_once()
    call_kwargs = client.messages.create.call_args[1]

    # System prompt present
    assert "memory curator" in call_kwargs["system"]

    # User message contains all 6 md file contents
    user_content = call_kwargs["messages"][0]["content"]
    for name in ("soul", "os", "tools", "files", "user", "context"):
        assert f"{name}.md" in user_content

    # User message contains the observation
    assert "What is 2+2?" in user_content
    assert "4" in user_content


# -- Test: Each learning type parsed and stored ------------------------------

async def test_learning_types_parsed_and_stored(transcript_db, memory_db, memory_dir):
    """Each learning type correctly parsed and stored in memory.db."""
    response = (
        "FACT: User works in accounting\n"
        "PATTERN: User asks about invoices on Mondays\n"
        "CORRECTION: Date format is DD/MM/YYYY not MM/DD/YYYY\n"
        "PREFERENCE: Prefers dark mode\n"
        "TOOL_INSTALL: pip install pandas"
    )
    client = _mock_client(response)
    proc = ObservationProcessor(transcript_db, memory_db, client, memory_dir)

    await _insert_observation(transcript_db)
    await proc.process_batch()

    rows = await memory_db.fetchall("SELECT type, content FROM learnings ORDER BY id")
    assert len(rows) == 5
    types = [r["type"] for r in rows]
    assert types == ["FACT", "PATTERN", "CORRECTION", "PREFERENCE", "TOOL_INSTALL"]
    assert rows[0]["content"] == "User works in accounting"
    assert rows[4]["content"] == "pip install pandas"


# -- Test: MD file updates rewrite the full file -----------------------------

async def test_md_file_update_rewrites_full_file(transcript_db, memory_db, memory_dir):
    """MD file updates rewrite the full file (not append)."""
    response = (
        "USER_MD_UPDATE:\n"
        "# user\n"
        "Completely new content\n"
        "- preference 1\n"
        "- preference 2"
    )
    client = _mock_client(response)
    proc = ObservationProcessor(transcript_db, memory_db, client, memory_dir)

    await _insert_observation(transcript_db)
    await proc.process_batch()

    content = (memory_dir / "user.md").read_text()
    assert content == "# user\nCompletely new content\n- preference 1\n- preference 2"
    # Original content replaced, not appended
    assert "test content" not in content


# -- Test: NONE produces no learnings ----------------------------------------

async def test_none_produces_no_learnings(transcript_db, memory_db, memory_dir):
    """NONE produces no learnings."""
    client = _mock_client("NONE")
    proc = ObservationProcessor(transcript_db, memory_db, client, memory_dir)

    await _insert_observation(transcript_db)
    await proc.process_batch()

    rows = await memory_db.fetchall("SELECT * FROM learnings")
    assert len(rows) == 0

    actions = await memory_db.fetchall("SELECT * FROM pending_actions")
    assert len(actions) == 0


# -- Test: Failed API call does NOT mark observations as processed -----------

async def test_api_failure_does_not_mark_processed(transcript_db, memory_db, memory_dir):
    """Failed API call does NOT mark observations as processed."""
    client = AsyncMock()
    client.messages.create = AsyncMock(side_effect=Exception("API error"))
    proc = ObservationProcessor(transcript_db, memory_db, client, memory_dir)

    await _insert_observation(transcript_db)
    await proc.process_batch()

    # Observation should still be unprocessed
    rows = await transcript_db.fetchall(
        "SELECT processed FROM observations WHERE processed = 0"
    )
    assert len(rows) == 1


# -- Test: flush_all processes everything remaining --------------------------

async def test_flush_all_processes_everything(transcript_db, memory_db, memory_dir):
    """flush_all processes everything remaining."""
    response = "FACT: User likes Python"
    client = _mock_client(response)
    proc = ObservationProcessor(transcript_db, memory_db, client, memory_dir)

    # Insert multiple observations
    for i in range(5):
        await _insert_observation(transcript_db, seq=i + 1, user_msg=f"msg {i}")

    await proc.flush_all()

    # All marked as processed
    unprocessed = await transcript_db.fetchall(
        "SELECT * FROM observations WHERE processed = 0"
    )
    assert len(unprocessed) == 0

    # Learnings stored
    rows = await memory_db.fetchall("SELECT * FROM learnings")
    assert len(rows) == 1


# -- Test: Empty batch is a no-op -------------------------------------------

async def test_empty_batch_is_noop(transcript_db, memory_db, memory_dir):
    """Empty batch (no unprocessed observations) is a no-op."""
    client = _mock_client("FACT: should not happen")
    proc = ObservationProcessor(transcript_db, memory_db, client, memory_dir)

    await proc.process_batch()

    # Haiku should NOT have been called
    client.messages.create.assert_not_called()


# -- Test: Multiple file updates in one response all applied -----------------

async def test_multiple_file_updates_all_applied(transcript_db, memory_db, memory_dir):
    """Multiple file updates in one response all applied."""
    response = (
        "FACT: User prefers tabs\n"
        "TOOLS_MD_UPDATE:\n"
        "# tools\n"
        "Updated tools content\n"
        "\n"
        "USER_MD_UPDATE:\n"
        "# user\n"
        "Updated user content\n"
        "\n"
        "CONTEXT_MD_UPDATE:\n"
        "# context\n"
        "Updated context content"
    )
    client = _mock_client(response)
    proc = ObservationProcessor(transcript_db, memory_db, client, memory_dir)

    await _insert_observation(transcript_db)
    await proc.process_batch()

    # All 3 files updated
    assert "Updated tools content" in (memory_dir / "tools.md").read_text()
    assert "Updated user content" in (memory_dir / "user.md").read_text()
    assert "Updated context content" in (memory_dir / "context.md").read_text()

    # files.md unchanged (no FILES_MD_UPDATE in response)
    assert "test content" in (memory_dir / "files.md").read_text()

    # Learning also stored
    rows = await memory_db.fetchall("SELECT * FROM learnings")
    assert len(rows) == 1
    assert rows[0]["type"] == "FACT"


# -- Test: ACTION goes to pending_actions table ------------------------------

async def test_action_stored_in_pending_actions(transcript_db, memory_db, memory_dir):
    """ACTION type stored in pending_actions table, not learnings."""
    response = "ACTION: Set up Xero integration"
    client = _mock_client(response)
    proc = ObservationProcessor(transcript_db, memory_db, client, memory_dir)

    await _insert_observation(transcript_db)
    await proc.process_batch()

    learnings = await memory_db.fetchall("SELECT * FROM learnings")
    assert len(learnings) == 0

    actions = await memory_db.fetchall("SELECT * FROM pending_actions")
    assert len(actions) == 1
    assert actions[0]["content"] == "Set up Xero integration"
    assert actions[0]["status"] == "pending"


# -- Unit test: _parse_response ----------------------------------------------

def test_parse_response_mixed():
    """Parse a complex response with learnings, actions, and file updates."""
    text = (
        "FACT: User is an accountant\n"
        "ACTION: Install pandas\n"
        "PREFERENCE: Prefers CSV exports\n"
        "NONE\n"
        "FILES_MD_UPDATE:\n"
        "# files\n"
        "- invoices.pdf\n"
        "- receipts.pdf\n"
        "\n"
        "CORRECTION: Company name is Acme Corp not Acme Inc"
    )
    learnings, actions, file_updates = _parse_response(text)

    assert len(learnings) == 3
    assert learnings[0] == {"type": "FACT", "content": "User is an accountant"}
    assert learnings[1] == {"type": "PREFERENCE", "content": "Prefers CSV exports"}
    assert learnings[2] == {"type": "CORRECTION", "content": "Company name is Acme Corp not Acme Inc"}

    assert len(actions) == 1
    assert actions[0] == {"content": "Install pandas"}

    assert len(file_updates) == 1
