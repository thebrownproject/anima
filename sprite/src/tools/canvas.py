"""Canvas tools for agent — create/update/close cards via WebSocket messages."""

from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable, TYPE_CHECKING

from claude_agent_sdk import tool

from ..protocol import (
    CARD_TYPES,
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

if TYPE_CHECKING:
    from ..database import WorkspaceDB

logger = logging.getLogger(__name__)

SendFn = Callable[[str], Awaitable[None]]

VALID_SIZES = {"small", "medium", "large", "full"}

# Block registry: type -> (required_fields, dataclass_type, builder_fn)
BLOCK_REGISTRY = {
    "heading": (
        ["text"],
        HeadingBlock,
        lambda bid, d: HeadingBlock(id=bid, type="heading", text=d["text"], subtitle=d.get("subtitle")),
    ),
    "stat": (
        ["value", "label"],
        StatBlock,
        lambda bid, d: StatBlock(id=bid, type="stat", value=d["value"], label=d["label"], trend=d.get("trend")),
    ),
    "key-value": (
        ["pairs"],
        KeyValueBlock,
        lambda bid, d: KeyValueBlock(
            id=bid, type="key-value", pairs=[KeyValuePair(label=p["label"], value=p["value"]) for p in d["pairs"]]
        ),
    ),
    "table": (
        ["columns", "rows"],
        TableBlock,
        lambda bid, d: TableBlock(id=bid, type="table", columns=d["columns"], rows=d["rows"]),
    ),
    "badge": (
        ["text", "variant"],
        BadgeBlock,
        lambda bid, d: BadgeBlock(id=bid, type="badge", text=d["text"], variant=d["variant"]),
    ),
    "progress": (
        ["value"],
        ProgressBlock,
        lambda bid, d: ProgressBlock(id=bid, type="progress", value=d["value"], label=d.get("label")),
    ),
    "text": (
        ["content"],
        TextBlock,
        lambda bid, d: TextBlock(id=bid, type="text", content=d["content"]),
    ),
    "separator": (
        [],
        SeparatorBlock,
        lambda bid, d: SeparatorBlock(id=bid, type="separator"),
    ),
}


def _parse_json_param(value: Any) -> Any:
    """Parse JSON if value is a stringified JSON object/array."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            pass
    return value


def _validate_block(block: dict[str, Any]) -> tuple[bool, str]:
    """Validate a block has required fields. Returns (is_valid, error_msg)."""
    if not isinstance(block, dict):
        return False, "Block must be a dict"

    block_type = block.get("type")
    if block_type not in BLOCK_REGISTRY:
        return False, f"Invalid block type: {block_type}"

    # Auto-generate ID if missing
    if "id" not in block or not block["id"]:
        block["id"] = _new_id()

    # Validate required fields
    required_fields, dataclass_type, _ = BLOCK_REGISTRY[block_type]
    for field in required_fields:
        if field not in block:
            return False, f"{dataclass_type.__name__} requires '{field}' field"

    # Special validation for key-value pairs
    if block_type == "key-value":
        pairs = block.get("pairs")
        if not isinstance(pairs, list):
            return False, "KeyValueBlock requires 'pairs' list"
        for pair in pairs:
            if not isinstance(pair, dict) or "label" not in pair or "value" not in pair:
                return False, "KeyValueBlock pairs must have 'label' and 'value'"

    return True, ""


def _build_block_dataclass(block_dict: dict[str, Any]) -> Any:
    """Convert validated dict to protocol dataclass."""
    block_type = block_dict["type"]
    _, _, builder = BLOCK_REGISTRY[block_type]
    return builder(block_dict["id"], block_dict)


def _error_result(message: str) -> dict:
    """Build standard error result."""
    return {"content": [{"type": "text", "text": message}], "is_error": True}


def _validate_and_build_blocks(blocks: Any) -> tuple[list[Any] | None, dict | None]:
    """Validate and build block dataclasses. Returns (blocks, error_result)."""
    if not isinstance(blocks, list):
        return None, _error_result("blocks must be a list")

    block_dataclasses = []
    for i, block in enumerate(blocks):
        is_valid, error_msg = _validate_block(block)
        if not is_valid:
            return None, _error_result(f"Block {i}: {error_msg}")

        try:
            block_dataclasses.append(_build_block_dataclass(block))
        except Exception as e:
            logger.error(f"Failed to build block {i}: {e}")
            return None, _error_result(f"Block {i}: {str(e)}")

    return block_dataclasses, None


async def _send_canvas_update(send_fn: SendFn, message: CanvasUpdate, action: str) -> dict | None:
    """Send canvas_update message. Returns error result on failure, None on success."""
    try:
        await send_fn(to_json(message))
        return None
    except Exception as e:
        logger.error(f"Failed to send canvas_update for {action}: {e}")
        return _error_result(f"WebSocket error: {str(e)}")


def create_canvas_tools(
    send_fn: SendFn,
    workspace_db: WorkspaceDB | None = None,
    stack_id_fn: Callable[[], str | None] | None = None,
) -> list:
    """Create canvas tools scoped with WebSocket send function and optional DB persistence.

    stack_id_fn is a callable that returns the CURRENT active stack_id.
    This avoids stale closure capture — the stack_id can change between
    tool invocations (e.g., when the user switches stacks).
    """

    @tool(
        "create_card",
        "Create a new card on the user's Canvas with composable blocks.\n\n"
        "Parameters:\n"
        "- title (str): Card title displayed in the title bar.\n"
        "- card_type (str): Template — 'document', 'metric', 'table', 'article', or 'data'.\n"
        "- size (str): Card size — 'small', 'medium' (default), 'large', or 'full'.\n"
        "  small: single stat or badge. medium: key-value pairs, short tables.\n"
        "  large: wide tables, detailed content. full: full-width dashboards.\n"
        "- summary (str, optional): One-line summary shown on the card face.\n"
        "- tags (list[str], optional): Category tags for filtering.\n"
        "- color (str, optional): Card accent color from palette.\n"
        "- type_badge (str, optional): Override badge label (defaults to card_type).\n"
        "- date (str, optional): Date string for document/article cards.\n"
        "- value (str, optional): Primary metric value for metric cards.\n"
        "- trend (str, optional): Trend string e.g. '+12%' for metric cards.\n"
        "- trend_direction (str, optional): 'up' or 'down'.\n"
        "- author (str, optional): Author name for article cards.\n"
        "- read_time (str, optional): Estimated read time e.g. '5 min'.\n"
        "- headers (list[str], optional): Column headers for table cards.\n"
        "- preview_rows (list[list[str]], optional): Preview row data for table cards.\n"
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
        {"title": str, "card_type": str, "size": str, "blocks": list},
    )
    async def create_card(_args: dict) -> dict:
        """Create a card with title, card_type, size, and blocks array."""
        title = _args.get("title", "").strip()
        card_type = _args.get("card_type", "").strip() or None
        size = _args.get("size", "medium").strip()
        blocks = _parse_json_param(_args.get("blocks", []))
        summary = _args.get("summary")
        tags = _parse_json_param(_args.get("tags"))
        color = _args.get("color")
        type_badge = _args.get("type_badge")
        date = _args.get("date")
        value = _args.get("value")
        trend = _args.get("trend")
        trend_direction = _args.get("trend_direction")
        author = _args.get("author")
        read_time = _args.get("read_time")
        headers = _parse_json_param(_args.get("headers"))
        preview_rows = _parse_json_param(_args.get("preview_rows"))

        if not title:
            return _error_result("title is required")

        if card_type and card_type not in CARD_TYPES:
            return _error_result(f"card_type must be one of: {', '.join(CARD_TYPES)}")

        if size not in VALID_SIZES:
            return _error_result(f"size must be one of: {', '.join(sorted(VALID_SIZES))}")

        block_dataclasses, error = _validate_and_build_blocks(blocks)
        if error:
            return error

        card_id = _new_id()
        message = CanvasUpdate(
            type="canvas_update",
            payload=CanvasUpdatePayload(
                command="create_card", card_id=card_id, title=title,
                blocks=block_dataclasses, size=size,
                stack_id=stack_id_fn() if stack_id_fn else None,
                card_type=card_type, summary=summary, tags=tags, color=color,
                type_badge=type_badge, date=date, value=value, trend=trend,
                trend_direction=trend_direction, author=author, read_time=read_time,
                headers=headers, preview_rows=preview_rows,
            ),
        )

        error = await _send_canvas_update(send_fn, message, f"create_card {card_id}")
        if error:
            return error

        current_stack_id = stack_id_fn() if stack_id_fn else None
        if workspace_db and current_stack_id:
            await workspace_db.upsert_card(
                card_id, current_stack_id, title, blocks, size,
                card_type=card_type, summary=summary, tags=tags, color=color,
                type_badge=type_badge, date=date, value=value, trend=trend,
                trend_direction=trend_direction, author=author, read_time=read_time,
                headers=headers, preview_rows=preview_rows,
            )

        logger.info(f"Created card {card_id}: {title} ({len(blocks)} blocks, type={card_type})")
        return {"content": [{"type": "text", "text": f"Card created: {title} (ID: {card_id})"}]}

    @tool(
        "update_card",
        "Update specific blocks on an existing card (matched by block ID).\n\n"
        "Parameters:\n"
        "- card_id (str): The ID of the card to update (returned by create_card).\n"
        "- blocks (list[dict]): Replacement blocks. Same format as create_card blocks.\n"
        "  Valid types: heading, stat, key-value, table, badge, progress, text, separator.\n"
        "  See create_card for full schema of each block type.\n"
        "- size (str, optional): Resize the card — 'small', 'medium', 'large', or 'full'.\n",
        {"card_id": str, "blocks": list},
    )
    async def update_card(_args: dict) -> dict:
        """Update blocks on a card. Blocks matched by id field."""
        card_id = _args.get("card_id", "").strip()
        blocks = _parse_json_param(_args.get("blocks", []))
        size = _args.get("size", "").strip() or None

        if not card_id:
            return _error_result("card_id is required")

        if size and size not in VALID_SIZES:
            return _error_result(f"size must be one of: {', '.join(sorted(VALID_SIZES))}")

        block_dataclasses, error = _validate_and_build_blocks(blocks)
        if error:
            return error

        message = CanvasUpdate(
            type="canvas_update",
            payload=CanvasUpdatePayload(command="update_card", card_id=card_id, blocks=block_dataclasses, size=size),
        )

        error = await _send_canvas_update(send_fn, message, f"update_card {card_id}")
        if error:
            return error

        if workspace_db:
            await workspace_db.update_card_content(card_id, blocks, size)

        logger.info(f"Updated card {card_id} ({len(blocks)} blocks)")
        return {"content": [{"type": "text", "text": f"Card {card_id} updated ({len(blocks)} blocks changed)"}]}

    @tool(
        "close_card",
        "Close (remove) a card from the Canvas",
        {"card_id": str},
    )
    async def close_card(_args: dict) -> dict:
        """Close a card by ID."""
        card_id = _args.get("card_id", "").strip()

        if not card_id:
            return _error_result("card_id is required")

        message = CanvasUpdate(
            type="canvas_update",
            payload=CanvasUpdatePayload(command="close_card", card_id=card_id),
        )

        error = await _send_canvas_update(send_fn, message, f"close_card {card_id}")
        if error:
            return error

        if workspace_db:
            await workspace_db.archive_card(card_id)

        logger.info(f"Closed card {card_id}")
        return {"content": [{"type": "text", "text": f"Card {card_id} closed"}]}

    return [create_card, update_card, close_card]
