"""SpriteGateway -- routes incoming WebSocket messages to handlers."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable, Awaitable

from .protocol import SystemMessage, SystemPayload, to_json, is_websocket_message
from .runtime import AgentRuntime
from .database import Database

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

    def __init__(self, send_fn: SendFn, db: Database | None = None) -> None:
        self.send = send_fn
        self.mission_lock = asyncio.Lock()
        self.runtime = AgentRuntime(send_fn=send_fn, db=db) if db else None

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

        if not self.runtime:
            await self._send_error("Agent runtime not initialized")
            return

        attachments = payload.get("attachments")
        await self.runtime.run_mission(text, request_id=req_id, attachments=attachments)

    async def _handle_file_upload(self, msg: dict[str, Any], req_id: str | None) -> None:
        logger.info("File upload: %s", msg.get("payload", {}).get("filename", "?"))
        await self._send_ack("file_upload_received", req_id)

    async def _handle_canvas(self, msg: dict[str, Any], req_id: str | None) -> None:
        logger.info("Canvas interaction: %s", msg.get("payload", {}).get("action", "?"))
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
