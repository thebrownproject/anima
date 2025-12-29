# Stackdocs Planning

## Superpowers Workflow

> **Override:** The `/superpowers:brainstorm` and `/superpowers:write-plan` skills specify saving to `docs/plans/YYYY-MM-DD-<feature>.md`. **Ignore this.** Instead, save to `docs/plans/todo/<feature>/` or `docs/plans/in-progress/<feature>/` as described below.

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

---

## DEV-NOTES.md

Never read in full. Grep to find what you need:

```bash
# List all sessions (shows date + what was done)
grep "^## Session" docs/DEV-NOTES.md

# Find sessions about a topic
grep "^## Session.*OCR\|^## Session.*Migration" docs/DEV-NOTES.md

# Then read specific session with offset
```

---

## When to Read What

| I need to know...              | Read this                 |
|--------------------------------|---------------------------|
| What feature to build next     | ROADMAP.md                |
| Why we're building it          | PRD.md                    |
| How the system fits together   | ARCHITECTURE.md           |
| What tables/columns exist      | SCHEMA.md                 |
| What happened last session     | DEV-NOTES.md (grep only)  |
| Current issues/ideas           | plans/issues/ACTIVE.md    |
| Active feature plans           | plans/in-progress/        |

---

## Folder Structure

```
docs/
├── CLAUDE.md              # This file - planning workflow
├── DEV-NOTES.md           # Session history
├── ROADMAP.md             # Feature priorities
├── PRD.md                 # Product requirements
├── ARCHITECTURE.md        # System design
├── SCHEMA.md              # Database schema
├── marketing/             # Marketing assets
└── plans/
    ├── issues/            # Issue tracking
    │   ├── ACTIVE.md      # Open issues and ideas
    │   └── COMPLETED.md   # Resolved issues archive
    ├── todo/              # Features designed, ready to implement
    ├── in-progress/       # Currently being worked on
    ├── complete/          # Done
    └── archive/           # Superseded/abandoned plans
```
