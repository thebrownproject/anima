"""Smoke test for memory system — verifies imports and module structure only.

Functional tests are in test_hooks.py and test_processor.py.
This file only checks that modules import correctly and key exports exist.
"""

import pytest


def test_no_stale_imports():
    """Verify no imports from deleted modules (agents/, journal.py, transcript.py)."""
    from pathlib import Path

    runtime_path = Path(__file__).parent.parent / "src" / "runtime.py"
    source = runtime_path.read_text()

    # Deleted modules should not be referenced
    assert "from .memory.journal" not in source
    assert "from .memory.transcript" not in source
    assert "from .agents" not in source
    assert "agents.shared" not in source
    assert "TranscriptLogger" not in source
    assert "append_journal" not in source


def test_canvas_tools_import_path():
    """Verify canvas tools import from correct path (src/tools/canvas.py)."""
    from pathlib import Path

    runtime_path = Path(__file__).parent.parent / "src" / "runtime.py"
    source = runtime_path.read_text()

    # Should import from tools.canvas
    assert "from .tools.canvas" in source or "from src.tools.canvas" in source


def test_memory_module_exports():
    """Verify memory module exports key functions and constants."""
    from src import memory

    # Key exports should exist
    assert hasattr(memory, "ensure_templates")
    assert hasattr(memory, "MEMORY_DIR")
    assert hasattr(memory, "SOUL_MD")
    assert hasattr(memory, "OS_MD")
    assert hasattr(memory, "TOOLS_MD")
    assert hasattr(memory, "FILES_MD")
    assert hasattr(memory, "USER_MD")
    assert hasattr(memory, "CONTEXT_MD")
    assert hasattr(memory, "ALL_MEMORY_FILES")
    assert hasattr(memory, "DAEMON_MANAGED_FILES")

    # Verify collections have correct length
    assert len(memory.ALL_MEMORY_FILES) == 6
    assert len(memory.DAEMON_MANAGED_FILES) == 4


def test_memory_loader_imports():
    """Verify memory.loader module imports without errors."""
    from src.memory import loader

    # Key function should exist
    assert hasattr(loader, "load")
    assert callable(loader.load)


def test_memory_hooks_imports():
    """Verify memory.hooks module imports without errors."""
    from src.memory import hooks

    # Key exports should exist
    assert hasattr(hooks, "TurnBuffer")
    assert hasattr(hooks, "create_hook_callbacks")
