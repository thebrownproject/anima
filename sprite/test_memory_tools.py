#!/usr/bin/env python3
"""Test memory_tools.py factory and tool functions."""

import asyncio
import json
import tempfile
from pathlib import Path
import sys
from unittest.mock import MagicMock

# Setup test workspace
TEST_WORKSPACE = Path(tempfile.mkdtemp(prefix="sprite_test_tools_"))
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Mock claude_agent_sdk.tool decorator
sys.modules['claude_agent_sdk'] = MagicMock()

def mock_tool(name, description, schema):
    """Mock @tool decorator — just returns function unchanged."""
    def decorator(func):
        func._tool_name = name
        func._tool_description = description
        func._tool_schema = schema
        return func
    return decorator

sys.modules['claude_agent_sdk'].tool = mock_tool

# Mock memory paths
import src.agents.shared.memory_tools as tools_module
tools_module.MEMORY_DIR = TEST_WORKSPACE / "memory"
tools_module.SOUL_MD = tools_module.MEMORY_DIR / "soul.md"
tools_module.USER_MD = tools_module.MEMORY_DIR / "user.md"
tools_module.MEMORY_MD = tools_module.MEMORY_DIR / "MEMORY.md"

from src.agents.shared.memory_tools import create_memory_tools


async def test_create_memory_tools():
    """Test 1: Factory returns 3 tools."""
    print("Test 1: create_memory_tools() returns 3 tool functions...")

    tools = create_memory_tools()
    assert len(tools) == 3, f"Expected 3 tools, got {len(tools)}"

    # Verify tools are callable
    for tool in tools:
        assert callable(tool), "Tool is not callable"

    print("✓ Factory returns 3 callable tools")


async def test_write_memory():
    """Test 2: write_memory tool writes to specified file."""
    print("\nTest 2: write_memory tool writes to correct file...")

    tools = create_memory_tools()
    write_memory = tools[0]  # First tool in list

    tools_module.MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    # Test valid write to soul.md
    result = await write_memory({
        "file": "soul.md",
        "content": "# Stack Identity\n\nTest content for soul"
    })

    assert "is_error" not in result, f"Tool returned error: {result}"
    assert tools_module.SOUL_MD.exists(), "soul.md not created"
    assert "Test content for soul" in tools_module.SOUL_MD.read_text()

    print("✓ write_memory writes to specified file")


async def test_write_memory_validation():
    """Test 3: write_memory validates inputs."""
    print("\nTest 3: write_memory validates file parameter...")

    tools = create_memory_tools()
    write_memory = tools[0]

    # Test missing file
    result = await write_memory({"content": "test"})
    assert result.get("is_error") is True, "Should error on missing file"

    # Test invalid file
    result = await write_memory({"file": "invalid.md", "content": "test"})
    assert result.get("is_error") is True, "Should error on invalid file"

    # Test missing content
    result = await write_memory({"file": "soul.md"})
    assert result.get("is_error") is True, "Should error on missing content"

    print("✓ write_memory validates inputs correctly")


async def test_update_soul():
    """Test 4: update_soul tool writes to soul.md."""
    print("\nTest 4: update_soul writes to soul.md...")

    tools = create_memory_tools()
    update_soul = tools[1]  # Second tool in list

    tools_module.MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    result = await update_soul({
        "content": "# Updated Soul\n\nNew extraction rules"
    })

    assert "is_error" not in result, f"Tool returned error: {result}"
    assert tools_module.SOUL_MD.exists(), "soul.md not created"
    content = tools_module.SOUL_MD.read_text()
    assert "Updated Soul" in content
    assert "New extraction rules" in content

    print("✓ update_soul writes to soul.md")


async def test_update_user_prefs():
    """Test 5: update_user_prefs tool writes to user.md."""
    print("\nTest 5: update_user_prefs writes to user.md...")

    tools = create_memory_tools()
    update_user_prefs = tools[2]  # Third tool in list

    tools_module.MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    result = await update_user_prefs({
        "content": "# User Preferences\n\nPrefer ISO dates"
    })

    assert "is_error" not in result, f"Tool returned error: {result}"
    assert tools_module.USER_MD.exists(), "user.md not created"
    content = tools_module.USER_MD.read_text()
    assert "User Preferences" in content
    assert "Prefer ISO dates" in content

    print("✓ update_user_prefs writes to user.md")


async def test_tool_error_handling():
    """Test 6: Tools handle filesystem errors gracefully."""
    print("\nTest 6: Tools handle filesystem errors...")

    tools = create_memory_tools()
    update_soul = tools[1]

    # Make MEMORY_DIR a file (not a directory) to cause write error
    if tools_module.MEMORY_DIR.exists():
        import shutil
        shutil.rmtree(tools_module.MEMORY_DIR)

    tools_module.MEMORY_DIR.parent.mkdir(parents=True, exist_ok=True)
    tools_module.MEMORY_DIR.write_text("This is a file, not a directory")

    result = await update_soul({"content": "Test content"})

    # Should return error, not raise exception
    assert result.get("is_error") is True, "Should return error dict on filesystem failure"

    print("✓ Tools handle filesystem errors gracefully")


async def main():
    """Run all tests."""
    print(f"Test workspace: {TEST_WORKSPACE}\n")

    try:
        await test_create_memory_tools()
        await test_write_memory()
        await test_write_memory_validation()
        await test_update_soul()
        await test_update_user_prefs()
        await test_tool_error_handling()

        print("\n" + "=" * 60)
        print("All memory_tools tests passed! ✓")
        print("=" * 60)

    finally:
        # Cleanup
        import shutil
        shutil.rmtree(TEST_WORKSPACE)
        print(f"\nCleaned up test workspace: {TEST_WORKSPACE}")


if __name__ == "__main__":
    asyncio.run(main())
