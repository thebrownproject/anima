"""Memory system — templates, loading, journals, transcripts."""

from pathlib import Path

MEMORY_DIR = Path("/workspace/.os/memory")

# Deploy-managed (overwritten on every deploy by Bridge)
SOUL_MD = MEMORY_DIR / "soul.md"
OS_MD = MEMORY_DIR / "os.md"

# Daemon-managed (deployed once on bootstrap, curated by daemon at runtime)
TOOLS_MD = MEMORY_DIR / "tools.md"
FILES_MD = MEMORY_DIR / "files.md"
USER_MD = MEMORY_DIR / "user.md"
CONTEXT_MD = MEMORY_DIR / "context.md"

ALL_MEMORY_FILES = [SOUL_MD, OS_MD, TOOLS_MD, FILES_MD, USER_MD, CONTEXT_MD]
DAEMON_MANAGED_FILES = [TOOLS_MD, FILES_MD, USER_MD, CONTEXT_MD]


def read_safe(path: Path) -> str:
    """Read file content safely, returning empty string if file doesn't exist."""
    try:
        return path.read_text().strip()
    except FileNotFoundError:
        return ""


def ensure_templates() -> None:
    """Safety net — create daemon-managed memory files if missing.

    soul.md and os.md are deploy-managed (written by Bridge).
    This only creates daemon-managed files as empty placeholders
    in case bootstrap didn't run or files were deleted.
    """
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    for path in DAEMON_MANAGED_FILES:
        if not path.exists():
            path.write_text(f"# {path.stem}\n")
