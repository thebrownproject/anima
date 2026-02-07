"""Memory tools for agent — write to memory files."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from claude_agent_sdk import tool

logger = logging.getLogger(__name__)

MEMORY_DIR = Path("/workspace/memory")
SOUL_MD = MEMORY_DIR / "soul.md"
USER_MD = MEMORY_DIR / "user.md"
MEMORY_MD = MEMORY_DIR / "MEMORY.md"

ALLOWED_FILES = {"soul.md", "user.md", "MEMORY.md"}


def create_memory_tools() -> list:
    """Create memory tools for agent to persist learning."""

    @tool(
        "write_memory",
        "Write to a specific memory file (soul.md, user.md, or MEMORY.md)",
        {
            "file": str,
            "content": str,
        },
    )
    async def write_memory(_args: dict) -> dict:
        """Write content to specified memory file."""
        file = _args.get("file", "").strip()
        content = _args.get("content", "")

        # Validate file
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

        # Validate content
        if not content:
            return {
                "content": [{"type": "text", "text": "content parameter is required"}],
                "is_error": True,
            }

        # Write to file
        file_path = MEMORY_DIR / file

        def _write() -> None:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content)

        try:
            await asyncio.to_thread(_write)
            logger.info(f"Wrote to {file} ({len(content)} chars)")
        except Exception as e:
            logger.error(f"Failed to write {file}: {e}")
            return {
                "content": [{"type": "text", "text": f"File write error: {str(e)}"}],
                "is_error": True,
            }

        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Updated {file} ({len(content)} characters)",
                }
            ]
        }

    @tool(
        "update_soul",
        "Update soul.md (stack identity and extraction rules)",
        {
            "content": str,
        },
    )
    async def update_soul(_args: dict) -> dict:
        """Update soul.md with new content."""
        content = _args.get("content", "")

        # Validate content
        if not content:
            return {
                "content": [{"type": "text", "text": "content parameter is required"}],
                "is_error": True,
            }

        # Write to soul.md
        def _write() -> None:
            SOUL_MD.parent.mkdir(parents=True, exist_ok=True)
            SOUL_MD.write_text(content)

        try:
            await asyncio.to_thread(_write)
            logger.info(f"Updated soul.md ({len(content)} chars)")
        except Exception as e:
            logger.error(f"Failed to update soul.md: {e}")
            return {
                "content": [{"type": "text", "text": f"File write error: {str(e)}"}],
                "is_error": True,
            }

        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Updated soul.md ({len(content)} characters)",
                }
            ]
        }

    @tool(
        "update_user_prefs",
        "Update user.md (user preferences and learned patterns)",
        {
            "content": str,
        },
    )
    async def update_user_prefs(_args: dict) -> dict:
        """Update user.md with new preferences."""
        content = _args.get("content", "")

        # Validate content
        if not content:
            return {
                "content": [{"type": "text", "text": "content parameter is required"}],
                "is_error": True,
            }

        # Write to user.md
        def _write() -> None:
            USER_MD.parent.mkdir(parents=True, exist_ok=True)
            USER_MD.write_text(content)

        try:
            await asyncio.to_thread(_write)
            logger.info(f"Updated user.md ({len(content)} chars)")
        except Exception as e:
            logger.error(f"Failed to update user.md: {e}")
            return {
                "content": [{"type": "text", "text": f"File write error: {str(e)}"}],
                "is_error": True,
            }

        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Updated user.md ({len(content)} characters)",
                }
            ]
        }

    return [write_memory, update_soul, update_user_prefs]
