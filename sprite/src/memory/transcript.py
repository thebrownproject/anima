"""JSONL transcript logger — audit log for tool calls and responses."""

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any

TRANSCRIPTS_DIR = Path("/workspace/transcripts")


class TranscriptLogger:
    """Logs tool calls and agent events as JSONL for session auditing."""

    def __init__(self, session_id: str | None = None) -> None:
        """Create logger for this session. Filename: YYYY-MM-DDTHH-MM-SS.jsonl"""
        timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        self.log_path = TRANSCRIPTS_DIR / f"{timestamp}.jsonl"
        self.session_id = session_id
        TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

    async def log(self, event_type: str, data: dict[str, Any]) -> None:
        """Append a JSONL line to the transcript. Async wrapper for file I/O."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "session_id": self.session_id,
            "event_type": event_type,
            **data,
        }

        def _write() -> None:
            with self.log_path.open("a") as f:
                f.write(json.dumps(entry) + "\n")

        await asyncio.to_thread(_write)
