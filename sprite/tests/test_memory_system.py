#!/usr/bin/env python3
"""Tests for memory system — templates, path constants, ensure_templates, loader, journal, transcript."""

import asyncio
import json
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Setup test workspace
TEST_WORKSPACE = Path(tempfile.mkdtemp(prefix="sprite_test_"))
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Mock /workspace/ paths to test directory
import src.memory as memory_module

memory_module.MEMORY_DIR = TEST_WORKSPACE / "memory"
memory_module.SOUL_MD = memory_module.MEMORY_DIR / "soul.md"
memory_module.OS_MD = memory_module.MEMORY_DIR / "os.md"
memory_module.TOOLS_MD = memory_module.MEMORY_DIR / "tools.md"
memory_module.FILES_MD = memory_module.MEMORY_DIR / "files.md"
memory_module.USER_MD = memory_module.MEMORY_DIR / "user.md"
memory_module.CONTEXT_MD = memory_module.MEMORY_DIR / "context.md"
memory_module.ALL_MEMORY_FILES = [
    memory_module.SOUL_MD, memory_module.OS_MD,
    memory_module.TOOLS_MD, memory_module.FILES_MD,
    memory_module.USER_MD, memory_module.CONTEXT_MD,
]
memory_module.DAEMON_MANAGED_FILES = [
    memory_module.TOOLS_MD, memory_module.FILES_MD,
    memory_module.USER_MD, memory_module.CONTEXT_MD,
]

import src.memory.loader as loader_module

loader_module.ALL_MEMORY_FILES = memory_module.ALL_MEMORY_FILES

import src.memory.journal as journal_module

journal_module.MEMORY_DIR = memory_module.MEMORY_DIR

import src.memory.transcript as transcript_module

transcript_module.TRANSCRIPTS_DIR = TEST_WORKSPACE / "transcripts"

from src.memory import ensure_templates
from src.memory.loader import load
from src.memory.journal import append_journal
from src.memory.transcript import TranscriptLogger

REPO_MEMORY_DIR = Path(__file__).parent.parent / "memory"


# -- Template file tests --

async def test_all_templates_exist():
    """All 6 memory file templates exist in sprite/memory/."""
    print("Test 1: All 6 template files exist in repo...")

    expected = ["soul.md", "os.md", "tools.md", "files.md", "user.md", "context.md"]
    for name in expected:
        path = REPO_MEMORY_DIR / name
        assert path.exists(), f"Missing template: {path}"
        content = path.read_text()
        assert len(content.strip()) > 0, f"Template is empty: {name}"

    print("  All 6 templates exist with content")


async def test_line_limits():
    """All templates within spec line limits."""
    print("Test 2: Line limits...")

    limits = {
        "soul.md": 200,
        "os.md": 200,
        "tools.md": 150,
        "files.md": 200,
        "user.md": 200,
        "context.md": 200,
    }
    for name, limit in limits.items():
        path = REPO_MEMORY_DIR / name
        lines = path.read_text().count("\n") + 1
        assert lines <= limit, f"{name} has {lines} lines, limit is {limit}"
        print(f"  {name}: {lines}/{limit} lines")

    print("  All within limits")


async def test_soul_md_no_canvas_or_tools():
    """soul.md is personality-only — no Canvas guidance or tool docs."""
    print("Test 3: soul.md is personality-only...")

    content = (REPO_MEMORY_DIR / "soul.md").read_text().lower()
    assert "canvas" not in content, "soul.md should not contain Canvas guidance (moved to os.md)"
    assert "create_card" not in content, "soul.md should not contain tool docs (moved to tools.md)"
    assert "block type" not in content, "soul.md should not contain block types (moved to os.md/tools.md)"

    print("  No Canvas or tool content in soul.md")


async def test_os_md_has_canvas():
    """os.md contains Canvas guidance (moved from old soul.md)."""
    print("Test 4: os.md has Canvas guidance...")

    content = (REPO_MEMORY_DIR / "os.md").read_text().lower()
    assert "canvas" in content, "os.md should contain Canvas guidance"
    assert "card size" in content or "small" in content, "os.md should describe card sizes"

    print("  Canvas guidance present in os.md")


async def test_tools_md_documents_canvas_tools():
    """tools.md documents canvas tools accurately."""
    print("Test 5: tools.md documents canvas tools...")

    content = (REPO_MEMORY_DIR / "tools.md").read_text()
    assert "create_card" in content, "tools.md must document create_card"
    assert "update_card" in content, "tools.md must document update_card"
    assert "close_card" in content, "tools.md must document close_card"
    # Block types from canvas_tools.py
    for block_type in ["heading", "stat", "key-value", "table", "badge", "progress", "text", "separator"]:
        assert block_type in content, f"tools.md must document block type: {block_type}"
    # SDK tools
    for tool_name in ["Bash", "Read", "Write", "Edit", "Grep", "Glob"]:
        assert tool_name in content, f"tools.md must document SDK tool: {tool_name}"

    print("  All canvas tools and block types documented")


async def test_daemon_managed_have_sections():
    """Daemon-managed files have structured section headers."""
    print("Test 6: Daemon-managed files have section headers...")

    for name in ["files.md", "user.md", "context.md"]:
        content = (REPO_MEMORY_DIR / name).read_text()
        assert content.startswith("#"), f"{name} should start with a heading"
        assert "##" in content, f"{name} should have section headers"

    print("  All daemon-managed files have structured sections")


# -- Path constant tests --

async def test_path_constants():
    """__init__.py exports correct path constants."""
    print("Test 7: Path constants...")

    assert memory_module.SOUL_MD.name == "soul.md"
    assert memory_module.OS_MD.name == "os.md"
    assert memory_module.TOOLS_MD.name == "tools.md"
    assert memory_module.FILES_MD.name == "files.md"
    assert memory_module.USER_MD.name == "user.md"
    assert memory_module.CONTEXT_MD.name == "context.md"
    assert len(memory_module.ALL_MEMORY_FILES) == 6
    assert len(memory_module.DAEMON_MANAGED_FILES) == 4

    print("  All 6 path constants + collection exports correct")


# -- ensure_templates tests --

async def test_ensure_templates_creates_daemon_files():
    """ensure_templates creates daemon-managed files only."""
    print("Test 8: ensure_templates creates daemon-managed files...")

    ensure_templates()

    # Deploy-managed files NOT created
    assert not memory_module.SOUL_MD.exists(), "soul.md should NOT be created by ensure_templates()"
    assert not memory_module.OS_MD.exists(), "os.md should NOT be created by ensure_templates()"

    # Daemon-managed files created
    for path in memory_module.DAEMON_MANAGED_FILES:
        assert path.exists(), f"{path.name} should exist after ensure_templates()"

    print("  Daemon files created, deploy files untouched")


async def test_ensure_templates_no_overwrite():
    """ensure_templates doesn't overwrite existing files."""
    print("Test 9: ensure_templates doesn't overwrite...")

    custom = "# Custom\nUser-modified content"
    memory_module.USER_MD.write_text(custom)

    ensure_templates()

    assert memory_module.USER_MD.read_text() == custom, "user.md was overwritten"

    print("  Existing files preserved")


# -- Loader + journal + transcript tests (unchanged) --

async def test_loader_all_sections():
    """Loader returns all 7 sections when populated (6 files + pending actions)."""
    print("Test 10: Loader returns all 7 sections...")

    memory_module.SOUL_MD.write_text("# Soul\nAgent identity")
    memory_module.OS_MD.write_text("# System\nSystem rules")
    memory_module.TOOLS_MD.write_text("# Tools\nAvailable tools")
    memory_module.FILES_MD.write_text("# Files\nFilesystem index")
    memory_module.USER_MD.write_text("# User\nUser preferences")
    memory_module.CONTEXT_MD.write_text("# Context\nActive context")

    class MockMemoryDB:
        async def fetchall(self, sql, params=()):
            return [
                {"content": "Review uploaded invoices", "priority": 2},
                {"content": "Update user profile", "priority": 1},
            ]

    result = await load(memory_db=MockMemoryDB())

    assert "## Soul" in result
    assert "## System" in result
    assert "## Tools" in result
    assert "## Files" in result
    assert "## User" in result
    assert "## Context" in result
    assert "## Pending Actions" in result
    assert "Agent identity" in result
    assert "System rules" in result
    assert "Review uploaded invoices" in result
    assert "Update user profile" in result
    # Verify section separator
    assert "---" in result

    print("  All 7 sections present with correct headers")


async def test_loader_omits_empty_sections():
    """Loader omits empty sections cleanly."""
    print("Test 11: Loader omits empty sections...")

    # Only write soul and user, leave others empty/missing
    for path in memory_module.ALL_MEMORY_FILES:
        if path.exists():
            path.unlink()

    memory_module.SOUL_MD.write_text("# Soul\nAgent identity")
    memory_module.USER_MD.write_text("# User\nUser preferences")

    result = await load(memory_db=None)

    assert "## Soul" in result
    assert "## User" in result
    assert "## System" not in result
    assert "## Tools" not in result
    assert "## Files" not in result
    assert "## Context" not in result
    assert "## Pending Actions" not in result

    print("  Empty sections omitted correctly")


async def test_loader_reads_os_memory_paths():
    """Loader reads from .os/memory/ paths (via ALL_MEMORY_FILES)."""
    print("Test 12: Loader reads from .os/memory/ paths...")

    # ALL_MEMORY_FILES should point into the test MEMORY_DIR
    for path in loader_module.ALL_MEMORY_FILES:
        assert "memory" in str(path.parent), f"Path not under memory dir: {path}"

    memory_module.SOUL_MD.write_text("Path test content")
    result = await load()
    assert "Path test content" in result

    print("  Reads from correct paths")


async def test_loader_no_legacy_references():
    """Loader has no references to MEMORY.md or journals."""
    print("Test 13: No legacy MEMORY.md or journal references...")

    source = Path(loader_module.__file__).read_text()
    assert "MEMORY_MD" not in source, "Loader should not reference MEMORY_MD"
    assert "MEMORY.md" not in source, "Loader should not reference MEMORY.md"
    assert "journal" not in source.lower(), "Loader should not reference journals"
    assert "datetime" not in source, "Loader should not import datetime"
    assert "timedelta" not in source, "Loader should not import timedelta"

    print("  No legacy references found")


async def test_loader_no_db():
    """Loader works without memory_db (pending actions skipped)."""
    print("Test 14: Loader works without memory_db...")

    memory_module.SOUL_MD.write_text("# Soul\nTest content")

    result = await load(memory_db=None)
    assert "Test content" in result
    assert "Pending Actions" not in result

    result2 = await load()
    assert "Test content" in result2
    assert "Pending Actions" not in result2

    print("  Works without memory_db")


async def test_journal():
    """Journal appends to correct date file."""
    print("Test 15: Journal appends...")

    today = datetime.now().strftime("%Y-%m-%d")
    journal_path = memory_module.MEMORY_DIR / f"{today}.md"
    if journal_path.exists():
        journal_path.unlink()

    await append_journal("First session completed")
    assert journal_path.exists()
    await append_journal("Second session completed")
    content = journal_path.read_text()
    assert "First session completed" in content
    assert "Second session completed" in content

    print("  Journal appends correctly")


async def test_transcript():
    """Transcript logs valid JSONL."""
    print("Test 16: Transcript logs JSONL...")

    logger = TranscriptLogger(session_id="test_session_123")
    await logger.log("text", {"content": "Hello world"})
    await logger.log("tool_use", {"tool": "create_card", "input": {"title": "Test"}})
    await logger.log("complete", {"session_id": "test_session_123", "cost_usd": 0.025})

    assert logger.log_path.exists()
    lines = logger.log_path.read_text().strip().split("\n")
    assert len(lines) == 3

    for line in lines:
        data = json.loads(line)
        assert "timestamp" in data
        assert "session_id" in data
        assert "event_type" in data

    print("  Transcript logs valid JSONL")


async def main():
    """Run all tests."""
    print(f"Test workspace: {TEST_WORKSPACE}\n")

    try:
        await test_all_templates_exist()
        await test_line_limits()
        await test_soul_md_no_canvas_or_tools()
        await test_os_md_has_canvas()
        await test_tools_md_documents_canvas_tools()
        await test_daemon_managed_have_sections()
        await test_path_constants()
        await test_ensure_templates_creates_daemon_files()
        await test_ensure_templates_no_overwrite()
        await test_loader_all_sections()
        await test_loader_omits_empty_sections()
        await test_loader_reads_os_memory_paths()
        await test_loader_no_legacy_references()
        await test_loader_no_db()
        await test_journal()
        await test_transcript()

        print("\n" + "=" * 60)
        print("All 16 tests passed!")
        print("=" * 60)

    finally:
        import shutil
        shutil.rmtree(TEST_WORKSPACE)
        print(f"\nCleaned up test workspace: {TEST_WORKSPACE}")


if __name__ == "__main__":
    asyncio.run(main())
