"""Memory system — templates, loading, journals, transcripts."""

from pathlib import Path

MEMORY_DIR = Path("/workspace/memory")
SOUL_MD = MEMORY_DIR / "soul.md"
USER_MD = MEMORY_DIR / "user.md"
MEMORY_MD = MEMORY_DIR / "MEMORY.md"

SOUL_TEMPLATE = """# Stack Identity

This stack has not been configured yet.

## Purpose
(Agent will update this after learning what the user needs)

## Extraction Rules
(Agent will learn extraction patterns from user corrections)
"""

USER_TEMPLATE = """# User Preferences

(Agent will learn preferences from interactions)
"""

MEMORY_TEMPLATE = """# Global Memory

No documents processed yet. No sessions completed.
"""


def ensure_templates() -> None:
    """Create memory template files if missing. Fallback for bootstrap."""
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    if not SOUL_MD.exists():
        SOUL_MD.write_text(SOUL_TEMPLATE)

    if not USER_MD.exists():
        USER_MD.write_text(USER_TEMPLATE)

    if not MEMORY_MD.exists():
        MEMORY_MD.write_text(MEMORY_TEMPLATE)
