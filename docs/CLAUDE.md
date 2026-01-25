# Stackdocs Planning

## Space-Agents Workflow

> **Override:** The `/exploration-plan` skill creates tasks in Beads. Design docs still save to `docs/plans/in-progress/<feature>/` as described below.

### Creating New Features
1. `/exploration` → select brainstorm mode for design exploration
2. Save design to: `plans/in-progress/<feature>/YYYY-MM-DD-<feature>-design.md`
3. `/exploration-plan` → creates implementation tasks in Beads
4. Tasks tracked via `bd list`, `bd show <id>`, etc.

### Completing Features
1. Finish execution via `/mission` (solo, orchestrated, or ralph modes)
2. Move folder: `git mv plans/in-progress/<feature> plans/complete/`
3. **Update reference docs** (`specs/ARCHITECTURE.md`, `specs/SCHEMA.md`) to reflect new reality

### Parking Ideas
- Not ready to start? Move to `plans/todo/`
- Abandoned? Move to `plans/archive/`

---

## CAPCOM (Session History)

Never read in full. Grep to find what you need:

```bash
# List all sessions (shows date + what was done)
grep "^## Session" .space-agents/comms/capcom.md

# Find sessions about a topic
grep "^## Session.*OCR\|^## Session.*Migration" .space-agents/comms/capcom.md

# Then read specific session with offset
```

---

## When to Read What

| I need to know...              | Read this                                    |
|--------------------------------|----------------------------------------------|
| What feature to build next     | `plans/roadmap/IN-PROGRESS.md`               |
| Why we're building it          | `specs/PRD.md`                               |
| How the system fits together   | `specs/ARCHITECTURE.md`                      |
| What tables/columns exist      | `specs/SCHEMA.md`                            |
| What happened last session     | `.space-agents/comms/capcom.md` (grep only)  |
| Current issues/ideas           | Beads - `bd list`, `bd ready`                |
| Active feature plans           | `plans/in-progress/`                         |

---

## Folder Structure

```
docs/
├── CLAUDE.md              # This file - planning workflow
├── specs/                 # System specifications
│   ├── ARCHITECTURE.md    # System design
│   ├── SCHEMA.md          # Database schema
│   └── PRD.md             # Product requirements
├── plans/
│   ├── roadmap/           # Feature priorities
│   │   ├── IN-PROGRESS.md # Current work
│   │   ├── TODO.md        # Ready to implement
│   │   ├── COMPLETE.md    # Done
│   │   └── FUTURE.md      # P1/P2 backlog
│   ├── todo/              # Detailed plans - ready
│   ├── in-progress/       # Detailed plans - active
│   ├── complete/          # Detailed plans - done
│   └── archive/           # Superseded plans
└── marketing/             # Marketing assets

.space-agents/
├── comms/
│   └── capcom.md          # Session history (replaces DEV-NOTES.md)
└── ...                    # Other Space-Agents config

.beads/
└── issues.jsonl           # Issue tracking (replaces ACTIVE.md)
                           # Use: bd list, bd show, bd ready, etc.
```
