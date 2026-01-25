#!/usr/bin/env python3
"""
Migrate DEV-NOTES.md sessions to CAPCOM format.

This script parses all sessions from docs/sessions/DEV-NOTES.md and appends
them to .space-agents/comms/capcom.md in the CAPCOM format.

Features:
- Handles both old format (Sessions 1-31) and new format (Sessions 32+)
- Idempotent: detects already-migrated sessions
- Preserves existing CAPCOM content (append-only)
"""

import re
from pathlib import Path
from dataclasses import dataclass


@dataclass
class Session:
    """Represents a parsed DEV-NOTES session."""
    number: int
    date: str
    title: str
    is_complete: bool
    completed: list[str]
    decisions: list[str]
    issues: list[str]
    next_session: str
    raw_content: str


def parse_old_format(content: str) -> tuple[list[str], list[str], list[str], str]:
    """Parse old format sessions (Sessions 1-2 with **What was completed:** format)."""
    completed = []
    decisions = []
    issues = []
    next_session = ""

    # Extract "What was completed:" section
    completed_match = re.search(
        r'\*\*What was completed:\*\*\s*\n(.*?)(?=\n\*\*|---|\Z)',
        content,
        re.DOTALL
    )
    if completed_match:
        completed_text = completed_match.group(1)
        # Extract bullet points
        for line in completed_text.split('\n'):
            line = line.strip()
            if line.startswith('- '):
                # Clean up the line
                item = line[2:].strip()
                if item:
                    completed.append(item)

    # Extract "Important Decisions Made:" section
    decisions_match = re.search(
        r'\*\*Important Decisions Made:\*\*\s*\n(.*?)(?=\n\*\*|---|\Z)',
        content,
        re.DOTALL
    )
    if decisions_match:
        decisions_text = decisions_match.group(1)
        # Look for numbered items or bold headers
        for match in re.finditer(r'\d+\.\s+\*\*([^*]+)\*\*', decisions_text):
            decisions.append(match.group(1).strip())

    # Extract "Next Steps:" or "Next Session:" section
    next_match = re.search(
        r'\*\*(?:Next Steps|Next Session):\*\*\s*\n(.*?)(?=\n\*\*|---|\Z)',
        content,
        re.DOTALL
    )
    if next_match:
        next_text = next_match.group(1).strip()
        # Get first item or summary
        lines = [l.strip() for l in next_text.split('\n') if l.strip()]
        if lines:
            first = lines[0]
            if first.startswith('1. ') or first.startswith('- '):
                next_session = first[2:].strip() if first.startswith('- ') else first[3:].strip()
            else:
                next_session = first

    return completed, decisions, issues, next_session


def has_old_format(content: str) -> bool:
    """Check if content uses old format (Sessions 1-2 style)."""
    return '**What was completed:**' in content


def parse_new_format(content: str) -> tuple[list[str], list[str], list[str], str]:
    """Parse new format sessions (with ### Tasks Completed or ### Completed)."""
    completed = []
    decisions = []
    issues = []
    next_session = ""

    # Extract "### Tasks Completed" or "### Completed" section
    completed_match = re.search(
        r'### (?:Tasks )?Completed\s*\n(.*?)(?=###|\Z)',
        content,
        re.DOTALL
    )
    if completed_match:
        completed_text = completed_match.group(1)
        # Extract [x] items with bold descriptions
        for match in re.finditer(r'-\s*\[x\]\s*\*\*([^*]+)\*\*', completed_text):
            completed.append(match.group(1).strip())
        # Also try numbered items with bold (Session 15 style)
        if not completed:
            for match in re.finditer(r'\d+\.\s+\*\*([^*]+)\*\*', completed_text):
                completed.append(match.group(1).strip())
        # If still no bold items, try regular [x] items
        if not completed:
            for match in re.finditer(r'-\s*\[x\]\s*(.+)', completed_text):
                item = match.group(1).strip()
                # Remove markdown formatting
                item = re.sub(r'\*\*([^*]+)\*\*', r'\1', item)
                if item:
                    completed.append(item[:80])  # Truncate long items

    # Extract "### Decisions Made" or "### Key Decisions" or "### Design Decisions Made" section
    decisions_match = re.search(
        r'### (?:Decisions Made|Key Decisions|Design Decisions Made)\s*\n(.*?)(?=###|\Z)',
        content,
        re.DOTALL
    )
    if decisions_match:
        decisions_text = decisions_match.group(1)
        # Look for table format: | Decision | Choice | Reasoning |
        if '|' in decisions_text:
            # Parse table rows
            for line in decisions_text.split('\n'):
                if '|' in line and not line.strip().startswith('|--') and 'Decision' not in line:
                    parts = [p.strip() for p in line.split('|') if p.strip()]
                    if len(parts) >= 2:
                        decisions.append(f"{parts[0]}: {parts[1]}")
        else:
            # Look for numbered or bullet items
            for match in re.finditer(r'(?:\d+\.\s*|\-\s*)\*\*([^*]+)\*\*', decisions_text):
                decisions.append(match.group(1).strip())

    # Extract "### Issues Encountered" section
    issues_match = re.search(
        r'### Issues Encountered\s*\n(.*?)(?=###|\Z)',
        content,
        re.DOTALL
    )
    if issues_match:
        issues_text = issues_match.group(1)
        for match in re.finditer(r'(?:\d+\.\s*|\-\s*)\*\*([^*]+)\*\*', issues_text):
            issues.append(match.group(1).strip())

    # Extract "### Next Session" section
    next_match = re.search(
        r'### Next Session\s*\n(.*?)(?=###|---|\Z)',
        content,
        re.DOTALL
    )
    if next_match:
        next_text = next_match.group(1)
        # Look for **Task**: line
        task_match = re.search(r'\*\*Task\*\*:\s*(.+)', next_text)
        if task_match:
            next_session = task_match.group(1).strip()
        else:
            # Try first bullet or non-empty line
            for line in next_text.split('\n'):
                line = line.strip()
                if line.startswith('- '):
                    next_session = line[2:].strip()
                    break
                elif line and not line.startswith('**Process'):
                    next_session = line
                    break

    return completed, decisions, issues, next_session


def parse_sessions(devnotes_path: Path) -> list[Session]:
    """Parse all sessions from DEV-NOTES.md."""
    content = devnotes_path.read_text()
    sessions = []

    # Pattern for standard session headers
    # ## Session N - YYYY-MM-DD - Title [checkmark]
    standard_pattern = re.compile(
        r'^## Session (\d+) - (\d{4}-\d{2}-\d{2}) - (.+?)(\s*✅)?\s*$',
        re.MULTILINE
    )

    # Pattern for variant headers (Session 15 style: ## Session N: Title)
    variant_pattern = re.compile(
        r'^## Session (\d+): (.+?)(\s*✅)?\s*$',
        re.MULTILINE
    )

    # Find all session headers
    all_matches = []

    for match in standard_pattern.finditer(content):
        all_matches.append({
            'match': match,
            'number': int(match.group(1)),
            'date': match.group(2),
            'title': match.group(3).strip(),
            'is_complete': match.group(4) is not None,
            'start': match.start(),
            'end': match.end()
        })

    for match in variant_pattern.finditer(content):
        all_matches.append({
            'match': match,
            'number': int(match.group(1)),
            'date': None,  # Will extract from content
            'title': match.group(2).strip(),
            'is_complete': match.group(3) is not None,
            'start': match.start(),
            'end': match.end()
        })

    # Sort by position in file
    all_matches.sort(key=lambda m: m['start'])

    for i, match_info in enumerate(all_matches):
        session_num = match_info['number']
        date = match_info['date']
        title = match_info['title']
        is_complete = match_info['is_complete']

        # Get session content (from this header to next header or end)
        start = match_info['end']
        end = all_matches[i + 1]['start'] if i + 1 < len(all_matches) else len(content)
        session_content = content[start:end]

        # For variant headers, extract date from **Date**: line
        if date is None:
            date_match = re.search(r'\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})', session_content)
            if date_match:
                date = date_match.group(1)
            else:
                # Fallback: use previous session's date or a placeholder
                date = "2025-01-01"

        # Parse based on format (check content, not session number)
        if has_old_format(session_content):
            completed, decisions, issues, next_session = parse_old_format(session_content)
        else:
            completed, decisions, issues, next_session = parse_new_format(session_content)

        sessions.append(Session(
            number=session_num,
            date=date,
            title=title,
            is_complete=is_complete,
            completed=completed[:5],  # Limit to 5 items
            decisions=decisions[:5],   # Limit to 5 items
            issues=issues[:3],         # Limit to 3 items
            next_session=next_session[:100] if next_session else "",
            raw_content=session_content
        ))

    return sessions


def get_migrated_sessions(capcom_path: Path) -> set[tuple[int, str]]:
    """Get already migrated sessions from CAPCOM (session number + date)."""
    if not capcom_path.exists():
        return set()

    content = capcom_path.read_text()
    migrated = set()

    # Pattern for migrated session entries
    # ## [YYYY-MM-DD] Session N: Title
    pattern = re.compile(r'^## \[(\d{4}-\d{2}-\d{2})\] Session (\d+):', re.MULTILINE)

    for match in pattern.finditer(content):
        date = match.group(1)
        session_num = int(match.group(2))
        migrated.add((session_num, date))

    return migrated


def format_session_for_capcom(session: Session) -> str:
    """Format a session as a CAPCOM entry."""
    lines = []

    # Header
    checkmark = " (complete)" if session.is_complete else ""
    lines.append(f"## [{session.date}] Session {session.number}: {session.title}{checkmark}")
    lines.append("")

    # Completed
    if session.completed:
        completed_summary = "; ".join(session.completed[:3])
        if len(completed_summary) > 200:
            completed_summary = completed_summary[:197] + "..."
        lines.append(f"**Completed:** {completed_summary}")
    else:
        lines.append("**Completed:** (no tasks recorded)")

    # Decisions
    if session.decisions:
        decisions_summary = "; ".join(session.decisions[:3])
        if len(decisions_summary) > 200:
            decisions_summary = decisions_summary[:197] + "..."
        lines.append(f"**Decisions:** {decisions_summary}")

    # Issues
    if session.issues:
        issues_summary = "; ".join(session.issues[:2])
        if len(issues_summary) > 150:
            issues_summary = issues_summary[:147] + "..."
        lines.append(f"**Issues:** {issues_summary}")

    # Next
    if session.next_session:
        lines.append(f"**Next:** {session.next_session}")

    lines.append("")
    lines.append("---")

    return "\n".join(lines)


def migrate_sessions(project_root: Path, dry_run: bool = False) -> tuple[int, int]:
    """
    Migrate sessions from DEV-NOTES.md to CAPCOM.

    Returns: (total_sessions, newly_migrated)
    """
    devnotes_path = project_root / "docs" / "sessions" / "DEV-NOTES.md"
    capcom_path = project_root / ".space-agents" / "comms" / "capcom.md"

    if not devnotes_path.exists():
        raise FileNotFoundError(f"DEV-NOTES.md not found at {devnotes_path}")

    if not capcom_path.parent.exists():
        capcom_path.parent.mkdir(parents=True, exist_ok=True)

    # Parse all sessions
    sessions = parse_sessions(devnotes_path)
    print(f"Found {len(sessions)} sessions in DEV-NOTES.md")

    # Get already migrated sessions
    migrated = get_migrated_sessions(capcom_path)
    print(f"Already migrated: {len(migrated)} sessions")

    # Filter to sessions not yet migrated
    new_sessions = [
        s for s in sessions
        if (s.number, s.date) not in migrated
    ]
    print(f"New sessions to migrate: {len(new_sessions)}")

    if not new_sessions:
        print("No new sessions to migrate.")
        return len(sessions), 0

    # Format new sessions
    new_entries = []
    for session in sorted(new_sessions, key=lambda s: (s.date, s.number)):
        entry = format_session_for_capcom(session)
        new_entries.append(entry)
        if dry_run:
            print(f"\n--- Session {session.number} ({session.date}) ---")
            print(entry)

    if dry_run:
        print(f"\n[DRY RUN] Would append {len(new_entries)} entries to {capcom_path}")
        return len(sessions), len(new_entries)

    # Append to CAPCOM
    with open(capcom_path, 'a') as f:
        f.write("\n")
        for entry in new_entries:
            f.write(entry)
            f.write("\n")

    print(f"Appended {len(new_entries)} sessions to {capcom_path}")
    return len(sessions), len(new_entries)


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Migrate DEV-NOTES.md sessions to CAPCOM format"
    )
    parser.add_argument(
        '--dry-run', '-n',
        action='store_true',
        help="Show what would be migrated without writing"
    )
    parser.add_argument(
        '--project-root',
        type=Path,
        default=Path(__file__).parent.parent.parent,
        help="Project root directory (default: auto-detect)"
    )

    args = parser.parse_args()

    try:
        total, migrated = migrate_sessions(args.project_root, dry_run=args.dry_run)
        print(f"\nSummary: {migrated}/{total} sessions migrated")
    except Exception as e:
        print(f"Error: {e}")
        raise


if __name__ == "__main__":
    main()
