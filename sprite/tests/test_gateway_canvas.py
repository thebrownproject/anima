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


# -- Extraction tests ----------------------------------------------------------


@pytest.mark.asyncio
async def test_run_extraction_calls_runtime_and_completes(gateway, workspace_db):
    """_run_extraction sends context to runtime and marks doc completed."""
    gateway.runtime.handle_message = AsyncMock()

    doc_id = "doc-123"
    filename = "invoice.pdf"
    await workspace_db.create_document(doc_id, filename, "application/pdf", "/workspace/uploads/doc-123_invoice.pdf")

    await gateway._run_extraction(doc_id, filename, "application/pdf", "/workspace/uploads/doc-123_invoice.pdf")

    gateway.runtime.handle_message.assert_called_once()
    context_arg = gateway.runtime.handle_message.call_args[0][0]
    assert "invoice.pdf" in context_arg
    assert "/workspace/uploads/doc-123_invoice.pdf" in context_arg

    row = await workspace_db.fetchone("SELECT * FROM documents WHERE doc_id = ?", (doc_id,))
    assert row["status"] == "completed"


@pytest.mark.asyncio
async def test_run_extraction_marks_failed_on_error(gateway, workspace_db):
    """_run_extraction marks doc failed when runtime raises."""
    gateway.runtime.handle_message = AsyncMock(side_effect=RuntimeError("agent crashed"))

    doc_id = "doc-456"
    await workspace_db.create_document(doc_id, "bad.pdf", "application/pdf", "/workspace/uploads/doc-456_bad.pdf")

    await gateway._run_extraction(doc_id, "bad.pdf", "application/pdf", "/workspace/uploads/doc-456_bad.pdf")

    row = await workspace_db.fetchone("SELECT * FROM documents WHERE doc_id = ?", (doc_id,))
    assert row["status"] == "failed"


@pytest.mark.asyncio
async def test_run_extraction_acquires_mission_lock(gateway, workspace_db):
    """_run_extraction holds mission_lock during runtime call to prevent concurrent SDK access."""
    lock_was_held = False

    async def check_lock(*args, **kwargs):
        nonlocal lock_was_held
        lock_was_held = gateway.mission_lock.locked()

    gateway.runtime.handle_message = AsyncMock(side_effect=check_lock)

    doc_id = "doc-789"
    await workspace_db.create_document(doc_id, "test.pdf", "application/pdf", "/tmp/test.pdf")

    await gateway._run_extraction(doc_id, "test.pdf", "application/pdf", "/tmp/test.pdf")

    assert lock_was_held, "mission_lock should be held during runtime.handle_message()"


# -- Processing card PDF embed tests -------------------------------------------


@pytest.mark.asyncio
async def test_processing_card_embeds_document_block(gateway, workspace_db, mock_send):
    """Processing card includes document block when data_b64 is provided and under 5MB."""
    await workspace_db.create_stack("s1", "Stack")
    gateway.runtime._active_stack_id = "s1"

    data_b64 = "AAAA"  # small base64 payload
    await gateway._send_canvas_processing_card("doc-1", "test.pdf", data_b64, "application/pdf")

    sent = json.loads(mock_send.call_args[0][0])
    blocks = sent["payload"]["blocks"]
    assert sent["payload"]["size"] == "large"
    assert blocks[0]["type"] == "document"
    assert blocks[0]["data"] == data_b64
    assert blocks[0]["mime_type"] == "application/pdf"
    assert blocks[0]["filename"] == "test.pdf"
    assert blocks[1]["type"] == "heading"
    assert blocks[2]["type"] == "badge"


@pytest.mark.asyncio
async def test_processing_card_skips_document_block_for_large_files(mock_send):
    """Processing card omits document block when data_b64 >= 5MB."""
    gw = SpriteGateway(send_fn=mock_send, runtime=MagicMock())
    data_b64 = "A" * 5_000_000  # exactly at the limit
    await gw._send_canvas_processing_card("doc-2", "huge.pdf", data_b64, "application/pdf")

    sent = json.loads(mock_send.call_args[0][0])
    blocks = sent["payload"]["blocks"]
    assert sent["payload"]["size"] == "medium"
    assert blocks[0]["type"] == "heading"
    assert all(b["type"] != "document" for b in blocks)


@pytest.mark.asyncio
async def test_processing_card_no_document_block_without_data(mock_send):
    """Processing card has no document block when data_b64 is empty."""
    gw = SpriteGateway(send_fn=mock_send, runtime=MagicMock())
    await gw._send_canvas_processing_card("doc-3", "no-data.pdf")

    sent = json.loads(mock_send.call_args[0][0])
    blocks = sent["payload"]["blocks"]
    assert blocks[0]["type"] == "heading"
    assert blocks[1]["type"] == "badge"
    assert sent["payload"]["size"] == "medium"


# -- Extraction card lifecycle tests -------------------------------------------


@pytest.mark.asyncio
async def test_extraction_success_swaps_badge_to_ready(gateway, workspace_db, mock_send):
    """Successful extraction swaps badge from Processing to Ready."""
    gateway.runtime.handle_message = AsyncMock()
    await workspace_db.create_stack("s1", "Stack")
    gateway.runtime._active_stack_id = "s1"

    doc_id = "doc-badge-ok"
    await workspace_db.create_document(doc_id, "invoice.pdf", "application/pdf", "/tmp/invoice.pdf")
    await workspace_db.upsert_card(doc_id, "s1", "invoice.pdf", [
        {"type": "heading", "text": "invoice.pdf"},
        {"type": "badge", "text": "Processing...", "variant": "default"},
    ])

    await gateway._run_extraction(doc_id, "invoice.pdf", "application/pdf", "/tmp/invoice.pdf")

    row = await workspace_db.fetchone("SELECT blocks FROM cards WHERE card_id = ?", (doc_id,))
    blocks = json.loads(row["blocks"])
    badge = next(b for b in blocks if b["type"] == "badge")
    assert badge["text"] == "Ready"
    assert badge["variant"] == "success"

    # canvas_update sent to frontend
    last_sent = json.loads(mock_send.call_args[0][0])
    assert last_sent["type"] == "canvas_update"
    assert last_sent["payload"]["command"] == "update_card"


@pytest.mark.asyncio
async def test_extraction_failure_swaps_badge_to_failed_with_error(gateway, workspace_db, mock_send):
    """Failed extraction swaps badge to Failed + appends error text block."""
    gateway.runtime.handle_message = AsyncMock(side_effect=RuntimeError("parse error"))
    await workspace_db.create_stack("s1", "Stack")
    gateway.runtime._active_stack_id = "s1"

    doc_id = "doc-badge-fail"
    await workspace_db.create_document(doc_id, "bad.pdf", "application/pdf", "/tmp/bad.pdf")
    await workspace_db.upsert_card(doc_id, "s1", "bad.pdf", [
        {"type": "document", "id": "d1", "data": "AAAA", "mime_type": "application/pdf", "filename": "bad.pdf"},
        {"type": "heading", "text": "bad.pdf"},
        {"type": "badge", "text": "Processing...", "variant": "default"},
    ])

    await gateway._run_extraction(doc_id, "bad.pdf", "application/pdf", "/tmp/bad.pdf")

    row = await workspace_db.fetchone("SELECT blocks FROM cards WHERE card_id = ?", (doc_id,))
    blocks = json.loads(row["blocks"])

    # Document block preserved
    assert blocks[0]["type"] == "document"
    # Heading preserved
    assert blocks[1]["type"] == "heading"
    # Badge swapped to Failed
    badge = next(b for b in blocks if b["type"] == "badge")
    assert badge["text"] == "Failed"
    assert badge["variant"] == "destructive"
    # Error text appended
    error_block = next(b for b in blocks if b["type"] == "text")
    assert "bad.pdf" in error_block["content"]

    # Error message sent to user
    calls = [json.loads(c[0][0]) for c in mock_send.call_args_list]
    error_msgs = [c for c in calls if c.get("type") == "system" and c.get("payload", {}).get("event") == "error"]
    assert any("bad.pdf" in m["payload"]["message"] for m in error_msgs)


@pytest.mark.asyncio
async def test_extraction_prompt_includes_doc_id(gateway, workspace_db):
    """Extraction context string includes the doc_id so agent can reference the card."""
    gateway.runtime.handle_message = AsyncMock()

    doc_id = "doc-prompt-check"
    await workspace_db.create_document(doc_id, "test.pdf", "application/pdf", "/tmp/test.pdf")

    await gateway._run_extraction(doc_id, "test.pdf", "application/pdf", "/tmp/test.pdf")

    context_arg = gateway.runtime.handle_message.call_args[0][0]
    assert doc_id in context_arg
    assert "card_id" in context_arg
    assert "update_card" in context_arg


# -- Canvas context formatting tests ------------------------------------------


def test_format_canvas_context_includes_document_block():
    """_format_canvas_context formats document blocks with filename only (no base64)."""
    from src.gateway import _format_canvas_context

    state = [{
        "card_id": "c1",
        "title": "Invoice",
        "blocks": [
            {"type": "document", "filename": "invoice.pdf", "data": "HUGE_BASE64_DATA"},
            {"type": "heading", "text": "Invoice"},
        ],
    }]
    result = _format_canvas_context(state)
    assert "[document] invoice.pdf" in result
    assert "HUGE_BASE64_DATA" not in result
