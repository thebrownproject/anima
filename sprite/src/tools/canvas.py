"""Canvas tools for agent — create/update/close cards via WebSocket messages."""

from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable

from claude_agent_sdk import tool

from ..protocol import (
    CanvasUpdate,
    CanvasUpdatePayload,
    HeadingBlock,
    StatBlock,
    KeyValueBlock,
    KeyValuePair,
    TableBlock,
    BadgeBlock,
    ProgressBlock,
    TextBlock,
    SeparatorBlock,
    _new_id,
    to_json,
)

logger = logging.getLogger(__name__)

SendFn = Callable[[str], Awaitable[None]]

VALID_CARD_TYPES = {"table", "document", "notes"}
VALID_BLOCK_TYPES = {
    "heading",
    "stat",
    "key-value",
    "table",
    "badge",
    "progress",
    "text",
    "separator",
}


def _parse_json_param(value: Any) -> Any:
    """Parse JSON if value is a stringified JSON object/array."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            pass
    return value


def _ensure_block_id(block: dict[str, Any]) -> None:
    """Add UUID to block if missing."""
    if "id" not in block or not block["id"]:
        block["id"] = _new_id()


def _validate_block(block: dict[str, Any]) -> tuple[bool, str]:
    """Validate a block has required fields. Returns (is_valid, error_msg)."""
    if not isinstance(block, dict):
        return False, "Block must be a dict"

    block_type = block.get("type")
    if block_type not in VALID_BLOCK_TYPES:
        return False, f"Invalid block type: {block_type}"

    _ensure_block_id(block)

    # Type-specific validation
    if block_type == "heading":
        if "text" not in block:
            return False, "HeadingBlock requires 'text' field"

    elif block_type == "stat":
        if "value" not in block or "label" not in block:
            return False, "StatBlock requires 'value' and 'label' fields"

    elif block_type == "key-value":
        pairs = block.get("pairs")
        if not isinstance(pairs, list):
            return False, "KeyValueBlock requires 'pairs' list"
        for pair in pairs:
            if not isinstance(pair, dict) or "label" not in pair or "value" not in pair:
                return False, "KeyValueBlock pairs must have 'label' and 'value'"

    elif block_type == "table":
        if "columns" not in block or "rows" not in block:
            return False, "TableBlock requires 'columns' and 'rows' fields"

    elif block_type == "badge":
        if "text" not in block or "variant" not in block:
            return False, "BadgeBlock requires 'text' and 'variant' fields"

    elif block_type == "progress":
        if "value" not in block:
            return False, "ProgressBlock requires 'value' field"

    elif block_type == "text":
        if "content" not in block:
            return False, "TextBlock requires 'content' field"

    return True, ""


def _build_block_dataclass(block_dict: dict[str, Any]) -> Any:
    """Convert validated dict to protocol dataclass."""
    block_type = block_dict["type"]
    block_id = block_dict["id"]

    if block_type == "heading":
        return HeadingBlock(
            id=block_id,
            type="heading",
            text=block_dict["text"],
            subtitle=block_dict.get("subtitle"),
        )

    elif block_type == "stat":
        return StatBlock(
            id=block_id,
            type="stat",
            value=block_dict["value"],
            label=block_dict["label"],
            trend=block_dict.get("trend"),
        )

    elif block_type == "key-value":
        pairs = [
            KeyValuePair(label=p["label"], value=p["value"])
            for p in block_dict["pairs"]
        ]
        return KeyValueBlock(id=block_id, type="key-value", pairs=pairs)

    elif block_type == "table":
        return TableBlock(
            id=block_id,
            type="table",
            columns=block_dict["columns"],
            rows=block_dict["rows"],
        )

    elif block_type == "badge":
        return BadgeBlock(
            id=block_id,
            type="badge",
            text=block_dict["text"],
            variant=block_dict["variant"],
        )

    elif block_type == "progress":
        return ProgressBlock(
            id=block_id,
            type="progress",
            value=block_dict["value"],
            label=block_dict.get("label"),
        )

    elif block_type == "text":
        return TextBlock(
            id=block_id,
            type="text",
            content=block_dict["content"],
        )

    elif block_type == "separator":
        return SeparatorBlock(id=block_id, type="separator")

    raise ValueError(f"Unknown block type: {block_type}")


def create_canvas_tools(send_fn: SendFn) -> list:
    """Create canvas tools scoped with WebSocket send function."""

    @tool(
        "create_card",
        "Create a new card on the user's Canvas with composable blocks.\n\n"
        "Parameters:\n"
        "- title (str): Card title displayed in the title bar.\n"
        "- card_type (str): One of 'table', 'document', or 'notes'.\n"
        "- blocks (list[dict]): Array of block objects. Each block needs a 'type' field "
        "(do NOT include 'id' — it is auto-generated). Valid block types:\n"
        "  - heading: {type: 'heading', text: str, subtitle?: str}\n"
        "  - stat: {type: 'stat', value: str, label: str, trend?: str}\n"
        "  - key-value: {type: 'key-value', pairs: [{label: str, value: str}]}\n"
        "  - table: {type: 'table', columns: [str], rows: [{col_name: value}]}\n"
        "  - badge: {type: 'badge', text: str, variant: 'default'|'success'|'warning'|'destructive'}\n"
        "  - progress: {type: 'progress', value: int (0-100), label?: str}\n"
        "  - text: {type: 'text', content: str}  NOTE: field is 'content', NOT 'text'\n"
        "  - separator: {type: 'separator'}  NOTE: type is 'separator', NOT 'divider'\n",
        {
            "title": str,
            "card_type": str,
            "blocks": list,
        },
    )
    async def create_card(_args: dict) -> dict:
        """Create a card with title, card_type, and blocks array."""
        title = _args.get("title", "").strip()
        card_type = _args.get("card_type", "table").strip()
        blocks = _parse_json_param(_args.get("blocks", []))

        # Validate title
        if not title:
            return {
                "content": [{"type": "text", "text": "title is required"}],
                "is_error": True,
            }

        # Validate card_type
        if card_type not in VALID_CARD_TYPES:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"card_type must be one of: {', '.join(VALID_CARD_TYPES)}",
                    }
                ],
                "is_error": True,
            }

        # Validate blocks is a list
        if not isinstance(blocks, list):
            return {
                "content": [{"type": "text", "text": "blocks must be a list"}],
                "is_error": True,
            }

        # Validate and convert each block
        block_dataclasses = []
        for i, block in enumerate(blocks):
            is_valid, error_msg = _validate_block(block)
            if not is_valid:
                return {
                    "content": [
                        {"type": "text", "text": f"Block {i}: {error_msg}"}
                    ],
                    "is_error": True,
                }

            try:
                block_dataclasses.append(_build_block_dataclass(block))
            except Exception as e:
                logger.error(f"Failed to build block {i}: {e}")
                return {
                    "content": [
                        {"type": "text", "text": f"Block {i}: {str(e)}"}
                    ],
                    "is_error": True,
                }

        # Build canvas_update message
        card_id = _new_id()
        message = CanvasUpdate(
            type="canvas_update",
            payload=CanvasUpdatePayload(
                command="create_card",
                card_id=card_id,
                title=title,
                blocks=block_dataclasses,
            ),
        )

        # Send to browser
        try:
            await send_fn(to_json(message))
            logger.info(f"Created card {card_id}: {title} ({len(blocks)} blocks)")
        except Exception as e:
            logger.error(f"Failed to send canvas_update: {e}")
            return {
                "content": [
                    {"type": "text", "text": f"WebSocket error: {str(e)}"}
                ],
                "is_error": True,
            }

        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Card created: {title} (ID: {card_id})",
                }
            ]
        }

    @tool(
        "update_card",
        "Update specific blocks on an existing card (matched by block ID).\n\n"
        "Parameters:\n"
        "- card_id (str): The ID of the card to update (returned by create_card).\n"
        "- blocks (list[dict]): Replacement blocks. Same format as create_card blocks.\n"
        "  Valid types: heading, stat, key-value, table, badge, progress, text, separator.\n"
        "  See create_card for full schema of each block type.\n",
        {
            "card_id": str,
            "blocks": list,
        },
    )
    async def update_card(_args: dict) -> dict:
        """Update blocks on a card. Blocks matched by id field."""
        card_id = _args.get("card_id", "").strip()
        blocks = _parse_json_param(_args.get("blocks", []))

        # Validate card_id
        if not card_id:
            return {
                "content": [{"type": "text", "text": "card_id is required"}],
                "is_error": True,
            }

        # Validate blocks is a list
        if not isinstance(blocks, list):
            return {
                "content": [{"type": "text", "text": "blocks must be a list"}],
                "is_error": True,
            }

        # Validate and convert each block
        block_dataclasses = []
        for i, block in enumerate(blocks):
            is_valid, error_msg = _validate_block(block)
            if not is_valid:
                return {
                    "content": [
                        {"type": "text", "text": f"Block {i}: {error_msg}"}
                    ],
                    "is_error": True,
                }

            try:
                block_dataclasses.append(_build_block_dataclass(block))
            except Exception as e:
                logger.error(f"Failed to build block {i}: {e}")
                return {
                    "content": [
                        {"type": "text", "text": f"Block {i}: {str(e)}"}
                    ],
                    "is_error": True,
                }

        # Build canvas_update message
        message = CanvasUpdate(
            type="canvas_update",
            payload=CanvasUpdatePayload(
                command="update_card",
                card_id=card_id,
                blocks=block_dataclasses,
            ),
        )

        # Send to browser
        try:
            await send_fn(to_json(message))
            logger.info(f"Updated card {card_id} ({len(blocks)} blocks)")
        except Exception as e:
            logger.error(f"Failed to send canvas_update: {e}")
            return {
                "content": [
                    {"type": "text", "text": f"WebSocket error: {str(e)}"}
                ],
                "is_error": True,
            }

        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Card {card_id} updated ({len(blocks)} blocks changed)",
                }
            ]
        }

    @tool(
        "close_card",
        "Close (remove) a card from the Canvas",
        {
            "card_id": str,
        },
    )
    async def close_card(_args: dict) -> dict:
        """Close a card by ID."""
        card_id = _args.get("card_id", "").strip()

        # Validate card_id
        if not card_id:
            return {
                "content": [{"type": "text", "text": "card_id is required"}],
                "is_error": True,
            }

        # Build canvas_update message
        message = CanvasUpdate(
            type="canvas_update",
            payload=CanvasUpdatePayload(
                command="close_card",
                card_id=card_id,
            ),
        )

        # Send to browser
        try:
            await send_fn(to_json(message))
            logger.info(f"Closed card {card_id}")
        except Exception as e:
            logger.error(f"Failed to send canvas_update: {e}")
            return {
                "content": [
                    {"type": "text", "text": f"WebSocket error: {str(e)}"}
                ],
                "is_error": True,
            }

        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Card {card_id} closed",
                }
            ]
        }

    return [create_card, update_card, close_card]
