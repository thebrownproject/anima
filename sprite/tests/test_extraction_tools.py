"""Tests for extraction tools -- extract_invoice tool creates table cards from invoice data."""

import json
import pytest
from unittest.mock import AsyncMock

from src.tools.extraction import create_extraction_tools
from src.protocol import parse_message
from src.database import WorkspaceDB


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
def extraction_tools(mock_send, workspace_db):
    return create_extraction_tools(mock_send, workspace_db=workspace_db, stack_id_fn=lambda: "stack-1")


@pytest.fixture
def extract_invoice(extraction_tools):
    return extraction_tools[0].handler


# -- Validation tests --


@pytest.mark.asyncio
async def test_extract_invoice_validates_file_path(extract_invoice):
    """extract_invoice returns error when file_path is missing."""
    result = await extract_invoice({
        "vendor": "Acme Corp",
    })
    assert result["is_error"] is True
    assert "file_path" in result["content"][0]["text"].lower()


@pytest.mark.asyncio
async def test_extract_invoice_validates_vendor(extract_invoice):
    """extract_invoice returns error when vendor is missing."""
    result = await extract_invoice({
        "file_path": "/workspace/uploads/test.pdf",
    })
    assert result["is_error"] is True
    assert "vendor" in result["content"][0]["text"].lower()


@pytest.mark.asyncio
async def test_extract_invoice_empty_inputs(extract_invoice):
    """extract_invoice returns error (not crash) for empty inputs."""
    result = await extract_invoice({
        "file_path": "",
        "vendor": "",
    })
    assert result["is_error"] is True


# -- Card creation tests --


@pytest.mark.asyncio
async def test_extract_invoice_creates_table_card(extract_invoice, mock_send):
    """extract_invoice creates a table card with correct columns."""
    result = await extract_invoice({
        "file_path": "/workspace/uploads/invoice.pdf",
        "vendor": "Acme Corp",
        "date": "2026-02-21",
        "line_items": [
            {"description": "Widget A", "quantity": 2, "unit_price": 10.00, "total": 20.00},
            {"description": "Widget B", "quantity": 1, "unit_price": 15.00, "total": 15.00},
        ],
        "subtotal": 35.00,
        "tax": 3.50,
        "grand_total": 38.50,
    })

    assert "is_error" not in result
    assert "Card created" in result["content"][0]["text"]

    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    assert sent_msg["type"] == "canvas_update"
    assert sent_msg["payload"]["command"] == "create_card"
    assert sent_msg["payload"]["card_type"] == "table"

    blocks = sent_msg["payload"]["blocks"]
    block_types = [b["type"] for b in blocks]
    assert "heading" in block_types
    assert "key-value" in block_types
    assert "table" in block_types

    # Verify table block has correct columns
    table_block = next(b for b in blocks if b["type"] == "table")
    assert "Description" in table_block["columns"]
    assert "Quantity" in table_block["columns"]
    assert "Unit Price" in table_block["columns"]
    assert "Total" in table_block["columns"]
    assert len(table_block["rows"]) == 2


@pytest.mark.asyncio
async def test_extract_invoice_sets_blocks_and_preview_rows(extract_invoice, mock_send):
    """CRITICAL: extract_invoice sets BOTH blocks AND headers/preview_rows on payload."""
    result = await extract_invoice({
        "file_path": "/workspace/uploads/invoice.pdf",
        "vendor": "Test Co",
        "line_items": [
            {"description": "Item 1", "quantity": 1, "unit_price": 100.00, "total": 100.00},
        ],
        "subtotal": 100.00,
        "tax": 10.00,
        "grand_total": 110.00,
    })

    assert "is_error" not in result

    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)
    payload = sent_msg["payload"]

    # Must have blocks
    assert payload.get("blocks") is not None
    assert len(payload["blocks"]) > 0

    # Must also have headers and preview_rows for table card rendering
    assert payload.get("headers") is not None
    assert payload.get("preview_rows") is not None
    assert len(payload["headers"]) == 4  # Description, Quantity, Unit Price, Total
    assert len(payload["preview_rows"]) >= 1


@pytest.mark.asyncio
async def test_extract_invoice_persists_to_db(extract_invoice, mock_send, workspace_db):
    """extract_invoice persists card to workspace.db."""
    result = await extract_invoice({
        "file_path": "/workspace/uploads/invoice.pdf",
        "vendor": "Persist Co",
        "date": "2026-01-15",
        "line_items": [
            {"description": "Service", "quantity": 1, "unit_price": 500.00, "total": 500.00},
        ],
        "subtotal": 500.00,
        "tax": 50.00,
        "grand_total": 550.00,
    })

    assert "is_error" not in result

    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)
    card_id = sent_msg["payload"]["card_id"]

    row = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", (card_id,))
    assert row is not None
    assert row["stack_id"] == "stack-1"
    assert row["card_type"] == "table"
    assert "Persist Co" in row["title"]
    assert row["headers"] is not None
    assert row["preview_rows"] is not None

    blocks = json.loads(row["blocks"])
    assert len(blocks) > 0


@pytest.mark.asyncio
async def test_extract_invoice_handles_line_items_as_json_string(extract_invoice, mock_send):
    """extract_invoice handles line_items arriving as a JSON string (Claude quirk)."""
    line_items = json.dumps([
        {"description": "Gadget", "quantity": 3, "unit_price": 25.00, "total": 75.00},
    ])

    result = await extract_invoice({
        "file_path": "/workspace/uploads/invoice.pdf",
        "vendor": "JSON String Co",
        "line_items": line_items,  # String, not list
        "subtotal": 75.00,
        "tax": 7.50,
        "grand_total": 82.50,
    })

    assert "is_error" not in result

    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)

    table_block = next(b for b in sent_msg["payload"]["blocks"] if b["type"] == "table")
    assert len(table_block["rows"]) == 1
    assert table_block["rows"][0]["Description"] == "Gadget"


@pytest.mark.asyncio
async def test_extract_invoice_returns_error_for_empty_line_items(extract_invoice):
    """extract_invoice returns error when no line items provided."""
    result = await extract_invoice({
        "file_path": "/workspace/uploads/invoice.pdf",
        "vendor": "Empty Co",
        "line_items": [],
    })
    assert result["is_error"] is True


@pytest.mark.asyncio
async def test_extract_invoice_minimal_inputs(extract_invoice, mock_send):
    """extract_invoice works with only required fields (file_path, vendor, line_items)."""
    result = await extract_invoice({
        "file_path": "/workspace/uploads/invoice.pdf",
        "vendor": "Minimal Co",
        "line_items": [
            {"description": "Item", "quantity": 1, "unit_price": 10.00, "total": 10.00},
        ],
    })

    assert "is_error" not in result
    sent_json = mock_send.call_args[0][0]
    sent_msg = json.loads(sent_json)
    assert sent_msg["payload"]["command"] == "create_card"


@pytest.mark.asyncio
async def test_extract_invoice_protocol_parseable(extract_invoice, mock_send):
    """Sent messages match protocol schema and are parseable."""
    await extract_invoice({
        "file_path": "/workspace/uploads/invoice.pdf",
        "vendor": "Protocol Co",
        "line_items": [
            {"description": "Test", "quantity": 1, "unit_price": 5.00, "total": 5.00},
        ],
    })

    sent_json = mock_send.call_args[0][0]
    parsed = parse_message(sent_json)
    assert parsed is not None
    assert parsed["type"] == "canvas_update"


@pytest.mark.asyncio
async def test_tool_registration_count(extraction_tools):
    """Verify extract_invoice tool is registered."""
    assert len(extraction_tools) == 1
    assert extraction_tools[0].name == "extract_invoice"
