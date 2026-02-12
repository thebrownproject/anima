"""Read-only memory search tool — FTS5 search across learnings in memory.db."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from claude_agent_sdk import tool

from ..database import MemoryDB

logger = logging.getLogger(__name__)

FTS_QUERY = (
    "SELECT l.type, l.content, l.created_at "
    "FROM learnings l "
    "JOIN learnings_fts f ON l.id = f.rowid "
    "WHERE learnings_fts MATCH ? "
    "LIMIT ?"
)

RECENT_QUERY = (
    "SELECT type, content, created_at "
    "FROM learnings "
    "ORDER BY created_at DESC "
    "LIMIT ?"
)


def _format_results(rows: list[dict]) -> str:
    if not rows:
        return "No learnings found."
    lines = []
    for r in rows:
        ts = r["created_at"]
        date_str = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d") if ts else "unknown"
        lines.append(f"- [{r['type']}] {r['content']} ({date_str})")
    return "\n".join(lines)


def create_memory_tools(memory_db: MemoryDB) -> list:
    """Create read-only memory tools. Returns list with single search_memory tool."""

    @tool(
        "search_memory",
        "Search historical learnings in memory. Returns matching learnings ranked by relevance. "
        "Pass an empty query to browse recent learnings.",
        {"query": str, "limit": int},
    )
    async def search_memory(_args: dict) -> dict:
        query = _args.get("query", "").strip()
        limit = min(_args.get("limit", 10), 100)

        try:
            if query:
                rows = await memory_db.fetchall(FTS_QUERY, (query, limit))
            else:
                rows = await memory_db.fetchall(RECENT_QUERY, (limit,))
        except Exception as e:
            logger.error("search_memory failed: %s", e)
            return {
                "content": [{"type": "text", "text": f"Search error: {e}"}],
                "is_error": True,
            }

        return {"content": [{"type": "text", "text": _format_results(rows)}]}

    return [search_memory]
