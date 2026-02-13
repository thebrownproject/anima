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
        # Default position/z_index since DB lacks those columns
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
