"""AgentRuntime -- wraps Claude Agent SDK, streams events as WebSocket messages."""

from __future__ import annotations

import json
import logging
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
from .agents.shared.canvas_tools import create_canvas_tools
from .agents.shared.memory_tools import create_memory_tools
from .memory.loader import load as load_memory
from .memory.journal import append_journal
from .memory.transcript import TranscriptLogger
from .memory import ensure_templates
from .memory.hooks import TurnBuffer, create_hook_callbacks

logger = logging.getLogger(__name__)

SendFn = Callable[[str], Awaitable[None]]

MAX_TURNS = 15



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
        transcript_db: object | None = None,
        processor: object | None = None,
    ) -> None:
        self._send = send_fn
        self.last_session_id: str | None = None
        self._transcript: TranscriptLogger | None = None
        self._client: ClaudeSDKClient | None = None
        self._buffer = TurnBuffer()
        self._transcript_db = transcript_db
        self._processor = processor
        self._hooks: dict | None = None
        if transcript_db and processor:
            self._hooks = create_hook_callbacks(
                transcript_db, processor, self._buffer
            )

        ensure_templates()

    async def _indirect_send(self, data: str) -> None:
        """Delegate to the current send_fn. Canvas tools capture this method
        instead of the raw send_fn so they survive TCP reconnections."""
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
        self._send = send_fn
        logger.info("Runtime send_fn updated (new connection)")

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
        """Start a new SDK session — first message on this connection."""
        # soul.md + user.md + journals = the system prompt
        system_prompt = load_memory()

        # Create canvas + memory tools and register via single MCP server
        # Use indirect send so canvas tools always use the CURRENT send_fn
        # (self._send gets replaced on TCP reconnect via update_send_fn)
        canvas_tools = create_canvas_tools(self._indirect_send)
        memory_tools = create_memory_tools()
        sprite_server = create_sdk_mcp_server(
            name="sprite", tools=canvas_tools + memory_tools
        )

        self._transcript = TranscriptLogger()
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
            logger.error("Agent error starting session: %s", exc)
            await self._cleanup_client()
            await self._send_event("error", str(exc), request_id)

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
        await self._client.query(prompt)
        msg_count = 0
        async for message in self._client.receive_response():
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

    # -- Legacy methods for backwards compat with tests -----------------------

    async def run_mission(
        self,
        text: str,
        request_id: str | None = None,
        attachments: list[str] | None = None,
    ) -> None:
        """Run a new agent mission (creates fresh client each time).

        Used by tests and as fallback. For production multi-turn,
        use handle_message() which keeps the client alive.
        """
        # soul.md + user.md + journals = the system prompt
        system_prompt = load_memory()

        canvas_tools = create_canvas_tools(self._indirect_send)
        memory_tools = create_memory_tools()
        sprite_server = create_sdk_mcp_server(
            name="sprite", tools=canvas_tools + memory_tools
        )

        self._transcript = TranscriptLogger()
        options = self._build_options(
            system_prompt=system_prompt,
            mcp_servers={"sprite": sprite_server},
        )
        try:
            async with ClaudeSDKClient(options=options) as client:
                await client.query(text)
                async for message in client.receive_response():
                    await self._handle_sdk_message(message, request_id)
        except Exception as exc:
            logger.error("Agent error: %s", exc)
            await self._send_event("error", str(exc), request_id)

    async def resume_mission(
        self,
        text: str,
        session_id: str,
        request_id: str | None = None,
    ) -> None:
        """Resume a previous session (legacy — uses resume parameter).

        Kept for tests. Production multi-turn uses handle_message().
        """
        canvas_tools = create_canvas_tools(self._indirect_send)
        memory_tools = create_memory_tools()
        sprite_server = create_sdk_mcp_server(
            name="sprite", tools=canvas_tools + memory_tools
        )

        if not self._transcript:
            self._transcript = TranscriptLogger(session_id=session_id)

        options = self._build_options(
            resume=session_id,
            mcp_servers={"sprite": sprite_server},
        )
        try:
            async with ClaudeSDKClient(options=options) as client:
                await client.query(text)
                async for message in client.receive_response():
                    await self._handle_sdk_message(message, request_id)
        except Exception as exc:
            logger.warning("Resume failed (%s), falling back to new mission", exc)
            self.last_session_id = None
            await self.run_mission(text, request_id=request_id)

    # -- SDK message handling -------------------------------------------------

    async def _handle_sdk_message(self, message: object, request_id: str | None) -> None:
        """Map a single SDK message to AgentEvent(s) and send."""
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    self._buffer.append_agent_response(block.text)
                    await self._send_event("text", block.text, request_id)
                    if self._transcript:
                        await self._transcript.log("text", {"content": block.text})
                elif isinstance(block, ToolUseBlock):
                    content = json.dumps({"tool": block.name, "input": block.input})
                    await self._send_event("tool", content, request_id)
                    if self._transcript:
                        await self._transcript.log(
                            "tool_use", {"tool": block.name, "input": block.input}
                        )

        elif isinstance(message, ResultMessage):
            self.last_session_id = message.session_id
            if self._transcript:
                self._transcript.session_id = message.session_id

            meta = AgentEventMeta(session_id=message.session_id)
            content = json.dumps({
                "session_id": message.session_id,
                "cost_usd": message.total_cost_usd,
            })
            await self._send_event("complete", content, request_id, meta=meta)

            summary = f"Session {message.session_id} completed (cost: ${message.total_cost_usd:.4f})"
            await append_journal(summary)

            if self._transcript:
                await self._transcript.log(
                    "complete",
                    {
                        "session_id": message.session_id,
                        "cost_usd": message.total_cost_usd,
                    },
                )

    async def _send_event(
        self,
        event_type: str,
        content: str,
        request_id: str | None,
        meta: AgentEventMeta | None = None,
    ) -> None:
        """Build and send an AgentEvent message."""
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
