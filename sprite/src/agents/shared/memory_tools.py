"""Memory tools for agent — write to memory files."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from claude_agent_sdk import tool

logger = logging.getLogger(__name__)

MEMORY_DIR = Path("/workspace/memory")
USER_MD = MEMORY_DIR / "user.md"
MEMORY_MD = MEMORY_DIR / "MEMORY.md"

# soul.md is developer-controlled (deployed from repo, not agent-writable)
ALLOWED_FILES = {"user.md", "MEMORY.md"}


async def _write_file(path: Path, label: str, content: str) -> dict:
    """Shared write logic — validates content, writes file, returns tool response."""
    if not content:
        return {
            "content": [{"type": "text", "text": "content parameter is required"}],
            "is_error": True,
        }

    def _write() -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

    try:
        await asyncio.to_thread(_write)
        logger.info(f"Updated {label} ({len(content)} chars)")
    except Exception as e:
        logger.error(f"Failed to update {label}: {e}")
        return {
            "content": [{"type": "text", "text": f"File write error: {str(e)}"}],
            "is_error": True,
        }

    return {
        "content": [
            {"type": "text", "text": f"Updated {label} ({len(content)} characters)"}
        ]
    }


def create_memory_tools() -> list:
    """Create memory tools for agent to persist learning."""

    @tool(
        "write_memory",
        "Write to a specific memory file (user.md or MEMORY.md). soul.md is read-only.",
        {"file": str, "content": str},
    )
    async def write_memory(_args: dict) -> dict:
        """Write content to specified memory file."""
        file = _args.get("file", "").strip()
        content = _args.get("content", "")

        if not file:
            return {
                "content": [{"type": "text", "text": "file parameter is required"}],
                "is_error": True,
            }

        if file not in ALLOWED_FILES:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"file must be one of: {', '.join(ALLOWED_FILES)}",
                    }
                ],
                "is_error": True,
            }

        return await _write_file(MEMORY_DIR / file, file, content)

    @tool(
        "update_user_prefs",
        "Update user.md (user preferences and learned patterns)",
        {"content": str},
    )
    async def update_user_prefs(_args: dict) -> dict:
        """Update user.md with new preferences."""
        return await _write_file(USER_MD, "user.md", _args.get("content", ""))

    return [write_memory, update_user_prefs]
