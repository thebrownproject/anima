"""Memory loader — assembles system prompt from memory files + journals."""

from datetime import datetime, timedelta
from pathlib import Path

MEMORY_DIR = Path("/workspace/memory")
SOUL_MD = MEMORY_DIR / "soul.md"
USER_MD = MEMORY_DIR / "user.md"
MEMORY_MD = MEMORY_DIR / "MEMORY.md"


def _read_safe(path: Path) -> str:
    """Read file, return empty string if missing."""
    try:
        return path.read_text().strip()
    except FileNotFoundError:
        return ""


def _journal_path(date_str: str) -> Path:
    """Return path to journal for given YYYY-MM-DD date."""
    return MEMORY_DIR / f"{date_str}.md"


def load() -> str:
    """Load memory context into structured system prompt section.

    Loads 5 sources in order:
    1. soul.md — stack identity
    2. user.md — user preferences
    3. MEMORY.md — global memory
    4. Today's journal
    5. Yesterday's journal

    Returns formatted string for inclusion in system prompt.
    """
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    soul = _read_safe(SOUL_MD)
    user = _read_safe(USER_MD)
    memory = _read_safe(MEMORY_MD)
    today_journal = _read_safe(_journal_path(today))
    yesterday_journal = _read_safe(_journal_path(yesterday))

    sections = []

    if soul:
        sections.append(f"# Stack Memory: soul.md\n\n{soul}")

    if user:
        sections.append(f"# Stack Memory: user.md\n\n{user}")

    if memory:
        sections.append(f"# Stack Memory: MEMORY.md\n\n{memory}")

    if yesterday_journal:
        sections.append(f"# Stack Memory: Yesterday's Journal ({yesterday})\n\n{yesterday_journal}")

    if today_journal:
        sections.append(f"# Stack Memory: Today's Journal ({today})\n\n{today_journal}")

    return "\n\n---\n\n".join(sections) if sections else ""
