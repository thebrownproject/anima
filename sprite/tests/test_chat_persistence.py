"""Tests for chat message persistence -- user messages and agent responses saved to WorkspaceDB."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from unittest.mock import patch, AsyncMock

import pytest

from src.runtime import AgentRuntime
from src.database import WorkspaceDB


# -- Mock SDK types (same as test_runtime.py) ---------------------------------

@dataclass
class MockTextBlock:
    text: str
    type: str = "text"

@dataclass
class MockToolUseBlock:
    name: str
    input: dict[str, Any]
    type: str = "tool_use"

@dataclass
class MockAssistantMessage:
    content: list
    model: str = "claude-sonnet-4-20250514"

@dataclass
class MockResultMessage:
    session_id: str = "sess-chat-001"
    total_cost_usd: float = 0.005
    duration_ms: int = 1200
    num_turns: int = 1
    is_error: bool = False
    usage: dict = None


# -- Helpers ------------------------------------------------------------------

_SDK_TYPE_PATCHES = {
    "src.runtime.AssistantMessage": MockAssistantMessage,
    "src.runtime.TextBlock": MockTextBlock,
    "src.runtime.ToolUseBlock": MockToolUseBlock,
    "src.runtime.ResultMessage": MockResultMessage,
}


class _MockClient:
    def __init__(self, messages):
        self._messages = messages

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        pass

    async def query(self, prompt: str):
        pass

    async def receive_response(self):
        for msg in self._messages:
            yield msg


def _apply_common_patches(stack):
    for target, replacement in _SDK_TYPE_PATCHES.items():
        stack.enter_context(patch(target, replacement))
    async def _noop_load(memory_db=None):
        return ""
    stack.enter_context(patch("src.runtime.load_memory", side_effect=_noop_load))


def _mock_sdk(messages):
    from contextlib import ExitStack
    def factory(options=None):
        return _MockClient(messages)
    stack = ExitStack()
    stack.enter_context(patch("src.runtime.ClaudeSDKClient", side_effect=factory))
    _apply_common_patches(stack)
    return stack


# -- Fixtures -----------------------------------------------------------------

@pytest.fixture
def sent():
    return []

@pytest.fixture
def send_fn(sent):
    async def _send(msg: str) -> None:
        sent.append(msg)
    return _send

@pytest.fixture
async def workspace_db(tmp_path):
    path = str(tmp_path / "workspace.db")
    db = WorkspaceDB(db_path=path)
    await db.connect()
    yield db
    await db.close()

@pytest.fixture
def runtime_with_db(send_fn, workspace_db):
    with patch("src.runtime.ensure_templates"):
        return AgentRuntime(send_fn=send_fn, workspace_db=workspace_db)


# -- Test: User messages saved with role='user' -------------------------------

async def test_user_message_saved_on_mission(runtime_with_db, workspace_db, sent):
    """Gateway saves user message with role='user' before agent processes it."""
    from src.gateway import SpriteGateway
    from src.protocol import _new_id

    gw = SpriteGateway(
        send_fn=runtime_with_db._send,
        runtime=runtime_with_db,
        workspace_db=workspace_db,
    )

    messages = [
        MockAssistantMessage(content=[MockTextBlock(text="Hello!")]),
        MockResultMessage(),
    ]

    with _mock_sdk(messages):
        mission_msg = json.dumps({
            "id": _new_id(),
            "type": "mission",
            "timestamp": 1707700000,
            "payload": {"text": "Extract invoices from my documents"},
        })
        await gw.route(mission_msg)

    history = await workspace_db.get_chat_history()
    user_msgs = [m for m in history if m["role"] == "user"]
    assert len(user_msgs) == 1
    assert user_msgs[0]["content"] == "Extract invoices from my documents"


# -- Test: Agent responses saved with role='agent' (full accumulated text) ----

async def test_agent_response_saved_on_complete(runtime_with_db, workspace_db, sent):
    """Agent response is accumulated from TextBlocks and saved on ResultMessage."""
    messages = [
        MockAssistantMessage(content=[MockTextBlock(text="Analyzing...")]),
        MockAssistantMessage(content=[MockTextBlock(text=" Found 3 invoices.")]),
        MockResultMessage(),
    ]

    with _mock_sdk(messages):
        await runtime_with_db.handle_message("Extract invoices", request_id="req-1")

    history = await workspace_db.get_chat_history()
    agent_msgs = [m for m in history if m["role"] == "agent"]
    assert len(agent_msgs) == 1
    assert agent_msgs[0]["content"] == "Analyzing... Found 3 invoices."


# -- Test: Streaming chunks accumulated, not stored individually --------------

async def test_streaming_chunks_accumulated_not_individual(runtime_with_db, workspace_db, sent):
    """Multiple TextBlocks produce one agent message, not one per chunk."""
    messages = [
        MockAssistantMessage(content=[MockTextBlock(text="Part 1")]),
        MockAssistantMessage(content=[MockTextBlock(text=" Part 2")]),
        MockAssistantMessage(content=[MockTextBlock(text=" Part 3")]),
        MockResultMessage(),
    ]

    with _mock_sdk(messages):
        await runtime_with_db.handle_message("Tell me a story", request_id="req-2")

    history = await workspace_db.get_chat_history()
    agent_msgs = [m for m in history if m["role"] == "agent"]
    assert len(agent_msgs) == 1, f"Expected 1 accumulated message, got {len(agent_msgs)}"
    assert agent_msgs[0]["content"] == "Part 1 Part 2 Part 3"


# -- Test: Messages queryable by timestamp for state_sync --------------------

async def test_messages_queryable_by_timestamp(runtime_with_db, workspace_db, sent):
    """Chat messages have timestamps for state_sync ordering."""
    from src.gateway import SpriteGateway
    from src.protocol import _new_id

    gw = SpriteGateway(
        send_fn=runtime_with_db._send,
        runtime=runtime_with_db,
        workspace_db=workspace_db,
    )

    messages = [
        MockAssistantMessage(content=[MockTextBlock(text="Response")]),
        MockResultMessage(),
    ]

    with _mock_sdk(messages):
        mission_msg = json.dumps({
            "id": _new_id(),
            "type": "mission",
            "timestamp": 1707700000,
            "payload": {"text": "Hello agent"},
        })
        await gw.route(mission_msg)

    history = await workspace_db.get_chat_history()
    assert len(history) == 2  # user + agent
    # Both have timestamps
    assert all(m["timestamp"] is not None for m in history)
    # User message comes before agent response
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "agent"
    assert history[0]["timestamp"] <= history[1]["timestamp"]


# -- Test: Empty user message not saved --------------------------------------

async def test_empty_user_message_not_saved(runtime_with_db, workspace_db, sent):
    """Empty text is not persisted as a chat message."""
    from src.gateway import SpriteGateway
    from src.protocol import _new_id

    gw = SpriteGateway(
        send_fn=runtime_with_db._send,
        runtime=runtime_with_db,
        workspace_db=workspace_db,
    )

    messages = [MockResultMessage()]

    with _mock_sdk(messages):
        mission_msg = json.dumps({
            "id": _new_id(),
            "type": "mission",
            "timestamp": 1707700000,
            "payload": {"text": ""},
        })
        await gw.route(mission_msg)

    history = await workspace_db.get_chat_history()
    user_msgs = [m for m in history if m["role"] == "user"]
    assert len(user_msgs) == 0


# -- Test: Accumulator resets between turns -----------------------------------

async def test_accumulator_resets_between_turns(runtime_with_db, workspace_db, sent):
    """Each turn produces a separate agent message, accumulator resets."""
    messages_turn1 = [
        MockAssistantMessage(content=[MockTextBlock(text="First response")]),
        MockResultMessage(session_id="sess-1"),
    ]
    messages_turn2 = [
        MockAssistantMessage(content=[MockTextBlock(text="Second response")]),
        MockResultMessage(session_id="sess-2"),
    ]

    # Use _start_session directly to avoid client reuse (each turn gets fresh mock)
    with _mock_sdk(messages_turn1):
        await runtime_with_db._start_session("Turn 1", request_id="req-t1")

    with _mock_sdk(messages_turn2):
        await runtime_with_db._start_session("Turn 2", request_id="req-t2")

    history = await workspace_db.get_chat_history()
    agent_msgs = [m for m in history if m["role"] == "agent"]
    assert len(agent_msgs) == 2
    assert agent_msgs[0]["content"] == "First response"
    assert agent_msgs[1]["content"] == "Second response"
