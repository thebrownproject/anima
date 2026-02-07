"""AgentRuntime -- wraps Claude Agent SDK, streams events as WebSocket messages."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Callable, Awaitable

from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ResultMessage,
    create_sdk_mcp_server,
)

from .protocol import AgentEvent, AgentEventPayload, AgentEventMeta, to_json
from .database import Database
from .agents.shared.canvas_tools import create_canvas_tools

logger = logging.getLogger(__name__)

SendFn = Callable[[str], Awaitable[None]]

SOUL_MD_PATH = "/workspace/memory/soul.md"
MAX_TURNS = 15

DEFAULT_SYSTEM_PROMPT = (
    "You are a document intelligence agent running on a personal AI computer. "
    "You have full access to Bash, Read, Write, Edit, Grep, Glob, and WebSearch tools. "
    "Help the user extract, organize, and analyze documents in their workspace. "
    "Files are stored in /workspace/documents/ and OCR text in /workspace/ocr/."
)


def _load_system_prompt() -> str:
    """Read soul.md if it exists, otherwise return default prompt."""
    try:
        return Path(SOUL_MD_PATH).read_text()
    except FileNotFoundError:
        return DEFAULT_SYSTEM_PROMPT


class AgentRuntime:
    """Invokes Claude Agent SDK and streams AgentEvent messages via send_fn.

    Mission serialization is handled by the gateway's mission_lock.
    """

    def __init__(self, send_fn: SendFn, db: Database) -> None:
        self._send = send_fn
        self._db = db
        self.last_session_id: str | None = None

    async def run_mission(
        self,
        text: str,
        request_id: str | None = None,
        attachments: list[str] | None = None,
    ) -> None:
        """Run a new agent mission, streaming events to the browser."""
        system_prompt = _load_system_prompt()

        # Create canvas tools and register via MCP server
        canvas_tools = create_canvas_tools(self._send)
        sprite_server = create_sdk_mcp_server(name="sprite", tools=canvas_tools)

        options = ClaudeAgentOptions(
            system_prompt=system_prompt,
            max_turns=MAX_TURNS,
            permission_mode="bypassPermissions",
            cwd="/workspace",
            mcp_servers={"sprite": sprite_server},
        )
        await self._invoke(text, options, request_id)

    async def resume_mission(
        self,
        text: str,
        session_id: str,
        request_id: str | None = None,
    ) -> None:
        """Resume a previous session for corrections."""
        options = ClaudeAgentOptions(
            resume=session_id,
            max_turns=MAX_TURNS,
        )
        await self._invoke(text, options, request_id)

    async def _invoke(
        self,
        prompt: str,
        options: ClaudeAgentOptions,
        request_id: str | None,
    ) -> None:
        """Core invocation loop: query SDK, map events, send over WS."""
        try:
            async with ClaudeSDKClient(options=options) as client:
                await client.query(prompt)
                async for message in client.receive_response():
                    await self._handle_message(message, request_id)
        except Exception as exc:
            logger.error("Agent error: %s", exc)
            await self._send_event("error", str(exc), request_id)

    async def _handle_message(self, message: object, request_id: str | None) -> None:
        """Map a single SDK message to AgentEvent(s) and send."""
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    await self._send_event("text", block.text, request_id)
                elif isinstance(block, ToolUseBlock):
                    content = json.dumps({"tool": block.name, "input": block.input})
                    await self._send_event("tool", content, request_id)
                # ThinkingBlock and other types silently skipped

        elif isinstance(message, ResultMessage):
            self.last_session_id = message.session_id
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
