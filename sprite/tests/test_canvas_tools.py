"""Tests for canvas_tools.py — canvas card creation, update, and close tools."""

import json
import pytest
from unittest.mock import AsyncMock

from src.tools.canvas import create_canvas_tools
from src.protocol import parse_message


@pytest.fixture
def mock_send():
    """Mock WebSocket send function."""
    return AsyncMock()


@pytest.fixture
def canvas_tools(mock_send):
    """Canvas tools scoped with mock send function."""
    return create_canvas_tools(mock_send)


@pytest.mark.asyncio
async def test_create_card_valid(canvas_tools, mock_send):
    """create_card sends canvas_update with create_card command."""
    create_card = canvas_tools[0].handler

    # Valid heading + stat blocks
    result = await create_card({
        "title": "Test Card",
        "card_type": "table",
        "blocks": [
            {"type": "heading", "text": "Test Heading"},
            {"type": "stat", "value": "$100", "label": "Total"},
        ]
    })

    # Tool returns success
    assert "is_error" not in result
    assert "Card created" in result["content"][0]["text"]

    # WebSocket send called once
    assert mock_send.call_count == 1

    # Parse sent message
    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    # Verify message structure
    assert sent_msg["type"] == "canvas_update"
    assert sent_msg["payload"]["command"] == "create_card"
    assert sent_msg["payload"]["title"] == "Test Card"
    assert "card_id" in sent_msg["payload"]

    # Verify blocks
    blocks = sent_msg["payload"]["blocks"]
    assert len(blocks) == 2
    assert blocks[0]["type"] == "heading"
    assert blocks[0]["text"] == "Test Heading"
    assert blocks[1]["type"] == "stat"
    assert blocks[1]["value"] == "$100"

    # All blocks have IDs
    assert "id" in blocks[0]
    assert "id" in blocks[1]


@pytest.mark.asyncio
async def test_create_card_auto_block_ids(canvas_tools, mock_send):
    """create_card auto-generates block IDs if missing."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "Test",
        "card_type": "notes",
        "blocks": [
            {"type": "text", "content": "Hello world"}
        ]
    })

    assert "is_error" not in result
    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    # Block should have auto-generated ID
    assert "id" in sent_msg["payload"]["blocks"][0]
    assert len(sent_msg["payload"]["blocks"][0]["id"]) == 36  # UUID length


@pytest.mark.asyncio
async def test_create_card_missing_title(canvas_tools):
    """create_card returns error if title is missing."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "",
        "card_type": "table",
        "blocks": []
    })

    assert result["is_error"] is True
    assert "title is required" in result["content"][0]["text"]


@pytest.mark.asyncio
async def test_create_card_invalid_card_type(canvas_tools):
    """create_card returns error for invalid card_type."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "Test",
        "card_type": "invalid",
        "blocks": []
    })

    assert result["is_error"] is True
    assert "card_type must be one of" in result["content"][0]["text"]


@pytest.mark.asyncio
async def test_create_card_invalid_block_type(canvas_tools):
    """create_card returns error for invalid block type."""
    create_card = canvas_tools[0].handler

    result = await create_card({
        "title": "Test",
        "card_type": "table",
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
        "card_type": "table",
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
        "card_type": "document",
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
    # close_card doesn't send blocks
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

    # Blocks passed as JSON string instead of list
    blocks_json = json.dumps([
        {"type": "text", "content": "Hello"}
    ])

    result = await create_card({
        "title": "Test",
        "card_type": "notes",
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
        "card_type": "table",
        "blocks": [{"type": "separator"}]
    })

    sent_json = mock_send.call_args[0][0]
    parsed = parse_message(sent_json)

    # parse_message validates against protocol schema
    assert parsed is not None
    assert parsed["type"] == "canvas_update"
