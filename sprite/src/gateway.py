"""SpriteGateway -- routes incoming WebSocket messages to handlers."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable, Awaitable, TYPE_CHECKING

from .protocol import SystemMessage, SystemPayload, _new_id, to_json, is_websocket_message
from .runtime import AgentRuntime

if TYPE_CHECKING:
    from .database import WorkspaceDB

logger = logging.getLogger(__name__)

SendFn = Callable[[str], Awaitable[None]]

_ROUTED_TYPES = frozenset({
    "mission", "file_upload", "canvas_interaction",
    "heartbeat", "auth", "system",
})


class SpriteGateway:
    """Routes parsed messages to stub handlers by type.

    mission and heartbeat share an async lock for serial execution.
    All other types run concurrently.
    """

    def __init__(
        self,
        send_fn: SendFn,
        runtime: AgentRuntime | None = None,
        workspace_db: WorkspaceDB | None = None,
    ) -> None:
        self.send = send_fn
        self.mission_lock = asyncio.Lock()
        self._workspace_db = workspace_db
        # Use provided runtime (server-scoped) or create one (tests)
        self.runtime = runtime or AgentRuntime(send_fn=send_fn)

    async def route(self, raw: str) -> None:
        """Parse a raw WS message and dispatch to the correct handler."""
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Unparseable message")
            await self._send_error("Unparseable message")
            return

        if not isinstance(parsed, dict):
            logger.warning("Invalid message structure")
            await self._send_error("Invalid message structure")
            return

        # Silently handle keepalive pings (no id field, just type+timestamp)
        if parsed.get("type") == "ping":
            return

        if not is_websocket_message(parsed):
            logger.warning("Invalid message structure")
            await self._send_error("Invalid message structure")
            return

        msg_type = parsed["type"]
        request_id = parsed.get("request_id")

        if msg_type not in _ROUTED_TYPES:
            logger.warning("Unknown message type: %s", msg_type)
            await self._send_error(f"Unknown type: {msg_type}")
            return

        match msg_type:
            case "mission":
                async with self.mission_lock:
                    await self._handle_mission(parsed, request_id)
            case "file_upload":
                await self._handle_file_upload(parsed, request_id)
            case "canvas_interaction":
                await self._handle_canvas(parsed, request_id)
            case "heartbeat":
                async with self.mission_lock:
                    await self._handle_heartbeat(parsed, request_id)
            case "auth":
                await self._handle_auth(parsed, request_id)
            case "system":
                await self._handle_system(parsed, request_id)

    # -- Stub handlers (log + ack) -------------------------------------------

    async def _handle_mission(self, msg: dict[str, Any], req_id: str | None) -> None:
        payload = msg.get("payload", {})
        text = payload.get("text", "")
        logger.info("Mission received: %.80s", text)
        await self._send_ack("mission_received", req_id)

        if self._workspace_db and text:
            await self._workspace_db.add_chat_message("user", text)

        if not self.runtime:
            await self._send_error("Agent runtime not initialized")
            return

        # Extract stack_id from mission context for canvas tool scoping
        context = payload.get("context") or {}
        stack_id = context.get("stack_id")
        if stack_id:
            self.runtime.set_active_stack_id(stack_id)

        attachments = payload.get("attachments")
        await self.runtime.handle_message(text, request_id=req_id, attachments=attachments)

    async def _handle_file_upload(self, msg: dict[str, Any], req_id: str | None) -> None:
        logger.info("File upload: %s", msg.get("payload", {}).get("filename", "?"))
        await self._send_ack("file_upload_received", req_id)

    async def _handle_canvas(self, msg: dict[str, Any], req_id: str | None) -> None:
        payload = msg.get("payload", {})
        action = payload.get("action", "")
        card_id = payload.get("card_id", "")
        data = payload.get("data") or {}
        logger.info("Canvas interaction: %s", action)

        if not self._workspace_db:
            await self._send_ack("canvas_interaction_received", req_id)
            return

        try:
            if action == "archive_card":
                await self._workspace_db.archive_card(card_id)
            elif action == "archive_stack":
                sid = data.get("stack_id", card_id)
                await self._workspace_db.archive_stack(sid)
            elif action == "create_stack":
                sid = data.get("stack_id", _new_id())
                name = data.get("name", "New Stack")
                color = data.get("color")
                await self._workspace_db.create_stack(sid, name, color)
            elif action == "restore_stack":
                sid = data.get("stack_id", card_id)
                await self._workspace_db.restore_stack(sid)
        except Exception as e:
            logger.error("Canvas %s failed: %s", action, e)
            await self._send_error(f"Canvas operation failed: {e}")
            return

        await self._send_ack("canvas_interaction_received", req_id)

    async def _handle_heartbeat(self, msg: dict[str, Any], req_id: str | None) -> None:
        logger.info("Heartbeat received")
        await self._send_ack("heartbeat_received", req_id)

    async def _handle_auth(self, msg: dict[str, Any], req_id: str | None) -> None:
        logger.info("Auth connect received")
        await self._send_ack("auth_received", req_id)

    async def _handle_system(self, msg: dict[str, Any], req_id: str | None) -> None:
        logger.info("System message: %s", msg.get("payload", {}).get("event", "?"))
        await self._send_ack("system_received", req_id)

    # -- Outbound helpers ----------------------------------------------------

    async def _send_ack(self, detail: str, request_id: str | None = None) -> None:
        ack = SystemMessage(
            type="system",
            payload=SystemPayload(event="connected", message=detail),
            request_id=request_id,
        )
        await self.send(to_json(ack))

    async def _send_error(self, detail: str) -> None:
        err = SystemMessage(
            type="system",
            payload=SystemPayload(event="error", message=detail),
        )
        await self.send(to_json(err))
