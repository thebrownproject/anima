# StackDocs Planning

## Current Focus

**Active Work:**
- **Extraction Agent** → `plans/in-progress/extraction-agent/`

**Todo:**
- **Stacks Feature** → `plans/todo/stacks/`

---

## Superpowers Workflow

### Creating New Features
1. `/superpowers:brainstorm` → creates design doc
2. Save to: `plans/in-progress/<feature>/YYYY-MM-DD-<feature>-design.md`
3. `/superpowers:write-plan` → creates implementation plan
4. Save to: same folder as design

### Completing Features
1. Finish execution via `/superpowers:execute-plan`
2. Move folder: `git mv plans/in-progress/<feature> plans/complete/`
3. **Update reference docs** (ARCHITECTURE.md, SCHEMA.md) to reflect new reality

### Parking Ideas
- Not ready to start? Move to `plans/todo/`
- Abandoned? Move to `plans/archive/`

> **Override:** The `/superpowers:brainstorm` and `/superpowers:write-plan` skills specify saving to `docs/plans/YYYY-MM-DD-<feature>.md`. **Ignore this.** Instead, save to `docs/plans/todo/<feature>/` or `docs/plans/in-progress/<feature>/` as described above.

---

## Reference Docs

| Doc | Purpose | Update Trigger |
|-----|---------|----------------|
| `ROADMAP.md` | Feature priorities | Priorities shift or feature completes |
| `PRD.md` | Product requirements | Product scope changes (rare) |
| `ARCHITECTURE.md` | System design | Feature moves to `complete/` |
| `SCHEMA.md` | Database schema | Database changes land |
| `plans/ISSUES.md` | Lightweight issue/idea tracking | As issues are added/resolved |

---

## Session Continuity

Use `/continue` to resume work - reads ROADMAP.md and latest DEV-NOTES session, then waits for your direction.

**DEV-NOTES.md**: Never read in full. Grep to find what you need:
```bash
# List all sessions (shows date + what was done)
grep "^## Session" docs/DEV-NOTES.md

# Find sessions about a topic
grep "^## Session.*OCR\|^## Session.*Migration" docs/DEV-NOTES.md

# Then read specific session with offset
```
Use proactively when you need context on past decisions.

---

## Folder Structure

```
docs/
├── CLAUDE.md              # This file - index + workflow
├── DEV-NOTES.md           # Session continuity
├── ROADMAP.md             # Prioritized features
├── PRD.md                 # Product requirements
├── ARCHITECTURE.md        # System design
├── SCHEMA.md              # Database schema
└── plans/
    ├── ISSUES.md          # Lightweight issue/idea tracking
    ├── todo/              # Features designed, ready to implement
    ├── in-progress/       # Currently being worked on
    ├── complete/          # Done
    └── archive/           # Superseded/abandoned plans
```
