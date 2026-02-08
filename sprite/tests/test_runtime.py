"""Tests for AgentRuntime -- Claude Agent SDK wrapper with WS event streaming."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from src.runtime import AgentRuntime, DEFAULT_SYSTEM_PROMPT


# -- Mock SDK types matching claude_agent_sdk interface ----------------------

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
class MockThinkingBlock:
    thinking: str
    type: str = "thinking"


@dataclass
class MockAssistantMessage:
    content: list
    model: str = "claude-sonnet-4-20250514"


@dataclass
class MockResultMessage:
    session_id: str = "sess-abc-123"
    total_cost_usd: float = 0.005
    duration_ms: int = 1200
    num_turns: int = 3
    is_error: bool = False
    usage: dict = None


# -- Helpers -----------------------------------------------------------------

def _parse_events(sent: list[str]) -> list[dict]:
    """Parse captured JSON strings into dicts."""
    return [json.loads(s) for s in sent]


def _agent_events(sent: list[str]) -> list[dict]:
    """Extract agent_event messages from sent list."""
    return [e for e in _parse_events(sent) if e.get("type") == "agent_event"]


def _events_by_type(sent: list[str], event_type: str) -> list[dict]:
    """Filter agent_event messages by event_type."""
    return [
        e for e in _agent_events(sent)
        if e["payload"]["event_type"] == event_type
    ]


# -- Fixtures ----------------------------------------------------------------

@pytest.fixture
def sent():
    return []


@pytest.fixture
def send_fn(sent):
    async def _send(msg: str) -> None:
        sent.append(msg)
    return _send


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def runtime(send_fn, mock_db):
    with patch("src.runtime.ensure_templates"):
        return AgentRuntime(send_fn=send_fn, db=mock_db)


# -- Test: Agent invocation streams agent_event messages ---------------------

async def test_streams_text_tool_complete_events(runtime, sent):
    """Agent invocation streams text, tool, and complete events over WS."""
    messages = [
        MockAssistantMessage(content=[MockTextBlock(text="Analyzing document...")]),
        MockAssistantMessage(content=[MockToolUseBlock(name="Read", input={"file_path": "/doc.md"})]),
        MockAssistantMessage(content=[MockTextBlock(text="Found 3 invoices.")]),
        MockResultMessage(session_id="sess-001"),
    ]

    with _mock_sdk(messages):
        await runtime.run_mission("Extract invoices", request_id="req-1")

    events = _agent_events(sent)
    assert len(events) == 4
    assert events[0]["payload"]["event_type"] == "text"
    assert events[0]["payload"]["content"] == "Analyzing document..."
    assert events[1]["payload"]["event_type"] == "tool"
    assert events[2]["payload"]["event_type"] == "text"
    assert events[3]["payload"]["event_type"] == "complete"

    for e in events:
        assert e.get("request_id") == "req-1"


# -- Test: Event type mapping ------------------------------------------------

async def test_text_block_maps_to_text_event(runtime, sent):
    """AssistantMessage with TextBlock maps to event_type='text'."""
    messages = [
        MockAssistantMessage(content=[MockTextBlock(text="Hello")]),
        MockResultMessage(),
    ]
    with _mock_sdk(messages):
        await runtime.run_mission("Hi", request_id="req-2")

    text_events = _events_by_type(sent, "text")
    assert len(text_events) == 1
    assert text_events[0]["payload"]["content"] == "Hello"


async def test_tool_use_block_maps_to_tool_event(runtime, sent):
    """AssistantMessage with ToolUseBlock maps to event_type='tool'."""
    messages = [
        MockAssistantMessage(content=[MockToolUseBlock(name="Bash", input={"command": "ls"})]),
        MockResultMessage(),
    ]
    with _mock_sdk(messages):
        await runtime.run_mission("List files", request_id="req-3")

    tool_events = _events_by_type(sent, "tool")
    assert len(tool_events) == 1
    content = json.loads(tool_events[0]["payload"]["content"])
    assert content["tool"] == "Bash"
    assert content["input"] == {"command": "ls"}


async def test_result_message_maps_to_complete_event(runtime, sent):
    """ResultMessage maps to event_type='complete' with session_id in meta."""
    messages = [MockResultMessage(session_id="sess-xyz")]
    with _mock_sdk(messages):
        await runtime.run_mission("Do something", request_id="req-4")

    complete = _events_by_type(sent, "complete")
    assert len(complete) == 1
    assert complete[0]["payload"]["meta"]["sessionId"] == "sess-xyz"


async def test_thinking_block_is_skipped(runtime, sent):
    """ThinkingBlock in AssistantMessage is silently skipped."""
    messages = [
        MockAssistantMessage(content=[
            MockThinkingBlock(thinking="Let me think..."),
            MockTextBlock(text="Here is my answer"),
        ]),
        MockResultMessage(),
    ]
    with _mock_sdk(messages):
        await runtime.run_mission("Think about it", request_id="req-5")

    events = _agent_events(sent)
    event_types = [e["payload"]["event_type"] for e in events]
    assert "text" in event_types
    assert "complete" in event_types
    assert len(events) == 2


# -- Test: mission_lock prevents concurrent missions -------------------------

async def test_mission_lock_serialization(send_fn, mock_db):
    """Second mission waits until first completes (missions serialize)."""
    timestamps: list[tuple[str, float]] = []

    async def slow_messages():
        timestamps.append(("start", asyncio.get_event_loop().time()))
        await asyncio.sleep(0.1)
        yield MockResultMessage(session_id="sess-slow")
        timestamps.append(("end", asyncio.get_event_loop().time()))

    with patch("src.runtime.ensure_templates"):
        runtime = AgentRuntime(send_fn=send_fn, db=mock_db)

    with _mock_sdk_generator(slow_messages):
        await asyncio.gather(
            runtime.run_mission("first", request_id="r1"),
            runtime.run_mission("second", request_id="r2"),
        )

    assert len(timestamps) == 4
    first_end = timestamps[1][1]
    second_start = timestamps[2][1]
    assert second_start >= first_end, "Second mission started before first ended"


# -- Test: Session resume ----------------------------------------------------

async def test_resume_uses_session_id(runtime, sent):
    """resume_mission passes resume=session_id to ClaudeAgentOptions."""
    messages = [
        MockAssistantMessage(content=[MockTextBlock(text="Updated field")]),
        MockResultMessage(session_id="sess-resumed"),
    ]

    captured_options = {}

    with _mock_sdk(messages, capture_options=captured_options):
        await runtime.resume_mission(
            text="Change vendor to Acme",
            session_id="sess-original",
            request_id="req-resume",
        )

    assert captured_options.get("resume") == "sess-original"
    assert captured_options.get("system_prompt") is None

    complete = _events_by_type(sent, "complete")
    assert len(complete) == 1


# -- Test: Error handling ----------------------------------------------------

async def test_sdk_error_sends_error_event(runtime, sent):
    """Exception in SDK produces agent_event with event_type='error'."""
    with _mock_sdk_error(RuntimeError("SDK crashed")):
        await runtime.run_mission("Fail please", request_id="req-err")

    error_events = _events_by_type(sent, "error")
    assert len(error_events) == 1
    assert "SDK crashed" in error_events[0]["payload"]["content"]
    assert error_events[0].get("request_id") == "req-err"


async def test_error_during_streaming_sends_error(runtime, sent):
    """Error mid-stream still produces an error event."""
    async def failing_messages():
        yield MockAssistantMessage(content=[MockTextBlock(text="Starting...")])
        raise ConnectionError("Lost connection")

    with _mock_sdk_generator(lambda: failing_messages()):
        await runtime.run_mission("Start work", request_id="req-mid-err")

    text_events = _events_by_type(sent, "text")
    error_events = _events_by_type(sent, "error")
    assert len(text_events) == 1
    assert len(error_events) == 1
    assert "Lost connection" in error_events[0]["payload"]["content"]


# -- Test: soul.md loading ---------------------------------------------------

async def test_loads_memory_as_system_prompt(runtime, sent):
    """When memory files exist, loader output is prepended to system prompt."""
    memory_content = "# Soul\nYou are an invoice extraction agent."
    captured_options = {}
    messages = [MockResultMessage()]

    with _mock_sdk(messages, capture_options=captured_options), \
         patch("src.runtime.load_memory", return_value=memory_content):
        await runtime.run_mission("Extract", request_id="req-soul")

    expected = f"{memory_content}\n\n---\n\n{DEFAULT_SYSTEM_PROMPT}"
    assert captured_options.get("system_prompt") == expected


async def test_fallback_prompt_when_no_memory(runtime, sent):
    """When no memory files exist, uses DEFAULT_SYSTEM_PROMPT alone."""
    captured_options = {}
    messages = [MockResultMessage()]

    with _mock_sdk(messages, capture_options=captured_options), \
         patch("src.runtime.load_memory", return_value=""):
        await runtime.run_mission("Extract", request_id="req-fallback")

    assert captured_options.get("system_prompt") == DEFAULT_SYSTEM_PROMPT


# -- Test: session_id stored for resume --------------------------------------

async def test_session_id_stored_after_mission(runtime, sent):
    """After a mission completes, runtime.last_session_id is set."""
    messages = [MockResultMessage(session_id="sess-stored")]
    with _mock_sdk(messages):
        await runtime.run_mission("Do work", request_id="req-store")

    assert runtime.last_session_id == "sess-stored"


# -- Test: Resume registers MCP tools ---------------------------------------

async def test_resume_registers_mcp_tools(runtime, sent):
    """resume_mission re-registers canvas + memory MCP tools."""
    messages = [
        MockAssistantMessage(content=[MockTextBlock(text="Resumed ok")]),
        MockResultMessage(session_id="sess-resumed-2"),
    ]
    captured_options = {}

    with _mock_sdk(messages, capture_options=captured_options):
        await runtime.resume_mission(
            text="Follow up question",
            session_id="sess-original-2",
            request_id="req-resume-tools",
        )

    assert captured_options.get("resume") == "sess-original-2"
    assert captured_options.get("permission_mode") == "bypassPermissions"
    assert captured_options.get("mcp_servers") is not None
    assert "sprite" in captured_options["mcp_servers"]


async def test_resume_fallback_on_error(runtime, sent):
    """When resume fails, falls back to a fresh run_mission."""
    # Track which calls happen: first call raises, second succeeds
    call_count = {"n": 0}
    fallback_messages = [
        MockAssistantMessage(content=[MockTextBlock(text="Fresh start")]),
        MockResultMessage(session_id="sess-fresh"),
    ]

    def factory(options=None):
        call_count["n"] += 1
        if call_count["n"] == 1:
            # First call (resume) — raise error
            return _MockClientError(RuntimeError("Session expired"))
        # Second call (fallback to run_mission) — succeed
        return _MockClient(fallback_messages)

    from contextlib import ExitStack
    stack = ExitStack()
    stack.enter_context(patch("src.runtime.ClaudeSDKClient", side_effect=factory))
    _apply_common_patches(stack)
    # Fallback calls run_mission which needs load_memory
    stack.enter_context(patch("src.runtime.load_memory", return_value=""))

    with stack:
        runtime.last_session_id = "sess-expired"
        await runtime.resume_mission(
            text="Continue please",
            session_id="sess-expired",
            request_id="req-fallback",
        )

    # Should have fallen back: last_session_id cleared then set to new session
    assert runtime.last_session_id == "sess-fresh"
    assert call_count["n"] == 2

    # Should have text + complete events from the fallback mission
    text_events = _events_by_type(sent, "text")
    complete_events = _events_by_type(sent, "complete")
    assert len(text_events) == 1
    assert text_events[0]["payload"]["content"] == "Fresh start"
    assert len(complete_events) == 1


# -- Mock infrastructure -----------------------------------------------------
# We patch both ClaudeSDKClient and the SDK type classes so isinstance checks
# in runtime._handle_message match our mock dataclasses.

_SDK_TYPE_PATCHES = {
    "src.runtime.AssistantMessage": MockAssistantMessage,
    "src.runtime.TextBlock": MockTextBlock,
    "src.runtime.ToolUseBlock": MockToolUseBlock,
    "src.runtime.ResultMessage": MockResultMessage,
}


class _MockClient:
    """Mock ClaudeSDKClient that yields predefined messages."""

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


class _MockClientFromGenerator:
    """Mock ClaudeSDKClient that yields from an async generator factory."""

    def __init__(self, gen_factory):
        self._gen_factory = gen_factory

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        pass

    async def query(self, prompt: str):
        pass

    async def receive_response(self):
        async for msg in self._gen_factory():
            yield msg


class _MockClientError:
    """Mock ClaudeSDKClient that raises on query."""

    def __init__(self, error):
        self._error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        pass

    async def query(self, prompt: str):
        raise self._error

    async def receive_response(self):
        return
        yield



def _apply_common_patches(stack):
    """Apply SDK type patches and filesystem patches to an ExitStack."""
    for target, replacement in _SDK_TYPE_PATCHES.items():
        stack.enter_context(patch(target, replacement))
    # Mock filesystem-dependent code (TranscriptLogger writes to /workspace)
    mock_transcript = MagicMock()
    mock_transcript.return_value.log = MagicMock(side_effect=lambda *a, **kw: asyncio.sleep(0))
    mock_transcript.return_value.session_id = None
    stack.enter_context(patch("src.runtime.TranscriptLogger", mock_transcript))
    async def _noop_journal(*a): pass
    stack.enter_context(patch("src.runtime.append_journal", side_effect=_noop_journal))


def _mock_sdk(messages, capture_options=None):
    """Patch ClaudeSDKClient + SDK types to return predefined messages."""
    from contextlib import ExitStack

    def factory(options=None):
        if capture_options is not None and options:
            capture_options.update({
                "system_prompt": getattr(options, "system_prompt", None),
                "resume": getattr(options, "resume", None),
                "max_turns": getattr(options, "max_turns", None),
                "permission_mode": getattr(options, "permission_mode", None),
                "mcp_servers": getattr(options, "mcp_servers", None),
            })
        return _MockClient(messages)

    stack = ExitStack()
    stack.enter_context(patch("src.runtime.ClaudeSDKClient", side_effect=factory))
    _apply_common_patches(stack)
    return stack


def _mock_sdk_generator(gen_factory):
    """Patch ClaudeSDKClient + SDK types to yield from an async generator."""
    from contextlib import ExitStack

    def factory(options=None):
        return _MockClientFromGenerator(gen_factory)

    stack = ExitStack()
    stack.enter_context(patch("src.runtime.ClaudeSDKClient", side_effect=factory))
    _apply_common_patches(stack)
    return stack


def _mock_sdk_error(error):
    """Patch ClaudeSDKClient + SDK types to raise an error."""
    from contextlib import ExitStack

    def factory(options=None):
        return _MockClientError(error)

    stack = ExitStack()
    stack.enter_context(patch("src.runtime.ClaudeSDKClient", side_effect=factory))
    _apply_common_patches(stack)
    return stack
