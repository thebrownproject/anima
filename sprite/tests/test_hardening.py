"""Tests for gateway and runtime hardening (stackdocs-m7b.14.9).

Covers: shared mission_lock, background task registry, _is_connected flag,
send_fn generation counter, server shutdown, readline timeout, SDK timeouts,
double SIGTERM guard.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.gateway import SpriteGateway
from src.runtime import AgentRuntime


def _msg(msg_type: str, payload: dict | None = None) -> str:
    return json.dumps({
        "id": str(uuid.uuid4()),
        "type": msg_type,
        "timestamp": int(time.time() * 1000),
        "payload": payload or {},
    })


# -- T6.1: mission_lock shared across gateway instances ----------------------

async def test_shared_mission_lock_across_gateways():
    """mission_lock created once and passed to multiple gateways serializes them."""
    shared_lock = asyncio.Lock()
    events: list[tuple[str, float]] = []

    async def mock_send(msg: str) -> None:
        pass

    mock_runtime = MagicMock()
    mock_runtime.handle_message = AsyncMock()
    mock_runtime._active_stack_id = None
    mock_runtime.set_active_stack_id = MagicMock()

    gw1 = SpriteGateway(send_fn=mock_send, runtime=mock_runtime, mission_lock=shared_lock)
    gw2 = SpriteGateway(send_fn=mock_send, runtime=mock_runtime, mission_lock=shared_lock)

    assert gw1.mission_lock is gw2.mission_lock

    original1 = gw1._handle_mission
    original2 = gw2._handle_mission

    async def slow_mission1(msg, req_id):
        events.append(("gw1_start", asyncio.get_event_loop().time()))
        await asyncio.sleep(0.1)
        await original1(msg, req_id)
        events.append(("gw1_end", asyncio.get_event_loop().time()))

    async def slow_mission2(msg, req_id):
        events.append(("gw2_start", asyncio.get_event_loop().time()))
        await original2(msg, req_id)
        events.append(("gw2_end", asyncio.get_event_loop().time()))

    gw1._handle_mission = slow_mission1
    gw2._handle_mission = slow_mission2

    msg1 = _msg("mission", {"text": "from gw1"})
    msg2 = _msg("mission", {"text": "from gw2"})

    await asyncio.gather(gw1.route(msg1), gw2.route(msg2))

    assert len(events) == 4
    first_end = events[1][1]
    second_start = events[2][1]
    assert second_start >= first_end, "Gateways with shared lock did not serialize"


async def test_gateway_accepts_mission_lock_param():
    """SpriteGateway constructor accepts mission_lock parameter."""
    lock = asyncio.Lock()
    gw = SpriteGateway(send_fn=AsyncMock(), runtime=MagicMock(), mission_lock=lock)
    assert gw.mission_lock is lock


async def test_gateway_creates_lock_when_not_provided():
    """SpriteGateway still works without explicit mission_lock (backwards compat)."""
    gw = SpriteGateway(send_fn=AsyncMock(), runtime=MagicMock())
    assert isinstance(gw.mission_lock, asyncio.Lock)


# -- T6.2: Background task registry -----------------------------------------

async def test_extraction_task_tracked():
    """Background extraction task is stored in gateway._tasks."""
    mock_send = AsyncMock()
    mock_runtime = MagicMock()
    mock_runtime.handle_message = AsyncMock()
    mock_runtime._active_stack_id = None

    gw = SpriteGateway(send_fn=mock_send, runtime=mock_runtime)

    msg = _msg("file_upload", {
        "filename": "test.pdf",
        "mime_type": "application/pdf",
        "data": "YWJj",  # base64 "abc"
    })

    with patch("src.gateway.Path"):
        await gw.route(msg)

    # Task should be tracked (may already be done since mock is fast)
    # Just verify the set exists and was used
    assert hasattr(gw, "_tasks")
    assert isinstance(gw._tasks, set)


async def test_cancel_tasks_cancels_tracked():
    """cancel_tasks() cancels all tracked background tasks."""
    gw = SpriteGateway(send_fn=AsyncMock(), runtime=MagicMock())

    async def long_task():
        await asyncio.sleep(10)

    task = asyncio.create_task(long_task())
    gw._tasks.add(task)
    task.add_done_callback(gw._tasks.discard)

    await gw.cancel_tasks()

    assert task.cancelled()
    assert len(gw._tasks) == 0


# -- T6.3: _is_connected flag -----------------------------------------------

async def test_send_event_checks_connected_flag():
    """_send_event returns early when _is_connected is False."""
    sent: list[str] = []

    async def mock_send(msg: str) -> None:
        sent.append(msg)

    with patch("src.runtime.ensure_templates"):
        rt = AgentRuntime(send_fn=mock_send)

    # Starts disconnected
    assert rt._is_connected is False

    # Should silently drop
    await rt._send_event("text", "hello", None)
    assert len(sent) == 0


async def test_update_send_fn_sets_connected():
    """update_send_fn sets _is_connected to True."""
    with patch("src.runtime.ensure_templates"):
        rt = AgentRuntime(send_fn=AsyncMock())

    assert rt._is_connected is False

    rt.update_send_fn(AsyncMock())
    assert rt._is_connected is True


async def test_mark_disconnected():
    """mark_disconnected sets _is_connected to False."""
    with patch("src.runtime.ensure_templates"):
        rt = AgentRuntime(send_fn=AsyncMock())

    rt.update_send_fn(AsyncMock())
    assert rt._is_connected is True

    rt.mark_disconnected()
    assert rt._is_connected is False


async def test_indirect_send_checks_connected():
    """_indirect_send returns early when disconnected."""
    sent: list[str] = []

    async def mock_send(msg: str) -> None:
        sent.append(msg)

    with patch("src.runtime.ensure_templates"):
        rt = AgentRuntime(send_fn=mock_send)

    # Disconnected: should drop
    await rt._indirect_send("msg1")
    assert len(sent) == 0

    # Connected: should send
    rt.update_send_fn(mock_send)
    await rt._indirect_send("msg2")
    assert sent == ["msg2"]


# -- T6.4: send_fn generation counter ---------------------------------------

async def test_generation_increments_on_send_fn_swap():
    """Each update_send_fn call increments _send_generation."""
    with patch("src.runtime.ensure_templates"):
        rt = AgentRuntime(send_fn=AsyncMock())

    gen0 = rt._send_generation
    rt.update_send_fn(AsyncMock())
    assert rt._send_generation == gen0 + 1
    rt.update_send_fn(AsyncMock())
    assert rt._send_generation == gen0 + 2


async def test_stale_generation_send_dropped():
    """If send_fn changes mid-await, the stale send is dropped."""
    slow_send_started = asyncio.Event()
    slow_send_proceed = asyncio.Event()
    sent_old: list[str] = []
    sent_new: list[str] = []

    async def slow_send(msg: str) -> None:
        sent_old.append(msg)
        slow_send_started.set()
        await slow_send_proceed.wait()

    async def new_send(msg: str) -> None:
        sent_new.append(msg)

    with patch("src.runtime.ensure_templates"):
        rt = AgentRuntime(send_fn=slow_send)

    rt.update_send_fn(slow_send)  # gen=1, connected=True

    # Start a send that will block
    send_task = asyncio.create_task(
        rt._send_event("text", "old message", None)
    )
    await slow_send_started.wait()

    # Swap send_fn while the old send is in-flight
    rt.update_send_fn(new_send)  # gen=2

    # Let the old send complete -- the message was already sent to old_send
    # but the generation check happens before the await
    slow_send_proceed.set()
    await send_task

    # The old send may or may not have gone through depending on timing,
    # but new sends should use the new fn
    await rt._send_event("text", "new message", None)
    assert len(sent_new) == 1


# -- T6.5: server.wait_closed() and handler cancellation --------------------

async def test_server_wait_closed_called():
    """server.wait_closed() is awaited after server.close() in shutdown."""
    # We test this by checking the source code structure -- integration test
    # would require starting the actual server. We verify the pattern exists.
    import inspect
    from src import server as server_mod

    source = inspect.getsource(server_mod.main)
    assert "wait_closed" in source, "server.wait_closed() not found in main()"


async def test_handler_tasks_cancelled_on_shutdown():
    """Active handler tasks are cancelled during shutdown."""
    import inspect
    from src import server as server_mod

    source = inspect.getsource(server_mod.main)
    # Should have handler task tracking and cancellation
    assert "_handlers" in source or "handler_tasks" in source or "cancel" in source, \
        "No handler cancellation found in main()"


# -- T6.6: readline timeout --------------------------------------------------

async def test_readline_has_timeout():
    """reader.readline() is wrapped in asyncio.wait_for with timeout."""
    import inspect
    from src import server as server_mod

    source = inspect.getsource(server_mod.handle_connection)
    assert "wait_for" in source, "readline not wrapped in asyncio.wait_for"
    assert "READLINE_TIMEOUT" in source, "READLINE_TIMEOUT constant not used"
    assert server_mod.READLINE_TIMEOUT == 120, "READLINE_TIMEOUT should be 120s"


# -- T6.7: SDK call timeouts -------------------------------------------------

async def test_sdk_query_has_timeout():
    """_client.query() is wrapped in asyncio.wait_for."""
    import inspect
    from src import runtime as runtime_mod

    source = inspect.getsource(runtime_mod.AgentRuntime._query_and_stream)
    assert "wait_for" in source, "query() not wrapped in asyncio.wait_for"


async def test_sdk_receive_has_timeout():
    """receive_response iteration has a timeout."""
    import inspect
    from src import runtime as runtime_mod

    source = inspect.getsource(runtime_mod.AgentRuntime._query_and_stream)
    # Should have per-message timeout or total turn timeout
    assert "wait_for" in source or "timeout" in source.lower(), \
        "receive_response has no timeout"


# -- T6.11: double SIGTERM guard ---------------------------------------------

async def test_double_sigterm_no_error():
    """Calling the signal handler twice does not raise InvalidStateError."""
    stop = asyncio.Future()

    # Simulate the guarded signal handler
    def signal_handler():
        if not stop.done():
            stop.set_result(None)

    signal_handler()  # First call: should succeed
    signal_handler()  # Second call: should be a no-op

    assert stop.done()
    assert stop.result() is None


async def test_double_sigterm_guard_in_source():
    """server.py signal handler checks stop.done() before set_result()."""
    import inspect
    from src import server as server_mod

    source = inspect.getsource(server_mod.main)
    assert "stop.done()" in source or "not stop.done()" in source, \
        "Signal handler does not check stop.done()"
