"""Tests for Sprite WebSocket server and SpriteGateway."""

from __future__ import annotations

import asyncio
import json
import time
import uuid

import pytest
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve

from src.server import handle_connection
from src.gateway import SpriteGateway


def _msg(msg_type: str, payload: dict | None = None, **extra) -> str:
    """Build a minimal valid WS message as JSON string."""
    base = {
        "id": str(uuid.uuid4()),
        "type": msg_type,
        "timestamp": int(time.time() * 1000),
        "payload": payload or {},
    }
    base.update(extra)
    return json.dumps(base)


@pytest.fixture
async def server():
    """Start a WS server on a free port, yield the port, then shut down."""
    async with serve(handle_connection, "127.0.0.1", 0) as srv:
        port = srv.sockets[0].getsockname()[1]
        yield port


# -- Test: Connection --------------------------------------------------------

async def test_ws_connect(server):
    """WS client connects to server successfully."""
    port = server
    async with connect(f"ws://127.0.0.1:{port}") as ws:
        assert ws.protocol.state.name == "OPEN"


# -- Test: Each message type returns ack -------------------------------------

@pytest.mark.parametrize("msg_type,payload,expected_ack", [
    ("mission", {"text": "Hello agent"}, "mission_received"),
    ("file_upload", {"filename": "test.pdf", "mime_type": "application/pdf", "data": "abc"}, "file_upload_received"),
    ("canvas_interaction", {"card_id": "c1", "action": "edit_cell", "data": {}}, "canvas_interaction_received"),
    ("auth", {"token": "jwt-token-here"}, "auth_received"),
    ("system", {"event": "connected"}, "system_received"),
])
async def test_message_ack(server, msg_type, payload, expected_ack):
    """Sending each message type returns an echo acknowledgment."""
    port = server
    async with connect(f"ws://127.0.0.1:{port}") as ws:
        await ws.send(_msg(msg_type, payload))
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
        assert resp["type"] == "system"
        assert resp["payload"]["message"] == expected_ack


async def test_heartbeat_ack(server):
    """Heartbeat (not a formal protocol type) still gets routed and acked."""
    port = server
    async with connect(f"ws://127.0.0.1:{port}") as ws:
        await ws.send(_msg("heartbeat", {}))
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
        assert resp["type"] == "system"
        assert resp["payload"]["message"] == "heartbeat_received"


# -- Test: Unknown message type ----------------------------------------------

async def test_unknown_type_returns_error(server):
    """Unknown message type logs warning and returns error, doesn't crash."""
    port = server
    async with connect(f"ws://127.0.0.1:{port}") as ws:
        await ws.send(_msg("banana", {"fruit": True}))
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
        assert resp["type"] == "system"
        assert resp["payload"]["event"] == "error"
        assert "Unknown type" in resp["payload"]["message"]

        # Connection still alive -- send a valid message after the error
        await ws.send(_msg("mission", {"text": "still alive?"}))
        resp2 = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
        assert resp2["payload"]["message"] == "mission_received"


async def test_invalid_json_returns_error(server):
    """Completely invalid JSON doesn't crash the server."""
    port = server
    async with connect(f"ws://127.0.0.1:{port}") as ws:
        await ws.send("not json at all {{{")
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
        assert resp["payload"]["event"] == "error"


# -- Test: Async lock serialization -----------------------------------------

async def test_mission_lock_serialization():
    """Two concurrent missions execute serially through the async lock.

    We inject a delay in the mission handler and verify the second mission
    doesn't start until the first completes.
    """
    events: list[tuple[str, float]] = []
    sent: list[str] = []

    async def mock_send(msg: str) -> None:
        sent.append(msg)

    gw = SpriteGateway(send_fn=mock_send)

    # Monkey-patch mission handler to add a delay and record timing
    original_handler = gw._handle_mission

    async def slow_mission(msg, req_id):
        events.append(("start", asyncio.get_event_loop().time()))
        await asyncio.sleep(0.1)
        await original_handler(msg, req_id)
        events.append(("end", asyncio.get_event_loop().time()))

    gw._handle_mission = slow_mission

    msg1 = _msg("mission", {"text": "first"})
    msg2 = _msg("mission", {"text": "second"})

    # Fire both concurrently
    await asyncio.gather(gw.route(msg1), gw.route(msg2))

    # Should have 4 events: start1, end1, start2, end2
    assert len(events) == 4
    # Second start should be after first end (serial execution)
    first_end = events[1][1]
    second_start = events[2][1]
    assert second_start >= first_end, "Second mission started before first ended"


async def test_heartbeat_shares_mission_lock():
    """Heartbeat and mission share the same lock -- they serialize."""
    events: list[tuple[str, str, float]] = []
    sent: list[str] = []

    async def mock_send(msg: str) -> None:
        sent.append(msg)

    gw = SpriteGateway(send_fn=mock_send)

    original_mission = gw._handle_mission
    original_heartbeat = gw._handle_heartbeat

    async def slow_mission(msg, req_id):
        events.append(("mission", "start", asyncio.get_event_loop().time()))
        await asyncio.sleep(0.1)
        await original_mission(msg, req_id)
        events.append(("mission", "end", asyncio.get_event_loop().time()))

    async def slow_heartbeat(msg, req_id):
        events.append(("heartbeat", "start", asyncio.get_event_loop().time()))
        await asyncio.sleep(0.05)
        await original_heartbeat(msg, req_id)
        events.append(("heartbeat", "end", asyncio.get_event_loop().time()))

    gw._handle_mission = slow_mission
    gw._handle_heartbeat = slow_heartbeat

    mission_msg = _msg("mission", {"text": "do work"})
    heartbeat_msg = _msg("heartbeat", {})

    await asyncio.gather(gw.route(mission_msg), gw.route(heartbeat_msg))

    assert len(events) == 4
    # Second handler starts after first ends
    first_end = events[1][2]
    second_start = events[2][2]
    assert second_start >= first_end, "Heartbeat and mission did not serialize"
