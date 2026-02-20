"""Tests for canvas_tools.py — canvas card creation, update, and close tools."""

import json
import pytest
from unittest.mock import AsyncMock

from src.tools.canvas import create_canvas_tools
from src.protocol import parse_message
from src.database import WorkspaceDB


@pytest.fixture
def mock_send():
    """Mock WebSocket send function."""
    return AsyncMock()


@pytest.fixture
def canvas_tools(mock_send):
    """Canvas tools scoped with mock send function (no DB, backward compat)."""
    return create_canvas_tools(mock_send)


@pytest.fixture
async def workspace_db(tmp_path):
    path = str(tmp_path / "workspace.db")
    db = WorkspaceDB(db_path=path)
    await db.connect()
    await db.create_stack("stack-1", "Test Stack")
    yield db
    await db.close()


@pytest.fixture
def db_canvas_tools(mock_send, workspace_db):
    """Canvas tools with workspace_db and stack_id for persistence tests."""
    return create_canvas_tools(mock_send, workspace_db=workspace_db, stack_id_fn=lambda: "stack-1")


@pytest.mark.asyncio
async def test_create_card_valid(canvas_tools, mock_send):
    """create_card sends canvas_update with create_card command and size."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "Test Card",
        "size": "large",
        "blocks": [
            {"type": "heading", "text": "Test Heading"},
            {"type": "stat", "value": "$100", "label": "Total"},
        ]
    })

    assert "is_error" not in result
    assert "Card created" in result["content"][0]["text"]

    assert mock_send.call_count == 1

    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    assert sent_msg["type"] == "canvas_update"
    assert sent_msg["payload"]["command"] == "create_card"
    assert sent_msg["payload"]["title"] == "Test Card"
    assert sent_msg["payload"]["size"] == "large"
    assert "card_id" in sent_msg["payload"]

    blocks = sent_msg["payload"]["blocks"]
    assert len(blocks) == 2
    assert blocks[0]["type"] == "heading"
    assert blocks[0]["text"] == "Test Heading"
    assert blocks[1]["type"] == "stat"
    assert blocks[1]["value"] == "$100"

    assert "id" in blocks[0]
    assert "id" in blocks[1]


@pytest.mark.asyncio
async def test_create_card_default_size(canvas_tools, mock_send):
    """create_card defaults to 'medium' when size is omitted."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "Test",
        "blocks": [{"type": "text", "content": "Hello"}]
    })

    assert "is_error" not in result
    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    assert sent_msg["payload"]["size"] == "medium"


@pytest.mark.asyncio
async def test_create_card_auto_block_ids(canvas_tools, mock_send):
    """create_card auto-generates block IDs if missing."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "Test",
        "blocks": [
            {"type": "text", "content": "Hello world"}
        ]
    })

    assert "is_error" not in result
    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    assert "id" in sent_msg["payload"]["blocks"][0]
    assert len(sent_msg["payload"]["blocks"][0]["id"]) == 36  # UUID length


@pytest.mark.asyncio
async def test_create_card_missing_title(canvas_tools):
    """create_card returns error if title is missing."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "",
        "blocks": []
    })

    assert result["is_error"] is True
    assert "title is required" in result["content"][0]["text"]


@pytest.mark.asyncio
async def test_create_card_invalid_size(canvas_tools):
    """create_card returns error for invalid size."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "Test",
        "size": "enormous",
        "blocks": []
    })

    assert result["is_error"] is True
    assert "size must be one of" in result["content"][0]["text"]


@pytest.mark.asyncio
async def test_create_card_invalid_block_type(canvas_tools):
    """create_card returns error for invalid block type."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "Test",
        "blocks": [{"type": "invalid", "data": {}}]
    })

    assert result["is_error"] is True
    assert "Invalid block type" in result["content"][0]["text"]


@pytest.mark.asyncio
async def test_create_card_missing_required_field(canvas_tools):
    """create_card returns error when block missing required field."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "Test",
        "blocks": [{"type": "heading"}]  # Missing 'text' field
    })

    assert result["is_error"] is True
    assert "requires 'text' field" in result["content"][0]["text"]


@pytest.mark.asyncio
async def test_create_card_all_block_types(canvas_tools, mock_send):
    """create_card handles all MVP block types."""
    create_card = canvas_tools[0].handler

    blocks = [
        {"type": "heading", "text": "Title", "subtitle": "Subtitle"},
        {"type": "stat", "value": "100", "label": "Count"},
        {"type": "key-value", "pairs": [{"label": "Name", "value": "John"}]},
        {"type": "table", "columns": ["A"], "rows": [{"A": "1"}]},
        {"type": "badge", "text": "Active", "variant": "success"},
        {"type": "progress", "value": 75, "label": "Loading"},
        {"type": "text", "content": "# Markdown content"},
        {"type": "separator"},
    ]

    result = await create_card({
        "title": "All Blocks",
        "size": "full",
        "blocks": blocks
    })

    assert "is_error" not in result
    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    assert len(sent_msg["payload"]["blocks"]) == 8


@pytest.mark.asyncio
async def test_update_card_valid(canvas_tools, mock_send):
    """update_card sends canvas_update with update_card command."""
    update_card = canvas_tools[1].handler

    result = await update_card({
        "card_id": "test-card-123",
        "blocks": [
            {"id": "block-1", "type": "stat", "value": "$200", "label": "Updated"}
        ]
    })

    assert "is_error" not in result
    assert "Card test-card-123 updated" in result["content"][0]["text"]

    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    assert sent_msg["type"] == "canvas_update"
    assert sent_msg["payload"]["command"] == "update_card"
    assert sent_msg["payload"]["card_id"] == "test-card-123"
    assert len(sent_msg["payload"]["blocks"]) == 1
    assert sent_msg["payload"]["blocks"][0]["value"] == "$200"


@pytest.mark.asyncio
async def test_update_card_with_size(canvas_tools, mock_send):
    """update_card passes size through to resize a card."""
    update_card = canvas_tools[1].handler

    result = await update_card({
        "card_id": "test-card-123",
        "size": "full",
        "blocks": [
            {"id": "block-1", "type": "text", "content": "Expanded"}
        ]
    })

    assert "is_error" not in result
    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    assert sent_msg["payload"]["size"] == "full"


@pytest.mark.asyncio
async def test_update_card_invalid_size(canvas_tools):
    """update_card returns error for invalid size."""
    update_card = canvas_tools[1].handler

    result = await update_card({
        "card_id": "test-card-123",
        "size": "huge",
        "blocks": [{"type": "text", "content": "test"}]
    })

    assert result["is_error"] is True
    assert "size must be one of" in result["content"][0]["text"]


@pytest.mark.asyncio
async def test_update_card_missing_card_id(canvas_tools):
    """update_card returns error if card_id is missing."""
    update_card = canvas_tools[1].handler

    result = await update_card({
        "card_id": "",
        "blocks": []
    })

    assert result["is_error"] is True
    assert "card_id is required" in result["content"][0]["text"]


@pytest.mark.asyncio
async def test_close_card_valid(canvas_tools, mock_send):
    """close_card sends canvas_update with close_card command."""
    close_card = canvas_tools[2].handler

    result = await close_card({
        "card_id": "test-card-456"
    })

    assert "is_error" not in result
    assert "Card test-card-456 closed" in result["content"][0]["text"]

    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    assert sent_msg["type"] == "canvas_update"
    assert sent_msg["payload"]["command"] == "close_card"
    assert sent_msg["payload"]["card_id"] == "test-card-456"
    assert "blocks" not in sent_msg["payload"]


@pytest.mark.asyncio
async def test_close_card_missing_card_id(canvas_tools):
    """close_card returns error if card_id is missing."""
    close_card = canvas_tools[2].handler

    result = await close_card({
        "card_id": ""
    })

    assert result["is_error"] is True
    assert "card_id is required" in result["content"][0]["text"]


@pytest.mark.asyncio
async def test_json_stringified_blocks(canvas_tools, mock_send):
    """create_card handles stringified JSON blocks (Claude sometimes does this)."""
    create_card = canvas_tools[0].handler

    blocks_json = json.dumps([
        {"type": "text", "content": "Hello"}
    ])

    result = await create_card({
        "title": "Test",
        "blocks": blocks_json  # Stringified
    })

    assert "is_error" not in result
    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    assert len(sent_msg["payload"]["blocks"]) == 1
    assert sent_msg["payload"]["blocks"][0]["content"] == "Hello"


@pytest.mark.asyncio
async def test_tool_registration_count(canvas_tools):
    """Verify all 3 canvas tools are registered."""
    assert len(canvas_tools) == 3


@pytest.mark.asyncio
async def test_protocol_message_parseable(canvas_tools, mock_send):
    """Sent messages match protocol schema and are parseable."""
    create_card = canvas_tools[0].handler

    await create_card({
        "title": "Test",
        "blocks": [{"type": "separator"}]
    })

    sent_json = mock_send.call_args[0][0]
    parsed = parse_message(sent_json)

    assert parsed is not None
    assert parsed["type"] == "canvas_update"


# -- DB persistence tests (m7b.12.10) ----------------------------------------


@pytest.mark.asyncio
async def test_create_card_sends_stack_id(db_canvas_tools, mock_send):
    """create_card sends canvas_update with stack_id from closure."""
    create_card = db_canvas_tools[0].handler

    result = await create_card({
        "title": "Persistent Card",
        "blocks": [{"type": "text", "content": "Hello"}],
    })

    assert "is_error" not in result
    sent_msg = json.loads(mock_send.call_args[0][0])
    assert sent_msg["payload"]["stack_id"] == "stack-1"


@pytest.mark.asyncio
async def test_create_card_persists_to_db(db_canvas_tools, mock_send, workspace_db):
    """create_card persists card row to WorkspaceDB."""
    create_card = db_canvas_tools[0].handler

    await create_card({
        "title": "DB Card",
        "size": "large",
        "blocks": [{"type": "text", "content": "Saved"}],
    })

    sent_msg = json.loads(mock_send.call_args[0][0])
    card_id = sent_msg["payload"]["card_id"]

    row = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", (card_id,))
    assert row is not None
    assert row["title"] == "DB Card"
    assert row["stack_id"] == "stack-1"
    assert row["size"] == "large"
    assert row["status"] == "active"
    blocks = json.loads(row["blocks"])
    assert blocks[0]["type"] == "text"


@pytest.mark.asyncio
async def test_create_card_no_db_still_works(canvas_tools, mock_send):
    """create_card works without workspace_db (backward compat)."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "No DB Card",
        "blocks": [{"type": "text", "content": "No persist"}],
    })

    assert "is_error" not in result
    sent_msg = json.loads(mock_send.call_args[0][0])
    assert "stack_id" not in sent_msg["payload"]


@pytest.mark.asyncio
async def test_update_card_persists_to_db(db_canvas_tools, mock_send, workspace_db):
    """update_card persists block changes to WorkspaceDB."""
    create_card = db_canvas_tools[0].handler
    update_card = db_canvas_tools[1].handler

    # Create first
    await create_card({
        "title": "Update Me",
        "blocks": [{"type": "text", "content": "Original"}],
    })
    sent_msg = json.loads(mock_send.call_args[0][0])
    card_id = sent_msg["payload"]["card_id"]

    # Update
    await update_card({
        "card_id": card_id,
        "blocks": [{"type": "stat", "value": "42", "label": "Count"}],
        "size": "full",
    })

    row = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", (card_id,))
    assert row["size"] == "full"
    blocks = json.loads(row["blocks"])
    assert blocks[0]["type"] == "stat"
    assert blocks[0]["value"] == "42"


@pytest.mark.asyncio
async def test_close_card_archives_not_deletes(db_canvas_tools, mock_send, workspace_db):
    """close_card archives the card (status='archived'), not delete."""
    create_card = db_canvas_tools[0].handler
    close_card = db_canvas_tools[2].handler

    await create_card({
        "title": "To Archive",
        "blocks": [{"type": "text", "content": "Bye"}],
    })
    sent_msg = json.loads(mock_send.call_args[0][0])
    card_id = sent_msg["payload"]["card_id"]

    await close_card({"card_id": card_id})

    row = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", (card_id,))
    assert row is not None, "Card should still exist (archived, not deleted)"
    assert row["status"] == "archived"
    assert row["archived_at"] is not None


@pytest.mark.asyncio
async def test_stack_id_from_closure(mock_send, workspace_db):
    """stack_id is resolved dynamically via stack_id_fn callable."""
    tools_a = create_canvas_tools(mock_send, workspace_db=workspace_db, stack_id_fn=lambda: "stack-a")
    await workspace_db.create_stack("stack-a", "Stack A")

    await tools_a[0].handler({
        "title": "Card A",
        "blocks": [{"type": "text", "content": "A"}],
    })

    sent_msg = json.loads(mock_send.call_args[0][0])
    assert sent_msg["payload"]["stack_id"] == "stack-a"

    row = await workspace_db.fetchone(
        "SELECT * FROM cards WHERE stack_id = ?", ("stack-a",)
    )
    assert row is not None


# -- Template field tests (m7b.4.17.2) ----------------------------------------


@pytest.mark.asyncio
async def test_create_card_with_card_type(db_canvas_tools, mock_send):
    """create_card accepts card_type and includes it in WS message."""
    create_card = db_canvas_tools[0].handler

    result = await create_card({
        "title": "Invoice Summary",
        "card_type": "document",
        "size": "medium",
        "blocks": [{"type": "text", "content": "Hello"}],
    })

    assert "is_error" not in result
    sent_msg = json.loads(mock_send.call_args[0][0])
    assert sent_msg["payload"]["card_type"] == "document"


@pytest.mark.asyncio
async def test_create_card_invalid_card_type(db_canvas_tools):
    """create_card rejects invalid card_type."""
    create_card = db_canvas_tools[0].handler

    result = await create_card({
        "title": "Bad Type",
        "card_type": "invoice",
        "blocks": [],
    })

    assert result["is_error"] is True
    assert "card_type must be one of" in result["content"][0]["text"]


@pytest.mark.asyncio
async def test_create_card_template_fields_in_ws_message(db_canvas_tools, mock_send):
    """Template fields (summary, color, tags) flow through to WS message."""
    create_card = db_canvas_tools[0].handler

    result = await create_card({
        "title": "Metrics Card",
        "card_type": "metric",
        "summary": "Revenue up 12%",
        "color": "emerald",
        "tags": ["finance", "q1"],
        "value": "$1.2M",
        "trend": "+12%",
        "trend_direction": "up",
        "blocks": [{"type": "stat", "value": "$1.2M", "label": "Revenue"}],
    })

    assert "is_error" not in result
    sent_msg = json.loads(mock_send.call_args[0][0])
    p = sent_msg["payload"]
    assert p["card_type"] == "metric"
    assert p["summary"] == "Revenue up 12%"
    assert p["color"] == "emerald"
    assert p["tags"] == ["finance", "q1"]
    assert p["value"] == "$1.2M"
    assert p["trend"] == "+12%"
    assert p["trend_direction"] == "up"


@pytest.mark.asyncio
async def test_create_card_template_fields_persisted_to_db(db_canvas_tools, mock_send, workspace_db):
    """Template fields persist to DB and JSON fields round-trip correctly."""
    create_card = db_canvas_tools[0].handler

    result = await create_card({
        "title": "Table Card",
        "card_type": "table",
        "summary": "Q1 Sales",
        "tags": ["q1", "sales"],
        "headers": ["Name", "Amount"],
        "preview_rows": [["Alice", "$100"], ["Bob", "$200"]],
        "color": "blue",
        "blocks": [{"type": "text", "content": "data"}],
    })

    assert "is_error" not in result
    sent_msg = json.loads(mock_send.call_args[0][0])
    card_id = sent_msg["payload"]["card_id"]

    row = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", (card_id,))
    assert row is not None
    assert row["card_type"] == "table"
    assert row["summary"] == "Q1 Sales"
    assert row["color"] == "blue"
    assert json.loads(row["tags"]) == ["q1", "sales"]
    assert json.loads(row["headers"]) == ["Name", "Amount"]
    assert json.loads(row["preview_rows"]) == [["Alice", "$100"], ["Bob", "$200"]]
