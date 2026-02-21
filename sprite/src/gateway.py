"""SpriteGateway -- routes incoming WebSocket messages to handlers."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from pathlib import Path
from typing import Any, Callable, Awaitable, TYPE_CHECKING

from .protocol import SystemMessage, SystemPayload, _new_id, _now_ms, to_json, is_websocket_message
from .runtime import AgentRuntime
from .state_sync import send_state_sync

if TYPE_CHECKING:
    from .database import WorkspaceDB, MemoryDB

logger = logging.getLogger(__name__)

SendFn = Callable[[str], Awaitable[None]]

_ROUTED_TYPES = frozenset({
    "mission", "file_upload", "canvas_interaction",
    "heartbeat", "auth", "system", "state_sync_request",
})

def _format_canvas_context(canvas_state: list[dict[str, Any]]) -> str:
    """Format canvas state into a readable text block for the agent."""
    if not canvas_state:
        return ""

    lines = ["[Canvas State — cards the user currently sees]"]
    for card in canvas_state:
        card_id = card.get("card_id", "?")
        title = card.get("title", "Untitled")
        lines.append(f"\n  Card: {title} (id: {card_id})")
        for block in card.get("blocks", []):
            btype = block.get("type", "?")
            if btype == "table":
                cols = block.get("columns", [])
                rows = block.get("rows", [])
                lines.append(f"    [table] columns: {cols}")
                for row in rows[:10]:
                    lines.append(f"      {row}")
            elif btype == "key-value":
                for pair in block.get("pairs", []):
                    lines.append(f"    {pair.get('label', '')}: {pair.get('value', '')}")
            elif btype == "text":
                lines.append(f"    [text] {block.get('content', '')}")
            elif btype == "heading":
                lines.append(f"    [heading] {block.get('text', '')}")
            elif btype == "stat":
                lines.append(f"    [stat] {block.get('label', '')}: {block.get('value', '')}")
            elif btype == "badge":
                lines.append(f"    [badge] {block.get('text', '')} ({block.get('variant', '')})")
            elif btype == "document":
                lines.append(f"    [document] {block.get('filename', '')}")

    return "\n".join(lines)


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
        mission_lock: asyncio.Lock | None = None,
    ) -> None:
        self.send = send_fn
        self.mission_lock = mission_lock or asyncio.Lock()
        self._tasks: set[asyncio.Task] = set()
        self._workspace_db = workspace_db
        # Use provided runtime (server-scoped) or create one (tests)
        self.runtime = runtime or AgentRuntime(send_fn=send_fn)

    async def cancel_tasks(self) -> None:
        """Cancel all tracked background tasks (called on disconnect/shutdown)."""
        for task in list(self._tasks):
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

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

        # Respond to keepalive pings with pong (Bridge uses this to verify server)
        if parsed.get("type") == "ping":
            pong = json.dumps({
                "type": "pong",
                "id": parsed.get("id") or _new_id(),
                "timestamp": _now_ms(),
            })
            await self.send(pong)
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

        # Inject Canvas state so the agent knows what the user sees
        canvas_state = context.get("canvas_state")
        prompt = text
        if canvas_state:
            canvas_context = _format_canvas_context(canvas_state)
            if canvas_context:
                prompt = f"{canvas_context}\n\n{text}"

        attachments = payload.get("attachments")
        await self.runtime.handle_message(prompt, request_id=req_id, attachments=attachments)

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
        try:
            file_bytes = base64.b64decode(data_b64)
            if len(file_bytes) > 1_000_000:
                await asyncio.to_thread(file_path.write_bytes, file_bytes)
            else:
                file_path.write_bytes(file_bytes)
        except Exception as e:
            logger.error("File upload failed for %s: %s", filename, e)
            try:
                await self._send_error(f"File upload failed: {e}")
            except Exception:
                pass
            return
        logger.info("File saved: %s (%d bytes)", file_path, len(file_bytes))

        if self._workspace_db:
            await self._workspace_db.create_document(doc_id, filename, mime_type, str(file_path))

        await self._send_canvas_processing_card(doc_id, filename, data_b64, mime_type)
        await self._send_ack("file_upload_received", req_id)

        task = asyncio.create_task(
            self._run_extraction(doc_id, filename, mime_type, str(file_path))
        )
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _send_canvas_processing_card(
        self, doc_id: str, filename: str, data_b64: str = "", mime_type: str = "",
    ) -> None:
        blocks: list[dict[str, Any]] = []
        size = "medium"

        # Embed document preview if small enough (< 5MB base64)
        if data_b64 and len(data_b64) < 5_000_000:
            blocks.append({
                "type": "document", "id": _new_id(),
                "data": data_b64, "mime_type": mime_type, "filename": filename,
            })
            size = "large"

        blocks.append({"type": "heading", "text": filename})
        blocks.append({"type": "badge", "text": "Processing...", "variant": "default"})

        if self._workspace_db:
            stack_id = self.runtime._active_stack_id
            if not stack_id:
                stacks = await self._workspace_db.list_stacks()
                if stacks:
                    stack_id = stacks[0]["stack_id"]
            if stack_id:
                await self._workspace_db.upsert_card(doc_id, stack_id, filename, blocks, size)

        msg = {
            "type": "canvas_update",
            "id": _new_id(),
            "timestamp": int(time.time() * 1000),
            "payload": {
                "command": "create_card",
                "card_id": doc_id,
                "title": filename,
                "blocks": blocks,
                "size": size,
            },
        }
        await self.send(json.dumps(msg))

    async def _run_extraction(self, doc_id: str, filename: str, mime_type: str, file_path: str) -> None:
        """Background task: hand file to agent for reading and extraction."""
        try:
            context = (
                f"A file was just uploaded and saved to {file_path}.\n"
                f"Filename: {filename}, Type: {mime_type}\n"
                f"The processing card has card_id: {doc_id}. Use update_card to add extracted data.\n"
                f"Read the document using Bash (e.g. pdftotext or python). Do NOT use the Read tool on PDFs.\n"
                f"Give the user a brief summary of what the document contains in chat, "
                f"then ask how they'd like to proceed."
            )
            async with self.mission_lock:
                await self.runtime.handle_message(context)

            if self._workspace_db:
                await self._workspace_db.update_document_status(doc_id, "completed")
                await self._update_card_badge(doc_id, "Ready", "success")

        except Exception as e:
            logger.error("Extraction failed for %s: %s", filename, e)
            try:
                if self._workspace_db:
                    await self._workspace_db.update_document_status(doc_id, "failed")
                    await self._update_card_badge(doc_id, "Failed", "destructive", str(e))
                await self._send_error(f"Extraction failed for {filename}: {e}")
            except Exception as send_err:
                logger.warning("Could not send extraction error (connection dead?): %s", send_err)

    async def _update_card_badge(
        self, card_id: str, badge_text: str, badge_variant: str, error_detail: str = "",
    ) -> None:
        """Swap the badge on a processing card and optionally append an error text block."""
        if not self._workspace_db:
            return
        row = await self._workspace_db.fetchone(
            "SELECT blocks FROM cards WHERE card_id = ?", (card_id,),
        )
        if not row:
            return

        blocks = json.loads(row["blocks"]) if isinstance(row["blocks"], str) else row["blocks"]

        # Replace first badge block; preserve document + heading blocks
        updated: list[dict[str, Any]] = []
        badge_replaced = False
        for block in blocks:
            if block.get("type") == "badge" and not badge_replaced:
                updated.append({"type": "badge", "text": badge_text, "variant": badge_variant})
                badge_replaced = True
            else:
                updated.append(block)

        if not badge_replaced:
            updated.append({"type": "badge", "text": badge_text, "variant": badge_variant})

        if error_detail:
            updated.append({"type": "text", "content": error_detail})

        await self._workspace_db.update_card_content(card_id, updated)

        msg = {
            "type": "canvas_update",
            "id": _new_id(),
            "timestamp": int(time.time() * 1000),
            "payload": {
                "command": "update_card",
                "card_id": card_id,
                "blocks": updated,
            },
        }
        await self.send(json.dumps(msg))

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
            await self.check_and_send_welcome()
        else:
            await self._send_error("WorkspaceDB not available for state sync")

    async def check_and_send_welcome(self) -> None:
        """Fire a welcome message for new users (empty chat history).

        Non-blocking: spawns a background task that acquires mission_lock.
        Safe to call on every connect -- existing users (non-empty history) are skipped.
        """
        if not self._workspace_db or not self.runtime:
            return
        history = await self._workspace_db.get_chat_history(limit=1)
        if history:
            return
        task = asyncio.create_task(self._send_welcome_message())
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _send_welcome_message(self) -> None:
        """Background task: greet new user via the agent runtime."""
        try:
            prompt = (
                "The user just connected for the first time. Send a brief welcome message "
                "(2-3 sentences) introducing yourself as their Stackdocs agent. Mention you can "
                "help organize documents, extract data from invoices and PDFs, and answer questions "
                "about their files. Keep it friendly and concise. Do NOT create any cards."
            )
            async with self.mission_lock:
                await self.runtime.handle_message(prompt)
        except Exception as e:
            logger.error("Welcome message failed: %s", e)

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
