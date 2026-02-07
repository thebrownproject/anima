#!/usr/bin/env python3
"""Local test for memory system — verifies templates, loader, journal, transcript."""

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
memory_module.USER_MD = memory_module.MEMORY_DIR / "user.md"
memory_module.MEMORY_MD = memory_module.MEMORY_DIR / "MEMORY.md"

import src.memory.loader as loader_module
loader_module.MEMORY_DIR = memory_module.MEMORY_DIR
loader_module.SOUL_MD = memory_module.SOUL_MD
loader_module.USER_MD = memory_module.USER_MD
loader_module.MEMORY_MD = memory_module.MEMORY_MD

import src.memory.journal as journal_module
journal_module.MEMORY_DIR = memory_module.MEMORY_DIR

import src.memory.transcript as transcript_module
transcript_module.TRANSCRIPTS_DIR = TEST_WORKSPACE / "transcripts"

from src.memory import ensure_templates
from src.memory.loader import load
from src.memory.journal import append_journal
from src.memory.transcript import TranscriptLogger


async def test_templates():
    """Test 1: First boot creates templates."""
    print("Test 1: Template creation on first boot...")

    ensure_templates()

    assert memory_module.SOUL_MD.exists(), "soul.md should exist after ensure_templates()"
    assert memory_module.USER_MD.exists(), "user.md should exist after ensure_templates()"
    assert memory_module.MEMORY_MD.exists(), "MEMORY.md should exist after ensure_templates()"

    print("✓ Templates created successfully")


async def test_templates_not_overwritten():
    """Test 2: Second boot doesn't overwrite existing templates."""
    print("\nTest 2: Templates not overwritten on second boot...")

    # Modify soul.md
    custom_content = "# Custom Content\n\nThis should not be overwritten."
    memory_module.SOUL_MD.write_text(custom_content)

    # Run ensure_templates again
    ensure_templates()

    # Verify content unchanged
    assert memory_module.SOUL_MD.read_text() == custom_content, "soul.md was overwritten"

    print("✓ Templates preserved on second boot")


async def test_loader():
    """Test 3: Loader returns structured prompt with all 5 sources."""
    print("\nTest 3: Loader assembles system prompt from all sources...")

    # Write test content to each file
    memory_module.SOUL_MD.write_text("# Soul\nTest soul content")
    memory_module.USER_MD.write_text("# User\nTest user content")
    memory_module.MEMORY_MD.write_text("# Memory\nTest memory content")

    # Create today's and yesterday's journals
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    (memory_module.MEMORY_DIR / f"{today}.md").write_text("Today's activities")
    (memory_module.MEMORY_DIR / f"{yesterday}.md").write_text("Yesterday's activities")

    # Load memory
    result = load()

    # Verify all 5 sources present
    assert "Test soul content" in result, "soul.md content missing"
    assert "Test user content" in result, "user.md content missing"
    assert "Test memory content" in result, "MEMORY.md content missing"
    assert "Today's activities" in result, "Today's journal missing"
    assert "Yesterday's activities" in result, "Yesterday's journal missing"
    assert "Stack Memory: soul.md" in result, "soul.md section header missing"

    print("✓ Loader assembled all 5 sources correctly")


async def test_journal():
    """Test 4: Journal appends to correct date file."""
    print("\nTest 4: Journal appends to daily file...")

    today = datetime.now().strftime("%Y-%m-%d")
    journal_path = memory_module.MEMORY_DIR / f"{today}.md"

    # Clear existing journal
    if journal_path.exists():
        journal_path.unlink()

    # Append first entry
    await append_journal("First session completed")
    assert journal_path.exists(), "Journal file not created"
    content1 = journal_path.read_text()
    assert "First session completed" in content1, "First entry not found"

    # Append second entry
    await append_journal("Second session completed")
    content2 = journal_path.read_text()
    assert "First session completed" in content2, "First entry was overwritten"
    assert "Second session completed" in content2, "Second entry not appended"

    print("✓ Journal appends correctly (not overwriting)")


async def test_transcript():
    """Test 5: Transcript logs valid JSONL."""
    print("\nTest 5: Transcript logs JSONL...")

    logger = TranscriptLogger(session_id="test_session_123")

    # Log a few events
    await logger.log("text", {"content": "Hello world"})
    await logger.log("tool_use", {"tool": "create_card", "input": {"title": "Test"}})
    await logger.log("complete", {"session_id": "test_session_123", "cost_usd": 0.025})

    # Verify JSONL file exists
    assert logger.log_path.exists(), "Transcript file not created"

    # Parse and verify JSONL
    lines = logger.log_path.read_text().strip().split("\n")
    assert len(lines) == 3, f"Expected 3 lines, got {len(lines)}"

    for line in lines:
        data = json.loads(line)  # Should not raise JSONDecodeError
        assert "timestamp" in data, "timestamp missing"
        assert "session_id" in data, "session_id missing"
        assert "event_type" in data, "event_type missing"

    # Verify first entry
    first = json.loads(lines[0])
    assert first["event_type"] == "text", "First event type wrong"
    assert first["content"] == "Hello world", "First event content wrong"

    print("✓ Transcript logs valid JSONL")


async def main():
    """Run all tests."""
    print(f"Test workspace: {TEST_WORKSPACE}\n")

    try:
        await test_templates()
        await test_templates_not_overwritten()
        await test_loader()
        await test_journal()
        await test_transcript()

        print("\n" + "=" * 60)
        print("All tests passed! ✓")
        print("=" * 60)

    finally:
        # Cleanup
        import shutil
        shutil.rmtree(TEST_WORKSPACE)
        print(f"\nCleaned up test workspace: {TEST_WORKSPACE}")


if __name__ == "__main__":
    asyncio.run(main())
