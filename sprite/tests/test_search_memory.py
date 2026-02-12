"""Tests for search_memory tool — FTS5 search across learnings in memory.db."""

from __future__ import annotations

import time

import pytest

from src.database import MemoryDB
from src.tools.memory import create_memory_tools


@pytest.fixture
async def memory_db(tmp_path):
    path = str(tmp_path / "memory.db")
    db = MemoryDB(db_path=path)
    await db.connect()
    yield db
    await db.close()


@pytest.fixture
async def seeded_db(memory_db):
    """MemoryDB with test learnings inserted."""
    now = time.time()
    rows = [
        (now - 300, "sess-1", "FACT", "User prefers dark mode for all interfaces", 1, 0.9),
        (now - 200, "sess-1", "PREFERENCE", "Dates should be DD/MM/YYYY format", 2, 0.95),
        (now - 100, "sess-2", "WORKFLOW", "Always export CSV with semicolons", 3, 0.8),
        (now, "sess-2", "FACT", "Company uses Xero for accounting", 4, 0.85),
    ]
    for r in rows:
        await memory_db.execute(
            "INSERT INTO learnings (created_at, session_id, type, content, source_observation_id, confidence) "
            "VALUES (?, ?, ?, ?, ?, ?)", r,
        )
    return memory_db


@pytest.fixture
def tools(seeded_db):
    return create_memory_tools(seeded_db)


# -- Test: search_memory returns matching learnings ranked by relevance ------

async def test_search_returns_matching_results(tools):
    search = tools[0].handler
    result = await search({"query": "dark mode"})
    assert "is_error" not in result
    text = result["content"][0]["text"]
    assert "dark mode" in text.lower()


async def test_search_no_results(tools):
    search = tools[0].handler
    result = await search({"query": "nonexistent quantum flux capacitor"})
    assert "is_error" not in result
    text = result["content"][0]["text"]
    assert "no learnings found" in text.lower()


async def test_search_respects_limit(tools):
    search = tools[0].handler
    result = await search({"query": "sess", "limit": 1})
    # Should not error even with tight limit
    assert "is_error" not in result


# -- Test: Results include type, content, and date ---------------------------

async def test_results_include_type_content_date(tools):
    search = tools[0].handler
    result = await search({"query": "dark mode"})
    text = result["content"][0]["text"]
    assert "FACT" in text
    assert "dark mode" in text.lower()
    # Date should be present (ISO format or similar)
    assert "20" in text  # Year prefix from formatted date


# -- Test: No write tools exposed --------------------------------------------

async def test_only_search_tool_exposed(seeded_db):
    tools = create_memory_tools(seeded_db)
    assert len(tools) == 1
    # The single tool should be search_memory
    assert tools[0].name == "search_memory"


# -- Test: Empty query returns recent learnings ------------------------------

async def test_empty_query_returns_recent(tools):
    search = tools[0].handler
    result = await search({"query": ""})
    assert "is_error" not in result
    text = result["content"][0]["text"]
    # Most recent learning should appear first
    assert "Xero" in text


async def test_empty_query_respects_limit(seeded_db):
    tools = create_memory_tools(seeded_db)
    search = tools[0].handler
    result = await search({"query": "", "limit": 2})
    assert "is_error" not in result
    text = result["content"][0]["text"]
    # Should have at most 2 results
    lines = [l for l in text.strip().split("\n") if l.startswith("- [")]
    assert len(lines) <= 2
