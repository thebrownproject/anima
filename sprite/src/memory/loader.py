"""Memory loader — assembles system prompt from 6 memory files + pending actions."""

from __future__ import annotations

from pathlib import Path

from . import ALL_MEMORY_FILES

# Map filename stem to section header
_SECTION_HEADERS = {
    "soul": "## Soul",
    "os": "## System",
    "tools": "## Tools",
    "files": "## Files",
    "user": "## User",
    "context": "## Context",
}


def _read_safe(path: Path) -> str:
    try:
        return path.read_text().strip()
    except FileNotFoundError:
        return ""


async def _load_pending_actions(memory_db) -> str:
    rows = await memory_db.fetchall(
        "SELECT content, priority FROM pending_actions WHERE status = 'pending' ORDER BY priority DESC"
    )
    if not rows:
        return ""
    lines = [f"- [{r['priority']}] {r['content']}" for r in rows]
    return "\n".join(lines)


async def load(memory_db=None) -> str:
    """Load memory context into structured system prompt.

    Reads 6 memory files from .os/memory/ and pending actions from memory.db.
    Omits empty sections. Returns formatted string for system prompt injection.
    """
    sections: list[str] = []

    for path in ALL_MEMORY_FILES:
        content = _read_safe(path)
        if not content:
            continue
        header = _SECTION_HEADERS.get(path.stem, f"## {path.stem.title()}")
        sections.append(f"{header}\n\n{content}")

    if memory_db is not None:
        actions = await _load_pending_actions(memory_db)
        if actions:
            sections.append(f"## Pending Actions\n\n{actions}")

    return "\n\n---\n\n".join(sections) if sections else ""
