"""Observation batch processor — stateless Haiku calls to extract learnings.

Reads unprocessed observations from transcript.db, sends them with current
memory file state to Haiku, parses the response into learnings/actions/file updates.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

from . import ALL_MEMORY_FILES, DAEMON_MANAGED_FILES, TOOLS_MD, FILES_MD, USER_MD, CONTEXT_MD

logger = logging.getLogger(__name__)

MODEL = "claude-3-5-haiku-latest"
MAX_TOKENS = 4096

SYSTEM_PROMPT = (
    "You are a memory curator. Extract learnings from these observations. "
    "Extract NEW learnings only. When updating md files, output the complete file. "
    "Stay under the line limit. Prioritize: recent corrections > active tasks > "
    "active preferences > key facts > historical context. "
    "Remove contradicted or completed information."
)

# Single-line learning types that go into the learnings table
LEARNING_TYPES = frozenset({"FACT", "PATTERN", "CORRECTION", "PREFERENCE", "TOOL_INSTALL"})

# Map response prefix to memory file path
_MD_UPDATE_MAP: dict[str, Path] = {
    "TOOLS_MD_UPDATE:": TOOLS_MD,
    "FILES_MD_UPDATE:": FILES_MD,
    "USER_MD_UPDATE:": USER_MD,
    "CONTEXT_MD_UPDATE:": CONTEXT_MD,
}

# All known prefixes for detecting block boundaries
_ALL_PREFIXES = (
    *LEARNING_TYPES,
    "ACTION:",
    "NONE",
    *_MD_UPDATE_MAP.keys(),
)


def _read_safe(path: Path) -> str:
    try:
        return path.read_text().strip()
    except FileNotFoundError:
        return ""


def _build_user_message(memory_state: dict[str, str], observations: list[dict]) -> str:
    md_sections = "\n\n".join(
        f"### {path.stem}.md\n{content}" for path, content in memory_state.items() if content
    )
    obs_lines = []
    for obs in observations:
        parts = [f"[Turn {obs['sequence_num']}]"]
        if obs.get("user_message"):
            parts.append(f"User: {obs['user_message']}")
        if obs.get("agent_response"):
            parts.append(f"Agent: {obs['agent_response']}")
        obs_lines.append("\n".join(parts))

    obs_text = "\n\n".join(obs_lines)
    start = observations[0]["sequence_num"]
    end = observations[-1]["sequence_num"]

    return (
        f"Current memory state:\n{md_sections}\n\n"
        f"Observations (turns {start}-{end}):\n{obs_text}\n\n"
        f"Extract learnings. Update files if needed."
    )


def _starts_with_known_prefix(line: str) -> bool:
    for prefix in _ALL_PREFIXES:
        if line.startswith(prefix):
            return True
    return False


def _parse_response(text: str) -> tuple[list[dict], list[dict], dict[Path, str]]:
    """Parse Haiku response into (learnings, actions, file_updates).

    Returns:
        learnings: list of {type, content} dicts
        actions: list of {content} dicts
        file_updates: dict mapping Path -> full new file content
    """
    learnings: list[dict] = []
    actions: list[dict] = []
    file_updates: dict[Path, str] = {}

    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line or line == "NONE":
            i += 1
            continue

        # Check single-line learning types
        matched = False
        for ltype in LEARNING_TYPES:
            prefix = f"{ltype}: "
            if line.startswith(prefix):
                learnings.append({"type": ltype, "content": line[len(prefix):]})
                matched = True
                break

        if matched:
            i += 1
            continue

        # Check ACTION
        if line.startswith("ACTION: "):
            actions.append({"content": line[len("ACTION: "):]})
            i += 1
            continue

        # Check MD file updates (multi-line blocks)
        md_matched = False
        for update_prefix, file_path in _MD_UPDATE_MAP.items():
            if line.startswith(update_prefix):
                # Collect all lines until next known prefix or EOF
                block_lines: list[str] = []
                # If content is on the same line after the prefix
                remainder = line[len(update_prefix):].strip()
                if remainder:
                    block_lines.append(remainder)
                i += 1
                while i < len(lines):
                    next_line = lines[i].strip()
                    if _starts_with_known_prefix(next_line):
                        break
                    block_lines.append(lines[i])  # preserve original whitespace
                    i += 1
                file_updates[file_path] = "\n".join(block_lines).strip()
                md_matched = True
                break

        if md_matched:
            continue

        i += 1

    return learnings, actions, file_updates


class ObservationProcessor:
    """Processes observation batches via Haiku to extract learnings and update memory files."""

    def __init__(
        self,
        transcript_db,
        memory_db,
        anthropic_client,
        memory_dir: Path,
    ) -> None:
        self._transcript = transcript_db
        self._memory = memory_db
        self._client = anthropic_client
        self._memory_dir = memory_dir

    async def process_batch(self) -> None:
        """Read unprocessed observations, call Haiku, store results."""
        observations = await self._transcript.fetchall(
            "SELECT * FROM observations WHERE processed = 0 ORDER BY id"
        )
        if not observations:
            return

        # Read current memory file state
        memory_state = {path: _read_safe(path) for path in ALL_MEMORY_FILES}

        user_msg = _build_user_message(memory_state, observations)

        try:
            response = await self._client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            )
        except Exception:
            logger.exception("Haiku API call failed — observations will retry next batch")
            return

        response_text = response.content[0].text
        learnings, actions, file_updates = _parse_response(response_text)

        obs_ids = [obs["id"] for obs in observations]

        # Store learnings
        now = time.time()
        for learning in learnings:
            await self._memory.execute(
                "INSERT INTO learnings (created_at, session_id, type, content, source_observation_id, confidence) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (now, None, learning["type"], learning["content"], obs_ids[0], 1.0),
            )

        # Store actions — insert as pending_action, then link via source_learning_id
        for action in actions:
            await self._memory.execute(
                "INSERT INTO pending_actions (created_at, content, priority, status, source_learning_id) "
                "VALUES (?, ?, ?, ?, ?)",
                (now, action["content"], 1, "pending", None),
            )

        # Write file updates
        for file_path, content in file_updates.items():
            if file_path in DAEMON_MANAGED_FILES:
                file_path.write_text(content)

        # Mark observations as processed
        placeholders = ",".join("?" for _ in obs_ids)
        await self._transcript.execute(
            f"UPDATE observations SET processed = 1 WHERE id IN ({placeholders})",
            tuple(obs_ids),
        )

    async def flush_all(self) -> None:
        """Process all remaining unprocessed observations."""
        await self.process_batch()
