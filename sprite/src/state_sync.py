"""State sync -- send full workspace state to browser on new connections."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Callable, Awaitable

from .database import WorkspaceDB
from .protocol import (
    CardInfo,
    CardPosition,
    ChatMessageInfo,
    StackInfo,
    StateSyncMessage,
    StateSyncPayload,
    to_json,
)

logger = logging.getLogger(__name__)

SendFn = Callable[[str], Awaitable[None]]


async def build_state_sync_message(db: WorkspaceDB) -> StateSyncMessage:
    """Build a StateSyncMessage from current DB state.

    If no stacks exist, creates a default "My Stack" so the frontend
    always has at least one workspace to render.
    """
    stacks = await db.list_stacks()

    if not stacks:
        default_id = str(uuid.uuid4())
        await db.create_stack(stack_id=default_id, name="My Stack")
        stacks = await db.list_stacks()

    stack_infos = [
        StackInfo(id=s["id"], name=s["name"], color=s.get("color"))
        for s in stacks
    ]

    # Gather active cards across all active stacks
    cards: list[CardInfo] = []
    for s in stacks:
        rows = await db.get_cards_by_stack(s["id"])
        for r in rows:
            blocks = json.loads(r["blocks"]) if r["blocks"] else []
            cards.append(CardInfo(
                id=r["card_id"],
                stack_id=r["stack_id"],
                title=r["title"],
                blocks=blocks,
                size=r["size"] or "medium",
                position=CardPosition(x=0.0, y=0.0),
                z_index=0,
            ))

    # Last 50 chat messages, converting seconds->ms and int->str id
    chat_rows = await db.get_chat_history(limit=50)
    chat_history = [
        ChatMessageInfo(
            id=str(r["id"]),
            role=r["role"],
            content=r["content"],
            timestamp=int(r["timestamp"] * 1000),
        )
        for r in chat_rows
    ]

    return StateSyncMessage(
        type="state_sync",
        payload=StateSyncPayload(
            stacks=stack_infos,
            active_stack_id=stacks[0]["id"],
            cards=cards,
            chat_history=chat_history,
        ),
    )


async def send_state_sync(db: WorkspaceDB, send_fn: SendFn) -> None:
    """Build and send state_sync message over the connection."""
    msg = await build_state_sync_message(db)
    await send_fn(to_json(msg))
    logger.info("Sent state_sync: %d stacks, %d cards, %d messages",
                len(msg.payload.stacks), len(msg.payload.cards),
                len(msg.payload.chat_history))
