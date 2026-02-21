"""SDK hook callbacks and TurnBuffer for observation capture.

Hooks buffer data during an agent turn, then write one observation row
to TranscriptDB on Stop. PreCompact triggers emergency memory flush.
All hooks return {} (passthrough) and never raise.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

TOOL_RESPONSE_MAX = 2000
DEFAULT_BATCH_THRESHOLD = 10


class TurnBuffer:
    """Accumulates user_message, tool_calls, and agent_response during one turn."""

    __slots__ = ("user_message", "tool_calls", "agent_response")

    def __init__(self) -> None:
        self.user_message: str | None = None
        self.tool_calls: list[dict[str, Any]] = []
        self.agent_response: str = ""

    def set_user_message(self, text: str) -> None:
        self.user_message = text

    def append_tool_call(self, name: str, input_data: Any, response: str) -> None:
        self.tool_calls.append({
            "tool": name,
            "input": input_data,
            "response": response[:TOOL_RESPONSE_MAX],
        })

    def append_agent_response(self, text: str) -> None:
        self.agent_response += text

    def clear(self) -> None:
        self.user_message = None
        self.tool_calls = []
        self.agent_response = ""

    def snapshot(self) -> dict[str, Any]:
        return {
            "user_message": self.user_message,
            "tool_calls": list(self.tool_calls),
            "agent_response": self.agent_response,
        }


def create_hook_callbacks(
    transcript_db: Any,
    processor: Any,
    buffer: TurnBuffer,
    batch_threshold: int = DEFAULT_BATCH_THRESHOLD,
) -> dict[str, Any]:
    """Build hook callback functions closed over shared state.

    Returns a dict of named callbacks. runtime.py maps these into
    ClaudeAgentOptions hooks with HookMatcher.
    """
    sequence_num = 0

    async def on_user_prompt_submit(input_data, tool_use_id, context) -> dict:
        try:
            buffer.set_user_message(input_data.get("prompt", ""))
        except Exception:
            logger.exception("Hook error: user_prompt_submit")
        return {}

    async def on_post_tool_use(input_data, tool_use_id, context) -> dict:
        try:
            buffer.append_tool_call(
                input_data.get("tool_name", ""),
                input_data.get("tool_input", {}),
                str(input_data.get("tool_response", "")),
            )
        except Exception:
            logger.exception("Hook error: post_tool_use")
        return {}

    async def on_stop(input_data, tool_use_id, context) -> dict:
        nonlocal sequence_num
        try:
            sequence_num += 1
            snap = buffer.snapshot()
            await transcript_db.execute(
                "INSERT INTO observations "
                "(timestamp, sequence_num, user_message, tool_calls_json, agent_response) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    time.time(),
                    sequence_num,
                    snap["user_message"],
                    json.dumps(snap["tool_calls"]),
                    snap["agent_response"],
                ),
            )
            buffer.clear()
            # Prune old processed observations to keep table bounded
            await transcript_db.prune_observations()
            # Count unprocessed observations from DB (survives process restarts)
            row = await transcript_db.fetchone(
                "SELECT COUNT(*) as c FROM observations WHERE processed = 0"
            )
            unprocessed = row["c"] if row else 0
            if unprocessed >= batch_threshold:
                await processor.flush_all()
        except Exception:
            logger.exception("Hook error: stop")
        return {}

    async def on_pre_compact(input_data, tool_use_id, context) -> dict:
        try:
            await processor.flush_all()
        except Exception:
            logger.exception("Hook error: pre_compact")
        return {}

    return {
        "on_user_prompt_submit": on_user_prompt_submit,
        "on_post_tool_use": on_post_tool_use,
        "on_stop": on_stop,
        "on_pre_compact": on_pre_compact,
    }
