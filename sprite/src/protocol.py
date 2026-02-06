"""
WebSocket Message Protocol -- Python Dataclasses

Matches the TypeScript source of truth at bridge/src/protocol.ts exactly.
When updating message types, update bridge/src/protocol.ts FIRST, then
mirror changes here and to frontend/types/ws-protocol.ts.

Source of truth: bridge/src/protocol.ts
Frontend copy: frontend/types/ws-protocol.ts
"""

from __future__ import annotations

import json
import uuid
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Literal, Optional, Union


# =============================================================================
# Constants
# =============================================================================

BLOCK_TYPES = (
    "heading",
    "stat",
    "key-value",
    "table",
    "badge",
    "progress",
    "text",
    "separator",
)

MESSAGE_TYPES = (
    "mission",
    "file_upload",
    "canvas_interaction",
    "auth",
    "agent_event",
    "canvas_update",
    "status",
    "system",
)

# Type aliases matching TypeScript literal unions
BlockType = Literal[
    "heading", "stat", "key-value", "table",
    "badge", "progress", "text", "separator",
]
MessageType = Literal[
    "mission", "file_upload", "canvas_interaction", "auth",
    "agent_event", "canvas_update", "status", "system",
]
CanvasAction = Literal["edit_cell", "resize", "move", "close"]
CanvasCommand = Literal["create_card", "update_card", "close_card"]
AgentEventType = Literal["text", "tool", "complete", "error"]
BadgeVariant = Literal["default", "success", "warning", "destructive"]
DocumentStatus = Literal["processing", "ocr_complete", "completed", "failed"]
SystemEvent = Literal["connected", "sprite_waking", "sprite_ready", "error"]


# =============================================================================
# Utility: Generate message defaults
# =============================================================================

def _new_id() -> str:
    """Generate a new UUID for message/block identification."""
    return str(uuid.uuid4())


def _now_ms() -> int:
    """Current time as Unix epoch milliseconds."""
    return int(time.time() * 1000)


# =============================================================================
# Block Types (Composable Card System)
# =============================================================================

@dataclass
class HeadingBlock:
    """Heading block with optional subtitle."""
    id: str
    type: Literal["heading"]
    text: str
    subtitle: Optional[str] = None


@dataclass
class StatBlock:
    """Statistic display block."""
    id: str
    type: Literal["stat"]
    value: str
    label: str
    trend: Optional[str] = None


@dataclass
class KeyValuePair:
    """Single key-value pair within a KeyValueBlock."""
    label: str
    value: str


@dataclass
class KeyValueBlock:
    """Block displaying key-value pairs."""
    id: str
    type: Literal["key-value"]
    pairs: list[KeyValuePair]


@dataclass
class TableBlock:
    """Table block with column headers and row data."""
    id: str
    type: Literal["table"]
    columns: list[str]
    rows: list[dict[str, Any]]


@dataclass
class BadgeBlock:
    """Badge/tag display block."""
    id: str
    type: Literal["badge"]
    text: str
    variant: BadgeVariant


@dataclass
class ProgressBlock:
    """Progress bar block."""
    id: str
    type: Literal["progress"]
    value: float
    label: Optional[str] = None


@dataclass
class TextBlock:
    """Text block (supports markdown)."""
    id: str
    type: Literal["text"]
    content: str


@dataclass
class SeparatorBlock:
    """Visual separator block."""
    id: str
    type: Literal["separator"]


# Union of all block types
Block = Union[
    HeadingBlock,
    StatBlock,
    KeyValueBlock,
    TableBlock,
    BadgeBlock,
    ProgressBlock,
    TextBlock,
    SeparatorBlock,
]


# =============================================================================
# Browser -> Sprite Messages
# =============================================================================

@dataclass
class MissionPayload:
    """Payload for a user mission (chat message)."""
    text: str
    attachments: Optional[list[str]] = None


@dataclass
class MissionMessage:
    """User sends a mission (chat message)."""
    type: Literal["mission"]
    payload: MissionPayload
    id: str = field(default_factory=_new_id)
    timestamp: int = field(default_factory=_now_ms)
    request_id: Optional[str] = None


@dataclass
class FileUploadPayload:
    """Payload for a file upload."""
    filename: str
    mime_type: str
    data: str  # Base64 encoded, max 25MB


@dataclass
class FileUploadMessage:
    """File upload message."""
    type: Literal["file_upload"]
    payload: FileUploadPayload
    id: str = field(default_factory=_new_id)
    timestamp: int = field(default_factory=_now_ms)
    request_id: Optional[str] = None


@dataclass
class CanvasInteractionPayload:
    """Payload for canvas interactions."""
    card_id: str
    action: CanvasAction
    data: Any
    block_id: Optional[str] = None


@dataclass
class CanvasInteraction:
    """Canvas interaction (user edited a cell, moved a card, etc.)."""
    type: Literal["canvas_interaction"]
    payload: CanvasInteractionPayload
    id: str = field(default_factory=_new_id)
    timestamp: int = field(default_factory=_now_ms)
    request_id: Optional[str] = None


@dataclass
class AuthPayload:
    """Payload for auth connect."""
    token: str


@dataclass
class AuthConnect:
    """Auth message (sent on connect only)."""
    type: Literal["auth"]
    payload: AuthPayload
    id: str = field(default_factory=_new_id)
    timestamp: int = field(default_factory=_now_ms)
    request_id: Optional[str] = None


# =============================================================================
# Sprite -> Browser Messages
# =============================================================================

@dataclass
class AgentEventMeta:
    """Optional metadata for agent events."""
    extraction_id: Optional[str] = None
    session_id: Optional[str] = None


@dataclass
class AgentEventPayload:
    """Payload for agent events."""
    event_type: AgentEventType
    content: str
    meta: Optional[AgentEventMeta] = None


@dataclass
class AgentEvent:
    """Agent thinking/streaming text."""
    type: Literal["agent_event"]
    payload: AgentEventPayload
    id: str = field(default_factory=_new_id)
    timestamp: int = field(default_factory=_now_ms)
    request_id: Optional[str] = None


@dataclass
class CanvasUpdatePayload:
    """Payload for canvas update commands."""
    command: CanvasCommand
    card_id: str
    title: Optional[str] = None
    blocks: Optional[list[Block]] = None
    mission_id: Optional[str] = None


@dataclass
class CanvasUpdate:
    """Canvas commands for the composable card system."""
    type: Literal["canvas_update"]
    payload: CanvasUpdatePayload
    id: str = field(default_factory=_new_id)
    timestamp: int = field(default_factory=_now_ms)
    request_id: Optional[str] = None


@dataclass
class StatusPayload:
    """Payload for document status updates."""
    document_id: str
    status: DocumentStatus
    message: Optional[str] = None


@dataclass
class StatusUpdate:
    """Document status updates."""
    type: Literal["status"]
    payload: StatusPayload
    id: str = field(default_factory=_new_id)
    timestamp: int = field(default_factory=_now_ms)
    request_id: Optional[str] = None


@dataclass
class SystemPayload:
    """Payload for system messages."""
    event: SystemEvent
    message: Optional[str] = None


@dataclass
class SystemMessage:
    """System messages (connection state, errors)."""
    type: Literal["system"]
    payload: SystemPayload
    id: str = field(default_factory=_new_id)
    timestamp: int = field(default_factory=_now_ms)
    request_id: Optional[str] = None


# =============================================================================
# Union Types
# =============================================================================

BrowserToSpriteMessage = Union[
    MissionMessage,
    FileUploadMessage,
    CanvasInteraction,
    AuthConnect,
]

SpriteToBrowserMessage = Union[
    AgentEvent,
    CanvasUpdate,
    StatusUpdate,
    SystemMessage,
]

ProtocolMessage = Union[BrowserToSpriteMessage, SpriteToBrowserMessage]


# =============================================================================
# Validation Helpers (Type Guards)
# =============================================================================

def is_websocket_message(value: Any) -> bool:
    """Check if a value has the required base message fields (id, timestamp, type)."""
    if not isinstance(value, dict):
        return False
    return (
        isinstance(value.get("type"), str)
        and isinstance(value.get("id"), str)
        and isinstance(value.get("timestamp"), (int, float))
    )


def _has_payload(value: dict[str, Any]) -> bool:
    """Check if a dict has a payload that is itself a dict."""
    return isinstance(value.get("payload"), dict)


def is_mission_message(value: Any) -> bool:
    """Validate a MissionMessage dict."""
    if not is_websocket_message(value) or not _has_payload(value):
        return False
    return (
        value["type"] == "mission"
        and isinstance(value["payload"].get("text"), str)
    )


def is_file_upload_message(value: Any) -> bool:
    """Validate a FileUploadMessage dict."""
    if not is_websocket_message(value) or not _has_payload(value):
        return False
    p = value["payload"]
    return (
        value["type"] == "file_upload"
        and isinstance(p.get("filename"), str)
        and isinstance(p.get("mime_type"), str)
        and isinstance(p.get("data"), str)
    )


def is_canvas_interaction(value: Any) -> bool:
    """Validate a CanvasInteraction dict."""
    if not is_websocket_message(value) or not _has_payload(value):
        return False
    p = value["payload"]
    valid_actions = ("edit_cell", "resize", "move", "close")
    return (
        value["type"] == "canvas_interaction"
        and isinstance(p.get("card_id"), str)
        and p.get("action") in valid_actions
    )


def is_auth_connect(value: Any) -> bool:
    """Validate an AuthConnect dict."""
    if not is_websocket_message(value) or not _has_payload(value):
        return False
    return (
        value["type"] == "auth"
        and isinstance(value["payload"].get("token"), str)
    )


def is_agent_event(value: Any) -> bool:
    """Validate an AgentEvent dict."""
    if not is_websocket_message(value) or not _has_payload(value):
        return False
    p = value["payload"]
    valid_types = ("text", "tool", "complete", "error")
    return (
        value["type"] == "agent_event"
        and p.get("event_type") in valid_types
        and isinstance(p.get("content"), str)
    )


def is_canvas_update(value: Any) -> bool:
    """Validate a CanvasUpdate dict."""
    if not is_websocket_message(value) or not _has_payload(value):
        return False
    p = value["payload"]
    valid_commands = ("create_card", "update_card", "close_card")
    return (
        value["type"] == "canvas_update"
        and p.get("command") in valid_commands
        and isinstance(p.get("card_id"), str)
    )


def is_status_update(value: Any) -> bool:
    """Validate a StatusUpdate dict."""
    if not is_websocket_message(value) or not _has_payload(value):
        return False
    p = value["payload"]
    valid_statuses = ("processing", "ocr_complete", "completed", "failed")
    return (
        value["type"] == "status"
        and isinstance(p.get("document_id"), str)
        and p.get("status") in valid_statuses
    )


def is_system_message(value: Any) -> bool:
    """Validate a SystemMessage dict."""
    if not is_websocket_message(value) or not _has_payload(value):
        return False
    p = value["payload"]
    valid_events = ("connected", "sprite_waking", "sprite_ready", "error")
    return (
        value["type"] == "system"
        and p.get("event") in valid_events
    )


def is_protocol_message(value: Any) -> bool:
    """Validate any protocol message by dispatching to the correct type guard."""
    if not is_websocket_message(value):
        return False
    validators = {
        "mission": is_mission_message,
        "file_upload": is_file_upload_message,
        "canvas_interaction": is_canvas_interaction,
        "auth": is_auth_connect,
        "agent_event": is_agent_event,
        "canvas_update": is_canvas_update,
        "status": is_status_update,
        "system": is_system_message,
    }
    validator = validators.get(value["type"])
    if validator is None:
        return False
    return validator(value)


def is_block(value: Any) -> bool:
    """Check if a value is a valid Block dict (has id and valid type)."""
    if not isinstance(value, dict):
        return False
    return (
        isinstance(value.get("id"), str)
        and value.get("type") in BLOCK_TYPES
    )


def is_block_list(value: Any) -> bool:
    """Validate a list of blocks."""
    if not isinstance(value, list):
        return False
    return all(is_block(item) for item in value)


# =============================================================================
# Serialization Helpers
# =============================================================================

def _serialize_block(block: Block) -> dict[str, Any]:
    """Serialize a Block dataclass to a dict, handling nested dataclasses."""
    if isinstance(block, KeyValueBlock):
        return {
            "id": block.id,
            "type": block.type,
            "pairs": [{"label": p.label, "value": p.value} for p in block.pairs],
        }
    return asdict(block)


def to_dict(message: ProtocolMessage) -> dict[str, Any]:
    """
    Convert a protocol message dataclass to a JSON-serializable dict.
    Handles nested dataclasses and optional None values (removes them).
    """
    result = asdict(message)
    # Clean up None values for optional fields (matches TS behavior)
    _strip_none(result)

    # Handle CanvasUpdate blocks serialization specifically
    # (asdict already handles this, but we ensure correct structure)
    if hasattr(message, "payload") and hasattr(message.payload, "blocks"):
        if message.payload.blocks is not None:
            result["payload"]["blocks"] = [
                _serialize_block(b) for b in message.payload.blocks
            ]

    # Convert AgentEventMeta field names from snake_case to camelCase
    # to match the TypeScript interface (extractionId, sessionId)
    if message.type == "agent_event" and result["payload"].get("meta"):
        meta = result["payload"]["meta"]
        new_meta: dict[str, Any] = {}
        if "extraction_id" in meta and meta["extraction_id"] is not None:
            new_meta["extractionId"] = meta["extraction_id"]
        if "session_id" in meta and meta["session_id"] is not None:
            new_meta["sessionId"] = meta["session_id"]
        result["payload"]["meta"] = new_meta if new_meta else None

    # Final cleanup of None values after transformations
    _strip_none(result)
    return result


def _strip_none(d: dict[str, Any]) -> None:
    """Recursively remove keys with None values from a dict (in place)."""
    keys_to_remove = [k for k, v in d.items() if v is None]
    for k in keys_to_remove:
        del d[k]
    for v in d.values():
        if isinstance(v, dict):
            _strip_none(v)
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    _strip_none(item)


def to_json(message: ProtocolMessage) -> str:
    """Serialize a protocol message to a JSON string."""
    return json.dumps(to_dict(message))


def parse_message(data: str) -> Optional[dict[str, Any]]:
    """
    Parse a raw WebSocket message string into a dict.
    Returns None if parsing fails or the message is invalid.
    """
    try:
        parsed = json.loads(data)
        if is_protocol_message(parsed):
            return parsed
        return None
    except (json.JSONDecodeError, TypeError):
        return None
