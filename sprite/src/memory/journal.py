"""Daily journal — append session summaries."""

import asyncio
from datetime import datetime
from pathlib import Path

MEMORY_DIR = Path("/workspace/.os/memory")


async def append_journal(summary: str) -> None:
    """Append a summary to today's journal. Async wrapper for file I/O."""
    today = datetime.now().strftime("%Y-%m-%d")
    journal_path = MEMORY_DIR / f"{today}.md"
    timestamp = datetime.now().strftime("%H:%M:%S")

    entry = f"\n## {timestamp}\n\n{summary}\n"

    # Use asyncio.to_thread for async file write
    def _write() -> None:
        journal_path.parent.mkdir(parents=True, exist_ok=True)
        with journal_path.open("a") as f:
            f.write(entry)

    await asyncio.to_thread(_write)
