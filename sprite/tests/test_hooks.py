"""Tests for TurnBuffer and hook callbacks — unit tests, no SDK mocking needed."""

from __future__ import annotations

import json

import pytest

from src.database import TranscriptDB
from src.memory.hooks import TurnBuffer, create_hook_callbacks

BATCH_THRESHOLD = 25


# -- Fixtures ----------------------------------------------------------------

@pytest.fixture
async def transcript_db(tmp_path):
    path = str(tmp_path / "transcript.db")
    db = TranscriptDB(db_path=path)
    await db.connect()
    yield db
    await db.close()


@pytest.fixture
def buffer():
    return TurnBuffer()


@pytest.fixture
def mock_processor():
    """Minimal processor stub with flush_all tracking."""
    class Processor:
        def __init__(self):
            self.flushed = False
        async def flush_all(self):
            self.flushed = True
    return Processor()


# -- TurnBuffer unit tests ---------------------------------------------------

def test_buffer_initial_state(buffer):
    assert buffer.user_message is None
    assert buffer.tool_calls == []
    assert buffer.agent_response == ""


def test_buffer_set_user_message(buffer):
    buffer.set_user_message("Hello agent")
    assert buffer.user_message == "Hello agent"


def test_buffer_append_tool_call(buffer):
    buffer.append_tool_call("Bash", {"command": "ls"}, "file1.txt\nfile2.txt")
    assert len(buffer.tool_calls) == 1
    assert buffer.tool_calls[0]["tool"] == "Bash"
    assert buffer.tool_calls[0]["input"] == {"command": "ls"}


def test_buffer_append_agent_response(buffer):
    """set_agent_response APPENDS text, doesn't overwrite."""
    buffer.append_agent_response("Hello ")
    buffer.append_agent_response("world")
    assert buffer.agent_response == "Hello world"


def test_buffer_tool_response_truncated(buffer):
    """Tool responses longer than 2000 chars are truncated."""
    long_response = "x" * 3000
    buffer.append_tool_call("Read", {"file": "big.txt"}, long_response)
    assert len(buffer.tool_calls[0]["response"]) <= 2000


def test_buffer_clear(buffer):
    buffer.set_user_message("test")
    buffer.append_tool_call("Bash", {}, "ok")
    buffer.append_agent_response("reply")
    buffer.clear()
    assert buffer.user_message is None
    assert buffer.tool_calls == []
    assert buffer.agent_response == ""


def test_buffer_snapshot(buffer):
    buffer.set_user_message("hi")
    buffer.append_tool_call("Bash", {"cmd": "ls"}, "files")
    buffer.append_agent_response("here are files")
    snap = buffer.snapshot()
    assert snap["user_message"] == "hi"
    assert len(snap["tool_calls"]) == 1
    assert snap["agent_response"] == "here are files"


# -- Hook callback tests (with real TranscriptDB) ----------------------------

async def test_user_prompt_submit_buffers_message(transcript_db, mock_processor):
    buffer = TurnBuffer()
    hooks = create_hook_callbacks(transcript_db, mock_processor, buffer)

    result = await hooks["on_user_prompt_submit"](
        {"prompt": "What files are here?"}, None, {}
    )
    assert result == {}
    assert buffer.user_message == "What files are here?"


async def test_post_tool_use_buffers_tool_call(transcript_db, mock_processor):
    buffer = TurnBuffer()
    hooks = create_hook_callbacks(transcript_db, mock_processor, buffer)

    result = await hooks["on_post_tool_use"](
        {"tool_name": "Bash", "tool_input": {"command": "ls"}, "tool_response": "file.txt"},
        "tool-123",
        {},
    )
    assert result == {}
    assert len(buffer.tool_calls) == 1
    assert buffer.tool_calls[0]["tool"] == "Bash"

    # Verify nothing written to DB yet
    row = await transcript_db.fetchone("SELECT COUNT(*) as c FROM observations")
    assert row["c"] == 0


async def test_stop_writes_observation(transcript_db, mock_processor):
    """Stop hook writes one observation with all buffered data including agent response."""
    buffer = TurnBuffer()
    hooks = create_hook_callbacks(transcript_db, mock_processor, buffer)

    buffer.set_user_message("List files")
    buffer.append_tool_call("Bash", {"command": "ls"}, "a.txt b.txt")
    buffer.append_agent_response("Here are your files: a.txt and b.txt")

    result = await hooks["on_stop"]({"stop_hook_active": True}, None, {})
    assert result == {}

    row = await transcript_db.fetchone("SELECT * FROM observations")
    assert row is not None
    assert row["user_message"] == "List files"
    assert row["agent_response"] == "Here are your files: a.txt and b.txt"
    tools = json.loads(row["tool_calls_json"])
    assert tools[0]["tool"] == "Bash"
    assert row["processed"] == 0


async def test_buffer_cleared_after_stop(transcript_db, mock_processor):
    buffer = TurnBuffer()
    hooks = create_hook_callbacks(transcript_db, mock_processor, buffer)

    buffer.set_user_message("test")
    buffer.append_agent_response("reply")
    await hooks["on_stop"]({"stop_hook_active": True}, None, {})

    assert buffer.user_message is None
    assert buffer.tool_calls == []
    assert buffer.agent_response == ""


async def test_turn_count_increments_and_triggers_batch(transcript_db, mock_processor):
    buffer = TurnBuffer()
    hooks = create_hook_callbacks(
        transcript_db, mock_processor, buffer, batch_threshold=3
    )

    for i in range(3):
        buffer.set_user_message(f"msg {i}")
        buffer.append_agent_response(f"reply {i}")
        await hooks["on_stop"]({"stop_hook_active": True}, None, {})

    assert mock_processor.flushed is True

    rows = await transcript_db.fetchall("SELECT * FROM observations")
    assert len(rows) == 3


async def test_precompact_triggers_flush(transcript_db, mock_processor):
    """PreCompact always triggers emergency flush (simplified -- no auto/manual distinction)."""
    buffer = TurnBuffer()
    hooks = create_hook_callbacks(transcript_db, mock_processor, buffer)

    result = await hooks["on_pre_compact"]({}, None, {})
    assert result == {}
    assert mock_processor.flushed is True


async def test_hook_errors_never_propagate(transcript_db):
    """Hook errors are caught and return {} -- never block the agent."""
    buffer = TurnBuffer()

    class BrokenProcessor:
        async def flush_all(self):
            raise RuntimeError("processor exploded")

    hooks = create_hook_callbacks(transcript_db, BrokenProcessor(), buffer)

    # Pre-compact calls flush_all which raises -- should still return {}
    result = await hooks["on_pre_compact"]({}, None, {})
    assert result == {}


async def test_hook_errors_on_stop_with_broken_db(tmp_path):
    """Stop hook with broken DB returns {} without propagating."""
    buffer = TurnBuffer()
    db = TranscriptDB(db_path=str(tmp_path / "broken.db"))
    # Don't connect -- execute will fail

    class NoopProcessor:
        flushed = False
        async def flush_all(self):
            self.flushed = True

    hooks = create_hook_callbacks(db, NoopProcessor(), buffer)
    buffer.set_user_message("test")
    buffer.append_agent_response("reply")

    result = await hooks["on_stop"]({"stop_hook_active": True}, None, {})
    assert result == {}


async def test_stop_with_empty_buffer_still_writes(transcript_db, mock_processor):
    """Stop writes observation even if buffer has no user message (edge case)."""
    buffer = TurnBuffer()
    hooks = create_hook_callbacks(transcript_db, mock_processor, buffer)

    await hooks["on_stop"]({"stop_hook_active": True}, None, {})

    row = await transcript_db.fetchone("SELECT * FROM observations")
    assert row is not None
    assert row["user_message"] is None


async def test_sequence_numbers_increment(transcript_db, mock_processor):
    """Each observation gets an incrementing sequence number."""
    buffer = TurnBuffer()
    hooks = create_hook_callbacks(transcript_db, mock_processor, buffer)

    for i in range(3):
        buffer.set_user_message(f"msg {i}")
        await hooks["on_stop"]({}, None, {})

    rows = await transcript_db.fetchall(
        "SELECT sequence_num FROM observations ORDER BY sequence_num"
    )
    assert [r["sequence_num"] for r in rows] == [1, 2, 3]
