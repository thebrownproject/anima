"""AgentRuntime -- wraps Claude Agent SDK, streams events as WebSocket messages."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Callable, Awaitable

from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    HookMatcher,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ResultMessage,
    create_sdk_mcp_server,
)

from .protocol import AgentEvent, AgentEventPayload, AgentEventMeta, to_json
from .tools.canvas import create_canvas_tools
from .tools.memory import create_memory_tools
from .memory.loader import load as load_memory
from .memory import ensure_templates
from .memory.hooks import TurnBuffer, create_hook_callbacks
from .database import TranscriptDB, MemoryDB, WorkspaceDB
from .memory.processor import ObservationProcessor

try:
    from anthropic import RateLimitError, AuthenticationError, APIConnectionError
except ImportError:  # pragma: no cover
    RateLimitError = AuthenticationError = APIConnectionError = None  # type: ignore[misc,assignment]

logger = logging.getLogger(__name__)


def _classify_error(exc: Exception) -> str:
    """Return a user-friendly message based on exception type or message patterns."""
    # Direct anthropic SDK exceptions
    if RateLimitError and isinstance(exc, RateLimitError):
        return "Rate limited, please wait a moment before trying again."
    if AuthenticationError and isinstance(exc, AuthenticationError):
        return "API key issue -- check configuration."
    if APIConnectionError and isinstance(exc, APIConnectionError):
        return "Connection error -- retrying."
    # String-based fallback for subprocess-wrapped SDK errors
    msg = str(exc).lower()
    if "rate_limit" in msg or "rate limit" in msg or "overloaded" in msg:
        return "Rate limited, please wait a moment before trying again."
    if "authentication" in msg or "api key" in msg or "unauthorized" in msg:
        return "API key issue -- check configuration."
    if "connection" in msg and ("refused" in msg or "reset" in msg or "timeout" in msg):
        return "Connection error -- retrying."
    return str(exc)

SendFn = Callable[[str], Awaitable[None]]

MAX_TURNS = 15
SDK_QUERY_TIMEOUT = 30  # seconds -- initial query to Anthropic API
SDK_MSG_TIMEOUT = 120   # seconds -- per-message timeout during receive_response
SDK_TURN_TIMEOUT = 600  # seconds -- total turn timeout (query + all responses)



class AgentRuntime:
    """Invokes Claude Agent SDK and streams AgentEvent messages via send_fn.

    Keeps a persistent ClaudeSDKClient for multi-turn conversation within
    a connection. The SDK maintains context across query() calls on the
    same client instance.

    Mission serialization is handled by the gateway's mission_lock.
    """

    def __init__(
        self,
        send_fn: SendFn,
        transcript_db: TranscriptDB | None = None,
        memory_db: MemoryDB | None = None,
        processor: ObservationProcessor | None = None,
        workspace_db: WorkspaceDB | None = None,
    ) -> None:
        self._send = send_fn
        self._is_connected: bool = False
        self._send_generation: int = 0
        self.last_session_id: str | None = None
        self._client: ClaudeSDKClient | None = None
        self._buffer = TurnBuffer()
        self._transcript_db = transcript_db
        self._memory_db = memory_db
        self._processor = processor
        self._workspace_db = workspace_db
        self._active_stack_id: str | None = None
        self._turn_response: str = ""  # chat persistence accumulator (separate from TurnBuffer which is cleared by Stop hook)
        self._hooks: dict | None = None
        if transcript_db and processor:
            self._hooks = create_hook_callbacks(
                transcript_db, processor, self._buffer
            )

        ensure_templates()

    def set_active_stack_id(self, stack_id: str) -> None:
        """Set the active stack_id for canvas tool scoping (called by gateway per mission)."""
        self._active_stack_id = stack_id

    async def _indirect_send(self, data: str) -> None:
        """Delegate to the current send_fn. Canvas tools capture this method
        instead of the raw send_fn so they survive TCP reconnections."""
        if not self._is_connected:
            logger.warning("Dropping indirect send -- not connected")
            return
        await self._send(data)

    def _build_hooks_dict(self) -> dict | None:
        """Build hooks kwarg for ClaudeAgentOptions, or None if no hooks configured."""
        if not self._hooks:
            return None
        # Non-tool hooks: try matcher=None first per KEY DECISIONS.
        # PostToolUse uses '*' to match all tools.
        try:
            return {
                "UserPromptSubmit": [
                    HookMatcher(matcher=None, hooks=[self._hooks["on_user_prompt_submit"]]),
                ],
                "PostToolUse": [
                    HookMatcher(matcher="*", hooks=[self._hooks["on_post_tool_use"]]),
                ],
                "Stop": [
                    HookMatcher(matcher=None, hooks=[self._hooks["on_stop"]]),
                ],
                "PreCompact": [
                    HookMatcher(matcher=None, hooks=[self._hooks["on_pre_compact"]]),
                ],
            }
        except Exception:
            logger.exception("Failed to build hooks dict")
            return None

    def _build_options(
        self, *, system_prompt: str | None = None, resume: str | None = None,
        mcp_servers: dict | None = None,
    ) -> ClaudeAgentOptions:
        """Construct ClaudeAgentOptions with hooks registered (if available)."""
        kwargs: dict = {
            "max_turns": MAX_TURNS,
            "permission_mode": "bypassPermissions",
            "cwd": "/workspace",
        }
        if system_prompt:
            kwargs["system_prompt"] = system_prompt
        if resume:
            kwargs["resume"] = resume
        if mcp_servers:
            kwargs["mcp_servers"] = mcp_servers
        hooks = self._build_hooks_dict()
        if hooks:
            kwargs["hooks"] = hooks
        return ClaudeAgentOptions(**kwargs)

    def update_send_fn(self, send_fn: SendFn) -> None:
        """Point the runtime at a new connection's send function.

        Called when a new TCP connection arrives (reconnect after sleep/wake).
        The SDK client and conversation context are preserved.
        """
        self._send_generation += 1
        self._send = send_fn
        self._is_connected = True
        logger.info("Runtime send_fn updated (gen=%d)", self._send_generation)

    def mark_disconnected(self) -> None:
        """Mark runtime as disconnected. Called from server on connection close."""
        self._is_connected = False
        logger.info("Runtime marked disconnected")

    async def handle_message(
        self,
        text: str,
        request_id: str | None = None,
        attachments: list[str] | None = None,
    ) -> None:
        """Handle a user message — creates client on first call, reuses on subsequent.

        This is the single entry point for all user messages from the gateway.
        """
        if self._client is None:
            await self._start_session(text, request_id, attachments)
        else:
            await self._continue_session(text, request_id)

    async def _start_session(
        self,
        text: str,
        request_id: str | None = None,
        attachments: list[str] | None = None,
    ) -> None:
        """Start a new SDK session — first message after process start.

        If a persisted session ID exists from a previous process, attempts to
        resume via the SDK (Anthropic stores full conversation history server-side).
        Falls back to a fresh session if resume fails or no session file exists.
        """
        # Check for persisted session ID from a previous process
        session_file = Path("/workspace/.os/session_id")
        resume_id: str | None = None
        try:
            if session_file.exists():
                resume_id = session_file.read_text().strip() or None
        except OSError:
            pass

        # --- Build tools + system prompt (needed for both resume and fresh paths) ---
        # Tools are local Python closures — never stored server-side, must always re-register.
        # Memory files may have been updated by daemon — always reload for current context.
        canvas_tools = create_canvas_tools(
            self._indirect_send,
            workspace_db=self._workspace_db,
            stack_id_fn=lambda: self._active_stack_id,
        )
        memory_tools = create_memory_tools(self._memory_db) if self._memory_db else []
        sprite_server = create_sdk_mcp_server(
            name="sprite", tools=canvas_tools + memory_tools
        )
        system_prompt = await load_memory(self._memory_db)

        # --- Resume path: restore conversation context + fresh tools + fresh system prompt ---
        if resume_id:
            logger.info("Attempting resume from session %s", resume_id)
            options = self._build_options(
                resume=resume_id,
                system_prompt=system_prompt,
                mcp_servers={"sprite": sprite_server},
            )
            try:
                self._client = ClaudeSDKClient(options=options)
                await self._client.__aenter__()
                logger.info("SDK session resumed (session %s)", resume_id)
                await self._query_and_stream(text, request_id)
                return
            except Exception as exc:
                logger.warning("Resume failed (session %s): %s — starting fresh", resume_id, exc)
                await self._cleanup_client()
                try:
                    session_file.unlink(missing_ok=True)
                except OSError:
                    pass

        # --- Fresh path ---

        session_id = f"session-{int(time.time())}"
        if self._transcript_db:
            await self._transcript_db.execute(
                "INSERT INTO sessions (id, started_at, message_count, observation_count) VALUES (?, ?, 0, 0)",
                (session_id, time.time()),
            )

        options = self._build_options(
            system_prompt=system_prompt,
            mcp_servers={"sprite": sprite_server},
        )

        try:
            self._client = ClaudeSDKClient(options=options)
            await self._client.__aenter__()
            logger.info("SDK session started (new client)")
            await self._query_and_stream(text, request_id)
        except Exception as exc:
            user_msg = _classify_error(exc)
            logger.error("Agent error starting session: %s (user sees: %s)", exc, user_msg)
            await self._cleanup_client()
            await self._send_event("error", user_msg, request_id)

    async def _continue_session(
        self,
        text: str,
        request_id: str | None = None,
    ) -> None:
        """Continue an existing SDK session — subsequent messages."""
        try:
            logger.info("SDK session continuing (turn %s)", self.last_session_id)
            await self._query_and_stream(text, request_id)
        except Exception as exc:
            logger.warning("Continue failed (%s), starting fresh session", exc)
            await self._cleanup_client()
            # Fall back to a fresh session
            await self._start_session(text, request_id)

    async def _query_and_stream(self, prompt: str, request_id: str | None) -> None:
        """Send a query to the persistent client and stream responses."""
        await asyncio.wait_for(self._client.query(prompt), timeout=SDK_QUERY_TIMEOUT)
        msg_count = 0
        response_iter = self._client.receive_response().__aiter__()
        while True:
            try:
                message = await asyncio.wait_for(
                    response_iter.__anext__(), timeout=SDK_MSG_TIMEOUT,
                )
            except StopAsyncIteration:
                break
            msg_count += 1
            logger.info("SDK message #%d: %s", msg_count, type(message).__name__)
            await self._handle_sdk_message(message, request_id)
        logger.info("SDK turn complete: %d messages", msg_count)

    async def cleanup(self) -> None:
        """Clean up the persistent client on disconnect."""
        await self._cleanup_client()

    async def _cleanup_client(self) -> None:
        """Close the SDK client if open."""
        if self._client is not None:
            try:
                await self._client.__aexit__(None, None, None)
            except Exception as exc:
                logger.warning("Error closing SDK client: %s", exc)
            self._client = None

    # -- SDK message handling -------------------------------------------------

    async def _handle_sdk_message(self, message: object, request_id: str | None) -> None:
        """Map a single SDK message to AgentEvent(s) and send."""
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    self._buffer.append_agent_response(block.text)
                    self._turn_response += block.text
                    await self._send_event("text", block.text, request_id)
                elif isinstance(block, ToolUseBlock):
                    content = json.dumps({"tool": block.name, "input": block.input})
                    await self._send_event("tool", content, request_id)

        elif isinstance(message, ResultMessage):
            self.last_session_id = message.session_id
            # Persist to disk for resume after process restart
            try:
                Path("/workspace/.os/session_id").write_text(message.session_id)
            except OSError:
                logger.warning("Failed to persist session_id to disk")

            if self._workspace_db and self._turn_response:
                await self._workspace_db.add_chat_message("agent", self._turn_response)
            self._turn_response = ""

            meta = AgentEventMeta(session_id=message.session_id)
            content = json.dumps({
                "session_id": message.session_id,
                "cost_usd": message.total_cost_usd,
            })
            await self._send_event("complete", content, request_id, meta=meta)

    async def _send_event(
        self,
        event_type: str,
        content: str,
        request_id: str | None,
        meta: AgentEventMeta | None = None,
    ) -> None:
        """Build and send an AgentEvent message."""
        if not self._is_connected:
            logger.warning("Dropping %s event -- not connected", event_type)
            return
        gen = self._send_generation
        event = AgentEvent(
            type="agent_event",
            payload=AgentEventPayload(
                event_type=event_type,
                content=content,
                meta=meta,
            ),
            request_id=request_id,
        )
        await self._send(to_json(event))
        if self._send_generation != gen:
            logger.warning("send_fn changed mid-send (gen %d->%d)", gen, self._send_generation)
