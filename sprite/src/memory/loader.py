"""Memory loader -- assembles system prompt from 6 memory files + pending actions."""

from __future__ import annotations

import logging

from . import ALL_MEMORY_FILES, DAEMON_MANAGED_FILES, read_safe

logger = logging.getLogger(__name__)

MAX_PROMPT_BYTES = 50 * 1024  # 50KB cap
SEPARATOR = "\n\n---\n\n"

# Map filename stem to section header
_SECTION_HEADERS = {
    "soul": "## Soul",
    "os": "## System",
    "tools": "## Tools",
    "files": "## Files",
    "user": "## User",
    "context": "## Context",
}

# Truncation priority: context first (least critical), then user, files, tools
_TRUNCATION_ORDER = ["context", "user", "files", "tools"]


async def _load_pending_actions(memory_db) -> str:
    rows = await memory_db.fetchall(
        "SELECT content, priority FROM pending_actions WHERE status = 'pending' ORDER BY priority DESC"
    )
    if not rows:
        return ""
    lines = [f"- [{r['priority']}] {r['content']}" for r in rows]
    return "\n".join(lines)


def _enforce_size_limit(sections: dict[str, str], limit: int) -> list[str]:
    """Truncate daemon-managed sections to keep total under limit.

    Preserves deploy-managed sections (soul, os) fully. Truncates daemon-managed
    sections from least critical (context) to most critical (tools).
    Returns ordered list of formatted section strings.
    """
    ordered_keys = [p.stem for p in ALL_MEMORY_FILES]
    # Add pending_actions if present
    if "pending_actions" in sections:
        ordered_keys.append("pending_actions")

    def _total() -> int:
        parts = [sections[k] for k in ordered_keys if k in sections]
        return len(SEPARATOR.join(parts).encode("utf-8"))

    if _total() <= limit:
        return [sections[k] for k in ordered_keys if k in sections]

    # Truncate daemon-managed sections in priority order
    for stem in _TRUNCATION_ORDER:
        if stem not in sections:
            continue
        header_line = _SECTION_HEADERS.get(stem, f"## {stem.title()}")
        # Try trimming content progressively (halve each round)
        header_prefix = f"{header_line}\n\n"
        body = sections[stem][len(header_prefix):]
        while _total() > limit and body:
            body = body[: len(body) // 2]
            if body:
                sections[stem] = f"{header_prefix}{body}\n[truncated]"
            else:
                del sections[stem]
                break

        if _total() <= limit:
            break

    if _total() > limit:
        logger.warning("System prompt still over %dKB after truncation", limit // 1024)

    return [sections[k] for k in ordered_keys if k in sections]


async def load(memory_db=None) -> str:
    """Load memory context into structured system prompt.

    Reads 6 memory files from .os/memory/ and pending actions from memory.db.
    Omits empty sections. Caps total output at 50KB by truncating daemon-managed
    files (context, user, files, tools) from least to most critical.
    """
    sections: dict[str, str] = {}

    for path in ALL_MEMORY_FILES:
        content = read_safe(path)
        if not content:
            continue
        header = _SECTION_HEADERS.get(path.stem, f"## {path.stem.title()}")
        sections[path.stem] = f"{header}\n\n{content}"

    if memory_db is not None:
        actions = await _load_pending_actions(memory_db)
        if actions:
            sections["pending_actions"] = f"## Pending Actions\n\n{actions}"

    if not sections:
        return ""

    ordered = _enforce_size_limit(sections, MAX_PROMPT_BYTES)
    return SEPARATOR.join(ordered)
