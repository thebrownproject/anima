"""Tests for extraction persistence across reconnection.

Verifies the full round-trip: extract_invoice -> DB -> build_state_sync_message
-> serialized JSON contains correct card with blocks/headers/preview_rows.
"""

import json

import pytest
from unittest.mock import AsyncMock

from src.database import WorkspaceDB
from src.protocol import to_dict, to_json, is_state_sync
from src.state_sync import build_state_sync_message, send_state_sync
from src.tools.extraction import create_extraction_tools


INVOICE_ARGS = {
    "file_path": "/workspace/uploads/invoice.pdf",
    "vendor": "Acme Corp",
    "date": "2026-02-21",
    "invoice_number": "INV-001",
    "line_items": [
        {"description": "Widget A", "quantity": 2, "unit_price": 10.00, "total": 20.00},
        {"description": "Widget B", "quantity": 1, "unit_price": 15.00, "total": 15.00},
    ],
    "subtotal": 35.00,
    "tax": 3.50,
    "grand_total": 38.50,
}


@pytest.fixture
def mock_send():
    return AsyncMock()


@pytest.fixture
async def workspace_db(tmp_path):
    path = str(tmp_path / "workspace.db")
    db = WorkspaceDB(db_path=path)
    await db.connect()
    await db.create_stack("stack-1", "Test Stack")
    yield db
    await db.close()


@pytest.fixture
def extract_invoice(mock_send, workspace_db):
    tools = create_extraction_tools(mock_send, workspace_db=workspace_db, stack_id_fn=lambda: "stack-1")
    return tools[0].handler


# -- Test 1: card reappears after disconnect/reconnect with same data --


async def test_extraction_survives_reconnect(extract_invoice, mock_send, workspace_db):
    """After extraction, disconnect and reconnect -- card reappears with same data."""
    result = await extract_invoice(INVOICE_ARGS)
    assert "is_error" not in result

    # Capture the card_id from the WS message sent during extraction
    sent_json = mock_send.call_args[0][0]
    original_msg = json.loads(sent_json)
    card_id = original_msg["payload"]["card_id"]
    original_blocks = original_msg["payload"]["blocks"]
    original_headers = original_msg["payload"]["headers"]
    original_preview_rows = original_msg["payload"]["preview_rows"]

    # Simulate reconnect: build state_sync from DB (what happens on new TCP connection)
    msg = await build_state_sync_message(workspace_db)
    card = next((c for c in msg.payload.cards if c.id == card_id), None)

    assert card is not None, f"Card {card_id} missing from state_sync after reconnect"
    assert card.title == "Invoice - Acme Corp"
    assert card.card_type == "table"
    assert card.size == "large"

    # Blocks survive round-trip (stored without id fields in DB)
    assert len(card.blocks) == len(original_blocks)
    for db_block, orig_block in zip(card.blocks, original_blocks):
        assert db_block["type"] == orig_block["type"]

    # Headers and preview_rows survive
    assert card.headers == original_headers
    assert card.preview_rows == original_preview_rows

    # Tags survive
    assert card.tags == ["invoice", "acme corp"]

    # Summary survives
    assert "2 line items" in card.summary


# -- Test 2: state_sync includes extraction card with blocks --


async def test_state_sync_contains_extraction_blocks(extract_invoice, mock_send, workspace_db):
    """state_sync includes extraction card with all block types."""
    await extract_invoice(INVOICE_ARGS)

    msg = await build_state_sync_message(workspace_db)

    assert len(msg.payload.cards) == 1
    card = msg.payload.cards[0]

    block_types = [b["type"] for b in card.blocks]
    assert "heading" in block_types
    assert "key-value" in block_types
    assert "table" in block_types
    assert "badge" in block_types

    # Verify table block structure preserved
    table_block = next(b for b in card.blocks if b["type"] == "table")
    assert table_block["columns"] == ["Description", "Quantity", "Unit Price", "Total"]
    assert len(table_block["rows"]) == 2
    assert table_block["rows"][0]["Description"] == "Widget A"

    # Verify key-value block structure preserved
    kv_block = next(b for b in card.blocks if b["type"] == "key-value")
    labels = [p["label"] for p in kv_block["pairs"]]
    assert "Vendor" in labels
    assert "Date" in labels
    assert "Grand Total" in labels

    # Verify heading block
    heading = next(b for b in card.blocks if b["type"] == "heading")
    assert heading["text"] == "Invoice: Acme Corp"
    assert heading["subtitle"] == "2026-02-21"


# -- Test 3: serialized state_sync has correct field names for frontend --


async def test_state_sync_json_has_frontend_field_names(extract_invoice, mock_send, workspace_db):
    """Frontend correctly maps snake_case to camelCase -- verify serialized JSON uses snake_case."""
    await extract_invoice(INVOICE_ARGS)

    msg = await build_state_sync_message(workspace_db)
    serialized = to_dict(msg)

    assert is_state_sync(serialized)

    card_dict = serialized["payload"]["cards"][0]

    # These snake_case fields must be present for mapCardFields to work:
    # stack_id -> stackId, card_type -> cardType, preview_rows -> previewRows
    assert "stack_id" in card_dict
    assert card_dict["stack_id"] == "stack-1"

    assert "card_type" in card_dict
    assert card_dict["card_type"] == "table"

    assert "preview_rows" in card_dict
    assert isinstance(card_dict["preview_rows"], list)
    assert len(card_dict["preview_rows"]) == 2

    assert "headers" in card_dict
    assert card_dict["headers"] == ["Description", "Quantity", "Unit Price", "Total"]

    assert "tags" in card_dict
    assert card_dict["tags"] == ["invoice", "acme corp"]

    assert "z_index" in card_dict

    # Blocks pass through unchanged (no case mapping needed)
    assert "blocks" in card_dict
    assert len(card_dict["blocks"]) == 4


async def test_state_sync_json_round_trips_through_json(extract_invoice, mock_send, workspace_db):
    """Full JSON serialization round-trip: to_json -> parse -> verify structure."""
    await extract_invoice(INVOICE_ARGS)

    msg = await build_state_sync_message(workspace_db)
    json_str = to_json(msg)
    parsed = json.loads(json_str)

    assert parsed["type"] == "state_sync"
    assert len(parsed["payload"]["cards"]) == 1

    card = parsed["payload"]["cards"][0]
    assert card["title"] == "Invoice - Acme Corp"
    assert card["card_type"] == "table"

    # Table data survives full JSON round-trip
    table_block = next(b for b in card["blocks"] if b["type"] == "table")
    assert table_block["rows"][1]["Description"] == "Widget B"
    assert table_block["rows"][1]["Total"] == "$15.00"

    # Preview rows match line items
    assert card["preview_rows"][0][0] == "Widget A"
    assert card["preview_rows"][1][0] == "Widget B"


async def test_send_state_sync_delivers_extraction_card(extract_invoice, mock_send, workspace_db):
    """send_state_sync (used on reconnect) delivers extraction card over the wire."""
    await extract_invoice(INVOICE_ARGS)

    sent = []

    async def capture_send(data: str) -> None:
        sent.append(data)

    await send_state_sync(workspace_db, capture_send)

    assert len(sent) == 1
    parsed = json.loads(sent[0])
    assert parsed["type"] == "state_sync"

    card = parsed["payload"]["cards"][0]
    assert card["title"] == "Invoice - Acme Corp"
    assert len(card["blocks"]) == 4
    assert card["headers"] == ["Description", "Quantity", "Unit Price", "Total"]
