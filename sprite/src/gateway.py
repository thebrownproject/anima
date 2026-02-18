"""SpriteGateway -- routes incoming WebSocket messages to handlers."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from pathlib import Path
from typing import Any, Callable, Awaitable, TYPE_CHECKING

from .protocol import SystemMessage, SystemPayload, _new_id, to_json, is_websocket_message
from .runtime import AgentRuntime
from .state_sync import send_state_sync

if TYPE_CHECKING:
    from .database import WorkspaceDB

logger = logging.getLogger(__name__)

SendFn = Callable[[str], Awaitable[None]]

_ROUTED_TYPES = frozenset({
    "mission", "file_upload", "canvas_interaction",
    "heartbeat", "auth", "system", "state_sync_request",
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
            case "state_sync_request":
                await self._handle_state_sync_request(request_id)

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
        payload = msg.get("payload", {})
        filename = payload.get("filename", "unknown")
        mime_type = payload.get("mime_type", "")
        data_b64 = payload.get("data", "")

        doc_id = _new_id()
        upload_dir = Path("/workspace/uploads")
        upload_dir.mkdir(exist_ok=True)
        safe_name = filename.replace("/", "_").replace("..", "_")
        file_path = upload_dir / f"{doc_id}_{safe_name}"
        file_bytes = base64.b64decode(data_b64)
        file_path.write_bytes(file_bytes)
        logger.info("File saved: %s (%d bytes)", file_path, len(file_bytes))

        if self._workspace_db:
            await self._workspace_db.create_document(doc_id, filename, mime_type, str(file_path))

        await self._send_canvas_processing_card(doc_id, filename)
        await self._send_ack("file_upload_received", req_id)

        asyncio.create_task(
            self._run_extraction(doc_id, filename, mime_type, str(file_path))
        )

    async def _send_canvas_processing_card(self, doc_id: str, filename: str) -> None:
        msg = {
            "type": "canvas_update",
            "id": _new_id(),
            "timestamp": int(time.time() * 1000),
            "payload": {
                "command": "create_card",
                "card_id": doc_id,
                "title": filename,
                "blocks": [
                    {"type": "heading", "text": filename},
                    {"type": "badge", "text": "Processing...", "variant": "default"},
                ],
                "size": "medium",
            },
        }
        await self.send(json.dumps(msg))

    async def _run_extraction(self, doc_id: str, filename: str, mime_type: str, file_path: str) -> None:
        """Background task: hand file to agent for reading and extraction."""
        try:
            context = (
                f"A file was just uploaded and saved to {file_path}.\n"
                f"Filename: {filename}\n"
                f"Please read the file, extract the key structured data, and create a canvas card "
                f"with a table showing the main fields (e.g. invoice number, date, line items, total)."
            )
            async with self.mission_lock:
                await self.runtime.handle_message(context)

            if self._workspace_db:
                await self._workspace_db.update_document_status(doc_id, "completed")

        except Exception as e:
            logger.error("Extraction failed for %s: %s", filename, e)
            if self._workspace_db:
                await self._workspace_db.update_document_status(doc_id, "failed")

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
            elif action == "move":
                result = await self._workspace_db.update_card_position(
                    card_id,
                    float(data.get("position_x", 0.0)),
                    float(data.get("position_y", 0.0)),
                    int(data.get("z_index", 0)),
                )
                if result is None:
                    await self._send_error(f"Card not found: {card_id}")
                    return
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

    async def _handle_state_sync_request(self, req_id: str | None) -> None:
        logger.info("State sync requested")
        if self._workspace_db:
            await send_state_sync(self._workspace_db, self.send)
        else:
            await self._send_error("WorkspaceDB not available for state sync")

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
