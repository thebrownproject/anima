"""Tests for welcome message on first connection."""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.gateway import SpriteGateway
from src.database import WorkspaceDB


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
    runtime = MagicMock()
    runtime.handle_message = AsyncMock()
    return SpriteGateway(
        send_fn=mock_send, runtime=runtime, workspace_db=workspace_db,
    )


@pytest.mark.asyncio
async def test_new_user_receives_welcome(gateway, workspace_db):
    """New user (empty chat history) triggers welcome via runtime.handle_message."""
    await gateway.check_and_send_welcome()
    # Let the background task complete
    if gateway._tasks:
        await asyncio.gather(*gateway._tasks, return_exceptions=True)

    gateway.runtime.handle_message.assert_called_once()
    prompt = gateway.runtime.handle_message.call_args[0][0]
    assert "welcome" in prompt.lower() or "anima" in prompt.lower()


@pytest.mark.asyncio
async def test_existing_user_no_welcome(gateway, workspace_db):
    """Existing user (non-empty chat history) does NOT receive welcome."""
    await workspace_db.add_chat_message("user", "hello")

    await gateway.check_and_send_welcome()
    if gateway._tasks:
        await asyncio.gather(*gateway._tasks, return_exceptions=True)

    gateway.runtime.handle_message.assert_not_called()


@pytest.mark.asyncio
async def test_welcome_appears_as_normal_agent_message(gateway, workspace_db):
    """Welcome uses runtime.handle_message -- same path as regular missions.

    This means the agent streams agent_event messages back, which the
    frontend renders as normal chat text. No special message type needed.
    """
    await gateway.check_and_send_welcome()
    if gateway._tasks:
        await asyncio.gather(*gateway._tasks, return_exceptions=True)

    # handle_message is the same entry point missions use
    gateway.runtime.handle_message.assert_called_once()
    # No request_id -- welcome is server-initiated, not a response to a user message
    call_kwargs = gateway.runtime.handle_message.call_args
    assert call_kwargs[1].get("request_id") is None or "request_id" not in call_kwargs[1]


@pytest.mark.asyncio
async def test_welcome_acquires_mission_lock(gateway, workspace_db):
    """Welcome holds mission_lock during runtime call to prevent race with user messages."""
    lock_was_held = False

    async def check_lock(*args, **kwargs):
        nonlocal lock_was_held
        lock_was_held = gateway.mission_lock.locked()

    gateway.runtime.handle_message = AsyncMock(side_effect=check_lock)

    await gateway.check_and_send_welcome()
    if gateway._tasks:
        await asyncio.gather(*gateway._tasks, return_exceptions=True)

    assert lock_was_held, "mission_lock should be held during welcome"


@pytest.mark.asyncio
async def test_welcome_does_not_block_caller(gateway, workspace_db):
    """check_and_send_welcome returns immediately (background task)."""
    hold = asyncio.Event()

    async def slow_handler(*args, **kwargs):
        await hold.wait()

    gateway.runtime.handle_message = AsyncMock(side_effect=slow_handler)

    # Should return immediately, not block
    await gateway.check_and_send_welcome()
    assert len(gateway._tasks) == 1

    # Clean up
    hold.set()
    await asyncio.gather(*gateway._tasks, return_exceptions=True)


@pytest.mark.asyncio
async def test_welcome_no_crash_without_runtime(mock_send, workspace_db):
    """Gateway without runtime skips welcome silently."""
    gw = SpriteGateway(send_fn=mock_send, runtime=MagicMock(), workspace_db=workspace_db)
    gw.runtime = None  # Simulate runtime not yet initialized
    await gw.check_and_send_welcome()
    assert len(gw._tasks) == 0


@pytest.mark.asyncio
async def test_welcome_no_crash_without_db(mock_send):
    """Gateway without workspace_db skips welcome silently."""
    gw = SpriteGateway(send_fn=mock_send, runtime=MagicMock())
    await gw.check_and_send_welcome()
    assert len(gw._tasks) == 0
