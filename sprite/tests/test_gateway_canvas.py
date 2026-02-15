"""Tests for gateway canvas_interaction dispatch — user-initiated operations."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.gateway import SpriteGateway
from src.database import WorkspaceDB
from src.protocol import _new_id, _now_ms


def _make_canvas_msg(action: str, card_id: str = "", data: dict | None = None) -> str:
    """Build a raw canvas_interaction message JSON."""
    return json.dumps({
        "id": _new_id(),
        "timestamp": _now_ms(),
        "type": "canvas_interaction",
        "payload": {
            "card_id": card_id,
            "action": action,
            "data": data or {},
        },
    })


@pytest.fixture
def mock_send():
    return AsyncMock()


@pytest.fixture
async def workspace_db(tmp_path):
    path = str(tmp_path / "workspace.db")
    db = WorkspaceDB(db_path=path)
    await db.connect()
    yield db
    await db.close()


@pytest.fixture
def gateway(mock_send, workspace_db):
    # Pass mock runtime to avoid AgentRuntime trying to create /workspace/.os
    return SpriteGateway(send_fn=mock_send, runtime=MagicMock(), workspace_db=workspace_db)


@pytest.mark.asyncio
async def test_gateway_archive_card(gateway, workspace_db):
    """Gateway handles archive_card directly — no agent involvement."""
    await workspace_db.create_stack("s1", "Stack")
    await workspace_db.upsert_card("c1", "s1", "Card 1", [{"type": "text"}])

    msg = _make_canvas_msg("archive_card", card_id="c1")
    await gateway.route(msg)

    row = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c1",))
    assert row["status"] == "archived"
    assert row["archived_at"] is not None


@pytest.mark.asyncio
async def test_gateway_archive_stack(gateway, workspace_db):
    """Gateway handles archive_stack — cascades to cards."""
    await workspace_db.create_stack("s1", "Stack")
    await workspace_db.upsert_card("c1", "s1", "Card 1", [])
    await workspace_db.upsert_card("c2", "s1", "Card 2", [])

    msg = _make_canvas_msg("archive_stack", card_id="", data={"stack_id": "s1"})
    await gateway.route(msg)

    stack = await workspace_db.fetchone("SELECT * FROM stacks WHERE id = ?", ("s1",))
    assert stack["status"] == "archived"

    c1 = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c1",))
    c2 = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c2",))
    assert c1["status"] == "archived"
    assert c2["status"] == "archived"


@pytest.mark.asyncio
async def test_gateway_create_stack(gateway, workspace_db):
    """Gateway handles create_stack — creates new stack in DB."""
    msg = _make_canvas_msg("create_stack", card_id="", data={
        "stack_id": "new-stack",
        "name": "My New Stack",
        "color": "#00ff00",
    })
    await gateway.route(msg)

    stack = await workspace_db.fetchone("SELECT * FROM stacks WHERE id = ?", ("new-stack",))
    assert stack is not None
    assert stack["name"] == "My New Stack"
    assert stack["color"] == "#00ff00"
    assert stack["status"] == "active"


@pytest.mark.asyncio
async def test_gateway_restore_stack(gateway, workspace_db):
    """Gateway handles restore_stack — restores stack + cards."""
    await workspace_db.create_stack("s1", "Stack")
    await workspace_db.upsert_card("c1", "s1", "Card", [])
    await workspace_db.archive_stack("s1")

    msg = _make_canvas_msg("restore_stack", card_id="", data={"stack_id": "s1"})
    await gateway.route(msg)

    stack = await workspace_db.fetchone("SELECT * FROM stacks WHERE id = ?", ("s1",))
    assert stack["status"] == "active"

    card = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c1",))
    assert card["status"] == "active"


@pytest.mark.asyncio
async def test_gateway_canvas_without_db(mock_send):
    """Gateway without workspace_db still sends ack (no crash)."""
    # Pass a mock runtime to avoid AgentRuntime trying to create /workspace/.os
    gw = SpriteGateway(send_fn=mock_send, runtime=MagicMock())
    msg = _make_canvas_msg("archive_card", card_id="c1")
    await gw.route(msg)

    # Should get ack without error
    assert mock_send.call_count >= 1
    last_call = mock_send.call_args[0][0]
    parsed = json.loads(last_call)
    assert parsed["type"] == "system"


@pytest.mark.asyncio
async def test_agent_and_user_archive_same_db_method(workspace_db, mock_send):
    """Agent close_card and user archive_card both use workspace_db.archive_card."""
    from src.tools.canvas import create_canvas_tools

    await workspace_db.create_stack("s1", "Stack")

    # Agent-initiated: create card then close it
    tools = create_canvas_tools(mock_send, workspace_db=workspace_db, stack_id_fn=lambda: "s1")
    await tools[0].handler({"title": "Agent Card", "blocks": [{"type": "text", "content": "hi"}]})
    agent_card_id = json.loads(mock_send.call_args[0][0])["payload"]["card_id"]
    await tools[2].handler({"card_id": agent_card_id})

    agent_row = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", (agent_card_id,))
    assert agent_row["status"] == "archived"

    # User-initiated: create card via DB, then archive via gateway
    await workspace_db.upsert_card("user-c1", "s1", "User Card", [])
    gw = SpriteGateway(send_fn=mock_send, runtime=MagicMock(), workspace_db=workspace_db)
    msg = _make_canvas_msg("archive_card", card_id="user-c1")
    await gw.route(msg)

    user_row = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("user-c1",))
    assert user_row["status"] == "archived"

    # Both archived the same way — status + archived_at set
    assert agent_row["archived_at"] is not None
    assert user_row["archived_at"] is not None


@pytest.mark.asyncio
async def test_gateway_move_card(gateway, workspace_db, mock_send):
    """Gateway handles 'move' canvas_interaction — persists position to DB."""
    await workspace_db.create_stack("s1", "Stack")
    await workspace_db.upsert_card("c1", "s1", "Card 1", [])

    msg = _make_canvas_msg("move", card_id="c1", data={
        "position_x": 100.0,
        "position_y": 200.0,
        "z_index": 3,
    })
    await gateway.route(msg)

    row = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", ("c1",))
    assert row["position_x"] == 100.0
    assert row["position_y"] == 200.0
    assert row["z_index"] == 3

    # Should receive ack (not error)
    last_call = mock_send.call_args[0][0]
    parsed = json.loads(last_call)
    assert parsed["type"] == "system"
    assert parsed["payload"]["event"] == "connected"  # ack uses event=connected


@pytest.mark.asyncio
async def test_gateway_move_invalid_card_returns_error(gateway, workspace_db, mock_send):
    """Gateway 'move' with nonexistent card_id returns error."""
    await workspace_db.create_stack("s1", "Stack")

    msg = _make_canvas_msg("move", card_id="no-such-card", data={
        "position_x": 50.0,
        "position_y": 60.0,
        "z_index": 1,
    })
    await gateway.route(msg)

    last_call = mock_send.call_args[0][0]
    parsed = json.loads(last_call)
    assert parsed["type"] == "system"
    assert parsed["payload"]["event"] == "error"
