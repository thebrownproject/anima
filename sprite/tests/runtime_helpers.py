"""Test helpers for AgentRuntime -- legacy mission methods extracted from runtime.py.

WARNING: TEST-ONLY HELPERS. DO NOT IMPORT FROM PRODUCTION CODE.

These were removed from AgentRuntime to keep the production class focused on
handle_message() (persistent multi-turn sessions). Tests that need the old
one-shot behavior can import these standalone functions.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.runtime import AgentRuntime

logger = logging.getLogger(__name__)


async def run_mission(
    runtime: AgentRuntime,
    text: str,
    request_id: str | None = None,
    attachments: list[str] | None = None,
) -> None:
    """Run a new agent mission (creates fresh client each time).

    This is the legacy single-shot mission pattern from v1. For production
    multi-turn conversations, use runtime.handle_message() instead.

    Args:
        runtime: AgentRuntime instance to use
        text: User message text
        request_id: Optional request ID for event correlation
        attachments: Optional file paths (not yet implemented)
    """
    # Import here to avoid circular dependencies and claude_agent_sdk import at module level
    from claude_agent_sdk import ClaudeSDKClient, create_sdk_mcp_server
    from src.memory.loader import load as load_memory
    from src.tools.canvas import create_canvas_tools
    from src.tools.memory import create_memory_tools

    system_prompt = await load_memory(runtime._memory_db)

    canvas_tools = create_canvas_tools(runtime._indirect_send)
    memory_tools = create_memory_tools(runtime._memory_db) if runtime._memory_db else []
    sprite_server = create_sdk_mcp_server(
        name="sprite", tools=canvas_tools + memory_tools
    )

    options = runtime._build_options(
        system_prompt=system_prompt,
        mcp_servers={"sprite": sprite_server},
    )
    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(text)
            async for message in client.receive_response():
                await runtime._handle_sdk_message(message, request_id)
    except Exception as exc:
        logger.error("Agent error: %s", exc)
        await runtime._send_event("error", str(exc), request_id)


async def resume_mission(
    runtime: AgentRuntime,
    text: str,
    session_id: str,
    request_id: str | None = None,
) -> None:
    """Resume a previous session (legacy — uses resume parameter).

    This is the legacy session resume pattern from v1. For production multi-turn
    conversations, use runtime.handle_message() which keeps the client alive.

    Args:
        runtime: AgentRuntime instance to use
        text: User message text
        session_id: SDK session ID to resume
        request_id: Optional request ID for event correlation
    """
    # Import here to avoid circular dependencies and claude_agent_sdk import at module level
    from claude_agent_sdk import ClaudeSDKClient, create_sdk_mcp_server
    from src.tools.canvas import create_canvas_tools
    from src.tools.memory import create_memory_tools

    canvas_tools = create_canvas_tools(runtime._indirect_send)
    memory_tools = create_memory_tools(runtime._memory_db) if runtime._memory_db else []
    sprite_server = create_sdk_mcp_server(
        name="sprite", tools=canvas_tools + memory_tools
    )

    options = runtime._build_options(
        resume=session_id,
        mcp_servers={"sprite": sprite_server},
    )
    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(text)
            async for message in client.receive_response():
                await runtime._handle_sdk_message(message, request_id)
    except Exception as exc:
        logger.warning("Resume failed (%s), falling back to new mission", exc)
        runtime.last_session_id = None
        await run_mission(runtime, text, request_id=request_id)
