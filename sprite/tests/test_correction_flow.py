"""Tests for correction flow and Canvas state awareness (m7b.5.3)."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

from src.gateway import SpriteGateway
from src.database import WorkspaceDB, MemoryDB
from src.protocol import _new_id, _now_ms


def _make_mission(text: str, stack_id: str = "s1", canvas_state: list | None = None) -> str:
    """Build a raw mission message with optional canvas_state."""
    context = {"stack_id": stack_id}
    if canvas_state is not None:
        context["canvas_state"] = canvas_state
    return json.dumps({
        "id": _new_id(),
        "timestamp": _now_ms(),
        "type": "mission",
        "payload": {
            "text": text,
            "context": context,
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
async def memory_db(tmp_path):
    path = str(tmp_path / "memory.db")
    db = MemoryDB(db_path=path)
    await db.connect()
    yield db
    await db.close()


@pytest.fixture
def gateway(mock_send, workspace_db):
    runtime = MagicMock()
    runtime.handle_message = AsyncMock()
    runtime.set_active_stack_id = MagicMock()
    return SpriteGateway(send_fn=mock_send, runtime=runtime, workspace_db=workspace_db)


# -- Test: Mission message includes serialized Canvas state ------------------


@pytest.mark.asyncio
async def test_mission_with_canvas_state_passes_to_runtime(gateway, workspace_db):
    """Mission message with canvas_state extracts state and passes it to runtime."""
    canvas_state = [
        {
            "card_id": "card-1",
            "title": "Invoice #123",
            "blocks": [
                {"id": "b1", "type": "table", "columns": ["Vendor", "Amount"],
                 "rows": [{"Vendor": "Acme Inc", "Amount": "$100"}]},
            ],
        },
    ]
    msg = _make_mission("change vendor to Acme Corp", canvas_state=canvas_state)
    await gateway.route(msg)

    # Runtime should receive a message that includes canvas context
    gateway.runtime.handle_message.assert_called_once()
    call_text = gateway.runtime.handle_message.call_args[0][0]
    assert "card-1" in call_text
    assert "Invoice #123" in call_text
    assert "Acme Inc" in call_text


@pytest.mark.asyncio
async def test_mission_without_canvas_state_still_works(gateway):
    """Mission without canvas_state works normally (backward compat)."""
    msg = _make_mission("hello")
    await gateway.route(msg)

    gateway.runtime.handle_message.assert_called_once()
    call_text = gateway.runtime.handle_message.call_args[0][0]
    assert call_text == "hello"


# -- Test: Canvas state serialization includes card_id, title, blocks --------


@pytest.mark.asyncio
async def test_canvas_state_serialization_includes_required_fields(gateway):
    """Canvas state with card_id, title, and blocks is correctly formatted in context."""
    canvas_state = [
        {
            "card_id": "c1",
            "title": "Receipts Q4",
            "blocks": [
                {"id": "b1", "type": "key-value", "pairs": [{"label": "Total", "value": "$500"}]},
            ],
        },
        {
            "card_id": "c2",
            "title": "Summary",
            "blocks": [
                {"id": "b2", "type": "text", "content": "All receipts processed"},
            ],
        },
    ]
    msg = _make_mission("what cards are open?", canvas_state=canvas_state)
    await gateway.route(msg)

    call_text = gateway.runtime.handle_message.call_args[0][0]
    # All card_ids, titles, and block content should appear in the context
    assert "c1" in call_text
    assert "c2" in call_text
    assert "Receipts Q4" in call_text
    assert "Summary" in call_text
    assert "$500" in call_text


# -- Test: Correction via chat updates card via update_card ------------------


@pytest.mark.asyncio
async def test_correction_updates_card_via_update_card(mock_send, workspace_db):
    """Agent correction flow: update_card tool modifies table block in DB."""
    from src.tools.canvas import create_canvas_tools

    await workspace_db.create_stack("s1", "Stack")
    tools = create_canvas_tools(mock_send, workspace_db=workspace_db, stack_id_fn=lambda: "s1")

    # Create a card with extraction data
    await tools[0].handler({
        "title": "Invoice #123",
        "blocks": [
            {"type": "table", "columns": ["Vendor", "Amount"],
             "rows": [{"Vendor": "Acme Inc", "Amount": "$100"}]},
        ],
    })
    sent = json.loads(mock_send.call_args[0][0])
    card_id = sent["payload"]["card_id"]

    # Simulate correction: agent calls update_card with corrected data
    result = await tools[1].handler({
        "card_id": card_id,
        "blocks": [
            {"type": "table", "columns": ["Vendor", "Amount"],
             "rows": [{"Vendor": "Acme Corp", "Amount": "$100"}]},
        ],
    })

    assert "is_error" not in result

    # Verify DB has corrected data
    row = await workspace_db.fetchone("SELECT * FROM cards WHERE card_id = ?", (card_id,))
    blocks = json.loads(row["blocks"])
    assert blocks[0]["rows"][0]["Vendor"] == "Acme Corp"

    # Verify canvas_update message was sent to frontend
    update_msg = json.loads(mock_send.call_args[0][0])
    assert update_msg["type"] == "canvas_update"
    assert update_msg["payload"]["command"] == "update_card"
    assert update_msg["payload"]["card_id"] == card_id


# -- Test: soul.md updated after 3+ corrections on same field pattern --------


@pytest.mark.asyncio
async def test_soul_md_updated_after_correction_threshold(memory_db, tmp_path):
    """After 3+ CORRECTION learnings on same pattern, soul.md gets updated."""
    from src.memory import SOUL_MD
    from src.gateway import _check_correction_threshold

    # Create a temp soul.md
    soul_path = tmp_path / "soul.md"
    soul_path.write_text("# Stackdocs Agent\n\nYou are a personal assistant.\n")

    # Insert 3 CORRECTION learnings with the same pattern (vendor field)
    import time
    now = time.time()
    for i in range(3):
        await memory_db.execute(
            "INSERT INTO learnings (created_at, session_id, type, content, source_observation_id, confidence) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (now + i, None, "CORRECTION", "vendor field: always use 'Acme Corp' not 'Acme Inc'", None, 1.0),
        )

    await _check_correction_threshold(memory_db, soul_path)

    updated = soul_path.read_text()
    assert "Learned Rules" in updated
    assert "vendor" in updated.lower()


@pytest.mark.asyncio
async def test_soul_md_not_updated_below_threshold(memory_db, tmp_path):
    """With fewer than 3 corrections on same pattern, soul.md is NOT updated."""
    from src.gateway import _check_correction_threshold

    soul_path = tmp_path / "soul.md"
    soul_path.write_text("# Stackdocs Agent\n\nYou are a personal assistant.\n")

    # Only 2 corrections
    import time
    now = time.time()
    for i in range(2):
        await memory_db.execute(
            "INSERT INTO learnings (created_at, session_id, type, content, source_observation_id, confidence) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (now + i, None, "CORRECTION", "vendor field: use Acme Corp", None, 1.0),
        )

    await _check_correction_threshold(memory_db, soul_path)

    updated = soul_path.read_text()
    assert "Learned Rules" not in updated


# -- Test: format_canvas_context helper --------------------------------------


@pytest.mark.asyncio
async def test_format_canvas_context_empty():
    """Empty canvas state produces no context prefix."""
    from src.gateway import _format_canvas_context

    result = _format_canvas_context([])
    assert result == ""


@pytest.mark.asyncio
async def test_format_canvas_context_with_cards():
    """Canvas context formats card data readably for the agent."""
    from src.gateway import _format_canvas_context

    canvas_state = [
        {
            "card_id": "c1",
            "title": "Invoice",
            "blocks": [
                {"id": "b1", "type": "table", "columns": ["Field", "Value"],
                 "rows": [{"Field": "Vendor", "Value": "Acme"}]},
            ],
        },
    ]
    result = _format_canvas_context(canvas_state)
    assert "c1" in result
    assert "Invoice" in result
    assert "Vendor" in result
    assert "Acme" in result
