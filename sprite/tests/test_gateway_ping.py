"""Tests for gateway ping/pong handling."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.gateway import SpriteGateway
from src.protocol import _new_id, _now_ms


@pytest.fixture
def mock_send():
    return AsyncMock()


@pytest.fixture
def gateway(mock_send):
    return SpriteGateway(send_fn=mock_send, runtime=MagicMock())


@pytest.mark.asyncio
async def test_ping_responds_with_pong(gateway, mock_send):
    """Sprite receives ping and responds with pong containing matching id."""
    ping_id = _new_id()
    ping = json.dumps({"type": "ping", "id": ping_id, "timestamp": _now_ms()})

    await gateway.route(ping)

    assert mock_send.call_count == 1
    pong = json.loads(mock_send.call_args[0][0])
    assert pong["type"] == "pong"
    assert pong["id"] == ping_id
    assert isinstance(pong["timestamp"], int)


@pytest.mark.asyncio
async def test_ping_without_id_generates_one(gateway, mock_send):
    """Ping without id field still gets a pong with a generated id."""
    ping = json.dumps({"type": "ping", "timestamp": _now_ms()})

    await gateway.route(ping)

    assert mock_send.call_count == 1
    pong = json.loads(mock_send.call_args[0][0])
    assert pong["type"] == "pong"
    assert isinstance(pong["id"], str)
    assert len(pong["id"]) > 0


@pytest.mark.asyncio
async def test_ping_does_not_reach_message_validation(gateway, mock_send):
    """Ping is handled before is_websocket_message check (no error sent)."""
    # Ping without id would fail is_websocket_message, but should still get pong
    ping = json.dumps({"type": "ping", "timestamp": _now_ms()})

    await gateway.route(ping)

    pong = json.loads(mock_send.call_args[0][0])
    assert pong["type"] == "pong"
    # No error message should be sent
    assert mock_send.call_count == 1
