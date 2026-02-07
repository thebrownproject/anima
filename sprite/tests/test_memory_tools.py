"""Test memory_tools.py factory and tool functions."""

import pytest

import src.agents.shared.memory_tools as tools_module
from src.agents.shared.memory_tools import create_memory_tools

# Redirect file paths to temp directory for each test
@pytest.fixture(autouse=True)
def test_workspace(tmp_path):
    """Redirect memory paths to temp directory."""
    original = {
        "MEMORY_DIR": tools_module.MEMORY_DIR,
        "SOUL_MD": tools_module.SOUL_MD,
        "USER_MD": tools_module.USER_MD,
        "MEMORY_MD": tools_module.MEMORY_MD,
    }
    mem_dir = tmp_path / "memory"
    tools_module.MEMORY_DIR = mem_dir
    tools_module.SOUL_MD = mem_dir / "soul.md"
    tools_module.USER_MD = mem_dir / "user.md"
    tools_module.MEMORY_MD = mem_dir / "MEMORY.md"
    yield tmp_path
    # Restore originals
    for k, v in original.items():
        setattr(tools_module, k, v)


async def test_create_memory_tools():
    """Factory returns 3 tools."""
    tools = create_memory_tools()
    assert len(tools) == 3


async def test_write_memory(test_workspace):
    """write_memory writes to specified file."""
    tools = create_memory_tools()
    write_memory = tools[0].handler

    tools_module.MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    result = await write_memory({
        "file": "soul.md",
        "content": "# Stack Identity\n\nTest content for soul",
    })

    assert "is_error" not in result
    assert tools_module.SOUL_MD.exists()
    assert "Test content for soul" in tools_module.SOUL_MD.read_text()


async def test_write_memory_validation():
    """write_memory validates inputs."""
    tools = create_memory_tools()
    write_memory = tools[0].handler

    # Missing file
    result = await write_memory({"content": "test"})
    assert result.get("is_error") is True

    # Invalid file
    result = await write_memory({"file": "invalid.md", "content": "test"})
    assert result.get("is_error") is True

    # Missing content
    result = await write_memory({"file": "soul.md"})
    assert result.get("is_error") is True


async def test_update_soul(test_workspace):
    """update_soul writes to soul.md."""
    tools = create_memory_tools()
    update_soul = tools[1].handler

    tools_module.MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    result = await update_soul({
        "content": "# Updated Soul\n\nNew extraction rules",
    })

    assert "is_error" not in result
    assert tools_module.SOUL_MD.exists()
    content = tools_module.SOUL_MD.read_text()
    assert "Updated Soul" in content
    assert "New extraction rules" in content


async def test_update_user_prefs(test_workspace):
    """update_user_prefs writes to user.md."""
    tools = create_memory_tools()
    update_user_prefs = tools[2].handler

    tools_module.MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    result = await update_user_prefs({
        "content": "# User Preferences\n\nPrefer ISO dates",
    })

    assert "is_error" not in result
    assert tools_module.USER_MD.exists()
    content = tools_module.USER_MD.read_text()
    assert "User Preferences" in content
    assert "Prefer ISO dates" in content


async def test_tool_error_handling(test_workspace):
    """Tools handle filesystem errors gracefully."""
    import shutil

    tools = create_memory_tools()
    update_soul = tools[1].handler

    # Make MEMORY_DIR a file to cause write error
    if tools_module.MEMORY_DIR.exists():
        shutil.rmtree(tools_module.MEMORY_DIR)

    tools_module.MEMORY_DIR.parent.mkdir(parents=True, exist_ok=True)
    tools_module.MEMORY_DIR.write_text("This is a file, not a directory")

    result = await update_soul({"content": "Test content"})
    assert result.get("is_error") is True
