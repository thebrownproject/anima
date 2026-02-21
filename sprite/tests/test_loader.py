"""Tests for memory/loader.py -- system prompt assembly and size bounding."""

from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from src.memory.loader import load, _enforce_size_limit, _SECTION_HEADERS, MAX_PROMPT_BYTES, SEPARATOR


@pytest.fixture
def memory_dir(tmp_path, monkeypatch):
    """Patch ALL_MEMORY_FILES to use temp directory."""
    import src.memory as mem
    import src.memory.loader as loader_mod

    files = {}
    patched_all = []
    patched_daemon = []
    for orig_path in mem.ALL_MEMORY_FILES:
        new_path = tmp_path / orig_path.name
        patched_all.append(new_path)
        files[orig_path.stem] = new_path
        if orig_path in mem.DAEMON_MANAGED_FILES:
            patched_daemon.append(new_path)

    monkeypatch.setattr(mem, "ALL_MEMORY_FILES", patched_all)
    monkeypatch.setattr(loader_mod, "ALL_MEMORY_FILES", patched_all)
    monkeypatch.setattr(mem, "DAEMON_MANAGED_FILES", patched_daemon)
    monkeypatch.setattr(loader_mod, "DAEMON_MANAGED_FILES", patched_daemon)

    # Patch read_safe in the loader module to use real filesystem
    original_read_safe = mem.read_safe
    monkeypatch.setattr(loader_mod, "read_safe", original_read_safe)

    return files


async def test_load_empty_files(memory_dir):
    """No files written = empty prompt."""
    result = await load()
    assert result == ""


async def test_load_with_content(memory_dir):
    """Files with content produce formatted sections."""
    memory_dir["soul"].write_text("Identity info")
    memory_dir["os"].write_text("System rules")

    result = await load()
    assert "## Soul" in result
    assert "Identity info" in result
    assert "## System" in result
    assert "System rules" in result


async def test_load_omits_empty_sections(memory_dir):
    """Empty files are omitted from output."""
    memory_dir["soul"].write_text("Identity info")
    # tools.md not written (empty)

    result = await load()
    assert "## Soul" in result
    assert "## Tools" not in result


async def test_load_includes_pending_actions(memory_dir):
    """Pending actions from memory_db are included."""
    memory_dir["soul"].write_text("Identity")

    mock_db = AsyncMock()
    mock_db.fetchall = AsyncMock(return_value=[
        {"content": "Follow up with user", "priority": 1},
    ])

    result = await load(memory_db=mock_db)
    assert "## Pending Actions" in result
    assert "Follow up with user" in result


async def test_size_limit_under_threshold(memory_dir):
    """Small prompt passes through without truncation."""
    memory_dir["soul"].write_text("Short soul")
    memory_dir["os"].write_text("Short os")
    memory_dir["tools"].write_text("Short tools")

    result = await load()
    assert "[truncated]" not in result
    assert len(result.encode("utf-8")) < MAX_PROMPT_BYTES


async def test_size_limit_truncates_daemon_files(memory_dir):
    """Large daemon-managed files get truncated to stay under 50KB."""
    memory_dir["soul"].write_text("Soul content")
    memory_dir["os"].write_text("OS content")
    # Write large daemon-managed files (20KB each = 80KB total, over 50KB limit)
    large_content = "x" * 20_000
    memory_dir["tools"].write_text(large_content)
    memory_dir["files"].write_text(large_content)
    memory_dir["user"].write_text(large_content)
    memory_dir["context"].write_text(large_content)

    result = await load()
    result_bytes = len(result.encode("utf-8"))
    assert result_bytes <= MAX_PROMPT_BYTES
    # Soul and OS should be preserved fully
    assert "Soul content" in result
    assert "OS content" in result


async def test_size_limit_preserves_deploy_managed(memory_dir):
    """Deploy-managed files (soul, os) are never truncated."""
    soul_content = "S" * 10_000
    os_content = "O" * 10_000
    memory_dir["soul"].write_text(soul_content)
    memory_dir["os"].write_text(os_content)
    memory_dir["context"].write_text("C" * 40_000)

    result = await load()
    assert soul_content in result
    assert os_content in result


async def test_size_limit_truncation_order(memory_dir):
    """Context is truncated first (least critical), tools last."""
    memory_dir["soul"].write_text("soul")
    memory_dir["tools"].write_text("TOOLS_MARKER " + "t" * 15_000)
    memory_dir["context"].write_text("CONTEXT_MARKER " + "c" * 30_000)

    result = await load()
    # Tools content should be more preserved than context
    assert "TOOLS_MARKER" in result
    # Context was truncated first since it's least critical
    if "[truncated]" in result:
        # Find positions -- truncated marker should appear after context header
        context_pos = result.find("## Context")
        if context_pos >= 0:
            truncated_pos = result.find("[truncated]", context_pos)
            assert truncated_pos > context_pos


def test_enforce_size_limit_noop_when_small():
    """No truncation when under limit."""
    from src.memory import ALL_MEMORY_FILES
    sections = {"soul": "## Soul\n\nSmall", "os": "## System\n\nSmall"}
    result = _enforce_size_limit(sections, MAX_PROMPT_BYTES)
    assert len(result) == 2
    assert all("[truncated]" not in s for s in result)
