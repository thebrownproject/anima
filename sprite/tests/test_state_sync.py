"""Tests for sprite state_sync — workspace state sent on new connections."""

import json
import uuid

import pytest

from src.database import WorkspaceDB
from src.protocol import is_state_sync, to_dict
from src.state_sync import build_state_sync_message, send_state_sync


@pytest.fixture
async def workspace_db(tmp_path):
    path = str(tmp_path / "workspace.db")
    db = WorkspaceDB(db_path=path)
    await db.connect()
    yield db
    await db.close()


async def _seed_stacks(db: WorkspaceDB, count: int = 2) -> list[dict]:
    """Create N stacks and return them."""
    stacks = []
    for i in range(count):
        s = await db.create_stack(
            stack_id=str(uuid.uuid4()),
            name=f"Stack {i}",
            color=f"#{i:06x}",
            sort_order=i,
        )
        stacks.append(s)
    return stacks


async def _seed_cards(db: WorkspaceDB, stack_id: str, count: int = 3) -> list[dict]:
    """Create N cards on a stack."""
    cards = []
    for i in range(count):
        c = await db.upsert_card(
            card_id=str(uuid.uuid4()),
            stack_id=stack_id,
            title=f"Card {i}",
            blocks=[{"id": str(uuid.uuid4()), "type": "text", "content": f"block {i}"}],
            size="medium",
        )
        cards.append(c)
    return cards


async def _seed_chat(db: WorkspaceDB, count: int = 5) -> list[dict]:
    """Insert N chat messages."""
    msgs = []
    for i in range(count):
        m = await db.add_chat_message(
            role="user" if i % 2 == 0 else "assistant",
            content=f"Message {i}",
        )
        msgs.append(m)
    return msgs


# -- Test: state_sync contains all active stacks from DB --

async def test_state_sync_contains_all_active_stacks(workspace_db):
    stacks = await _seed_stacks(workspace_db, count=3)

    msg = await build_state_sync_message(workspace_db)

    assert len(msg.payload.stacks) == 3
    stack_ids = {s.id for s in msg.payload.stacks}
    for s in stacks:
        assert s["id"] in stack_ids


async def test_state_sync_excludes_archived_stacks(workspace_db):
    stacks = await _seed_stacks(workspace_db, count=2)
    await workspace_db.archive_stack(stacks[1]["id"])

    msg = await build_state_sync_message(workspace_db)

    assert len(msg.payload.stacks) == 1
    assert msg.payload.stacks[0].id == stacks[0]["id"]


# -- Test: state_sync contains all active cards grouped by stack_id --

async def test_state_sync_contains_cards_grouped_by_stack(workspace_db):
    stacks = await _seed_stacks(workspace_db, count=2)
    cards_s0 = await _seed_cards(workspace_db, stacks[0]["id"], count=2)
    cards_s1 = await _seed_cards(workspace_db, stacks[1]["id"], count=3)

    msg = await build_state_sync_message(workspace_db)

    assert len(msg.payload.cards) == 5
    for c in msg.payload.cards:
        assert c.stack_id in {stacks[0]["id"], stacks[1]["id"]}
        # Cards seeded without position params default to 0,0,0
        assert c.position.x == 0.0
        assert c.position.y == 0.0
        assert c.z_index == 0


async def test_state_sync_excludes_archived_cards(workspace_db):
    stacks = await _seed_stacks(workspace_db, count=1)
    cards = await _seed_cards(workspace_db, stacks[0]["id"], count=3)
    await workspace_db.archive_card(cards[0]["card_id"])

    msg = await build_state_sync_message(workspace_db)

    assert len(msg.payload.cards) == 2


# -- Test: state_sync contains up to 50 recent chat messages --

async def test_state_sync_contains_chat_messages(workspace_db):
    await _seed_stacks(workspace_db, count=1)
    await _seed_chat(workspace_db, count=5)

    msg = await build_state_sync_message(workspace_db)

    assert len(msg.payload.chat_history) == 5
    for m in msg.payload.chat_history:
        assert isinstance(m.id, str)
        assert isinstance(m.timestamp, int)
        assert m.timestamp > 1_000_000_000_000  # milliseconds


async def test_state_sync_limits_chat_to_50(workspace_db):
    await _seed_stacks(workspace_db, count=1)
    await _seed_chat(workspace_db, count=60)

    msg = await build_state_sync_message(workspace_db)

    assert len(msg.payload.chat_history) == 50


# -- Test: empty DB creates default stack and sends it --

async def test_empty_db_creates_default_stack(workspace_db):
    msg = await build_state_sync_message(workspace_db)

    assert len(msg.payload.stacks) == 1
    assert msg.payload.stacks[0].name == "My Stack"
    assert msg.payload.active_stack_id == msg.payload.stacks[0].id

    # Verify it was persisted
    stacks = await workspace_db.list_stacks()
    assert len(stacks) == 1
    assert stacks[0]["name"] == "My Stack"


# -- Test: active_stack_id defaults to first stack --

async def test_active_stack_id_is_first_stack(workspace_db):
    stacks = await _seed_stacks(workspace_db, count=3)

    msg = await build_state_sync_message(workspace_db)

    assert msg.payload.active_stack_id == stacks[0]["id"]


# -- Test: message validates against is_state_sync type guard --

async def test_message_validates_against_type_guard(workspace_db):
    msg = await build_state_sync_message(workspace_db)
    serialized = to_dict(msg)

    assert is_state_sync(serialized)


# -- Test: send_state_sync calls send_fn with valid JSON --

async def test_send_state_sync_sends_valid_json(workspace_db):
    sent = []

    async def mock_send(data: str) -> None:
        sent.append(data)

    await send_state_sync(workspace_db, mock_send)

    assert len(sent) == 1
    parsed = json.loads(sent[0])
    assert is_state_sync(parsed)
    assert parsed["type"] == "state_sync"


# -- Test: state_sync returns real positions from DB --

async def test_state_sync_returns_real_positions(workspace_db):
    """Cards with stored positions should appear in state_sync with those values."""
    stacks = await _seed_stacks(workspace_db, count=1)
    sid = stacks[0]["id"]

    await workspace_db.upsert_card(
        card_id="pos-card",
        stack_id=sid,
        title="Positioned",
        blocks=[],
        position_x=150.5,
        position_y=300.0,
        z_index=7,
    )

    msg = await build_state_sync_message(workspace_db)

    card = next(c for c in msg.payload.cards if c.id == "pos-card")
    assert card.position.x == 150.5
    assert card.position.y == 300.0
    assert card.z_index == 7


async def test_state_sync_defaults_position_for_cards_without_position(workspace_db):
    """Cards created without explicit position should default to (0, 0, 0)."""
    stacks = await _seed_stacks(workspace_db, count=1)
    cards = await _seed_cards(workspace_db, stacks[0]["id"], count=1)

    msg = await build_state_sync_message(workspace_db)

    card = msg.payload.cards[0]
    assert card.position.x == 0.0
    assert card.position.y == 0.0
    assert card.z_index == 0


# -- Test: round-trip position persistence --

async def test_round_trip_upsert_position_then_state_sync(workspace_db):
    """Upsert a card with position, then verify state_sync returns the same values."""
    stacks = await _seed_stacks(workspace_db, count=1)
    sid = stacks[0]["id"]

    await workspace_db.upsert_card(
        card_id="rt-card",
        stack_id=sid,
        title="Round Trip",
        blocks=[{"id": "b1", "type": "text", "content": "hello"}],
        position_x=42.0,
        position_y=99.9,
        z_index=3,
    )

    msg = await build_state_sync_message(workspace_db)

    card = next(c for c in msg.payload.cards if c.id == "rt-card")
    assert card.position.x == 42.0
    assert card.position.y == 99.9
    assert card.z_index == 3


# -- Template field tests (m7b.4.17.2) ----------------------------------------


async def test_state_sync_includes_card_type(workspace_db):
    """state_sync CardInfo includes card_type when present in DB."""
    stacks = await _seed_stacks(workspace_db, count=1)
    sid = stacks[0]["id"]

    await workspace_db.upsert_card(
        card_id="typed-card",
        stack_id=sid,
        title="Doc Card",
        blocks=[],
        card_type="document",
        summary="A document summary",
    )

    msg = await build_state_sync_message(workspace_db)
    card = next(c for c in msg.payload.cards if c.id == "typed-card")
    assert card.card_type == "document"
    assert card.summary == "A document summary"


async def test_state_sync_includes_json_template_fields(workspace_db):
    """state_sync deserializes JSON columns (tags, headers, preview_rows) into lists."""
    stacks = await _seed_stacks(workspace_db, count=1)
    sid = stacks[0]["id"]

    await workspace_db.upsert_card(
        card_id="json-card",
        stack_id=sid,
        title="Table Card",
        blocks=[],
        card_type="table",
        tags=["a", "b"],
        headers=["Col1", "Col2"],
        preview_rows=[["x", "y"], ["1", "2"]],
    )

    msg = await build_state_sync_message(workspace_db)
    card = next(c for c in msg.payload.cards if c.id == "json-card")
    assert card.tags == ["a", "b"]
    assert card.headers == ["Col1", "Col2"]
    assert card.preview_rows == [["x", "y"], ["1", "2"]]


async def test_state_sync_template_fields_none_when_absent(workspace_db):
    """Cards without template fields have None values in CardInfo (not empty strings)."""
    stacks = await _seed_stacks(workspace_db, count=1)
    cards = await _seed_cards(workspace_db, stacks[0]["id"], count=1)

    msg = await build_state_sync_message(workspace_db)
    card = msg.payload.cards[0]
    assert card.card_type is None
    assert card.summary is None
    assert card.tags is None
    assert card.headers is None
    assert card.preview_rows is None
