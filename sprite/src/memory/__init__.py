"""Memory system — templates, loading, journals, transcripts."""

from pathlib import Path

MEMORY_DIR = Path("/workspace/memory")
SOUL_MD = MEMORY_DIR / "soul.md"
USER_MD = MEMORY_DIR / "user.md"
MEMORY_MD = MEMORY_DIR / "MEMORY.md"

# soul.md is developer-controlled — deployed from sprite/memory/soul.md,
# NOT generated from a template. Only user.md and MEMORY.md are agent-writable.

USER_TEMPLATE = """# User Preferences

(Agent will learn preferences from interactions)
"""

MEMORY_TEMPLATE = """# Global Memory

No documents processed yet. No sessions completed.
"""


def ensure_templates() -> None:
    """Create agent-writable memory files if missing.

    soul.md is NOT created here — it is deployed from the repo
    (sprite/memory/soul.md) and overwritten on each deploy.
    Only user.md and MEMORY.md are created from templates.
    """
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    if not USER_MD.exists():
        USER_MD.write_text(USER_TEMPLATE)

    if not MEMORY_MD.exists():
        MEMORY_MD.write_text(MEMORY_TEMPLATE)
