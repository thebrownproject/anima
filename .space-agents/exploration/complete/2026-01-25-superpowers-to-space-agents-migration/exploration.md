# Superpowers to Space-Agents Migration

**Date:** 2026-01-25
**Status:** Brainstorm complete, ready for planning

## Context

Migrating Stackdocs from the existing "superpowers" workflow system to the newly-built Space-Agents system. This is dogfooding - the developer built Space-Agents and is now using it on their own project.

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Legacy plans structure | Archive and keep | Preserves 111 sessions of history for reference |
| Session commands | Replace with Space-Agents | `/launch`, `/land`, `/capcom` replace `/continue`, `/wrap-up`, `/handover-prompt` |
| Issue tracking | Migrate to Beads | 31 issues from `docs/plans/issues/ACTIVE.md` will move to Beads |
| Session history | Transform DEV-NOTES to CAPCOM | Rename and reformat 8,447 lines to match CAPCOM format |
| Plan folders | Merge | `docs/plans/` merges into `.space-agents/exploration/` |
| Active features | Migrate as Beads | documents-redesign and stacks become Beads epics |

## Architecture

### Before (Superpowers)

```
CLAUDE.md                        # Root - references superpowers workflow (needs update)
AGENTS.md                        # Created by Beads init (keep)

docs/
├── sessions/DEV-NOTES.md        # 111 sessions, 8,447 lines
├── plans/
│   ├── roadmap/                 # IN-PROGRESS, TODO, COMPLETE, FUTURE
│   ├── issues/ACTIVE.md         # 31 tracked issues
│   ├── todo/                    # stack-agent/, backend-hardening/
│   ├── in-progress/             # documents-redesign, stacks
│   └── complete/                # 24 completed features (20+ have superpowers refs)
├── specs/                       # PRD, ARCHITECTURE, SCHEMA
├── marketing/                   # Out of scope - keep as-is
└── CLAUDE.md                    # Docs-level - also references superpowers (needs update)

.claude/commands/
├── continue.md
├── wrap-up.md
├── handover-prompt.md
├── execute.md
└── ... (8 total)
```

### After (Space-Agents)

```
CLAUDE.md                        # Updated to reference Space-Agents workflow
AGENTS.md                        # Beads landing instructions (keep)

.space-agents/
├── comms/
│   └── capcom.md                # Transformed from DEV-NOTES (111+ sessions)
└── exploration/
    ├── ideas/
    ├── planned/
    ├── staged/
    └── complete/

.beads/
└── beads.db                     # Issue tracking (SQLite mode)

docs/
├── archive/                     # Old plans, issues, sessions (read-only)
├── specs/                       # PRD, ARCHITECTURE, SCHEMA (keep)
├── marketing/                   # Unchanged
└── CLAUDE.md                    # Updated to reference Space-Agents workflow
```

## Data Flows

### Session Lifecycle

```
Before: /continue → work → /wrap-up → DEV-NOTES append
After:  /launch → work → /land → CAPCOM append + Beads sync
```

### Issue Tracking

```
Before: Manually edit docs/plans/issues/ACTIVE.md
After:  bd create, bd update, bd list, bd ready
```

### Feature Planning

```
Before: docs/plans/todo/ → in-progress/ → complete/
After:  exploration/ideas/ → planned/ → staged/ → complete/ + Beads
```

## Migration Tasks (High Level)

### 1. DEV-NOTES → CAPCOM Transformation

**Input:** `docs/sessions/DEV-NOTES.md` (8,447 lines, 111 sessions)

**Current format:**
```markdown
## Session N - YYYY-MM-DD - Description [optional ✅]

**Feature**: ...
**Branch**: ...

### Tasks Completed
- [x] ...

### Key Decisions
| Decision | Choice | Reasoning |
...

### Next Session
**Task**: ...
```

**Target format:**
```markdown
## [YYYY-MM-DD HH:MM] Session N

**Branch:** branch | **Git:** clean/uncommitted

### What Happened
[Narrative from Tasks Completed]

### Decisions Made
[From Key Decisions table]

### Next Action
[From Next Session]

---
```

**Edge cases:**
- Session 15: Uses colon and date in body (variant format)
- Session 50: Duplicate (two entries with same number)
- Missing sessions: 49, 61, 69 (gaps)
- Date typos: Sessions 80-81 say 2025 instead of 2026

**Approach:** Python script for multi-pattern handling

### 2. Issue Migration (31 issues)

- Parse `docs/plans/issues/ACTIVE.md`
- Create Beads issues with `bd create`
- Preserve categories (bug, feature, tech-debt)
- Link dependencies where applicable

### 3. Active Feature Migration

**In Progress:**

- **documents-redesign** - 4 phase plan files, convert to Beads epic with tasks per phase
- **stacks** - Paused feature, convert to Beads epic, mark as blocked/paused

**In Todo:**

- **stack-agent** - Planned feature, convert to Beads epic
- **backend-hardening** - Planned feature, convert to Beads epic

### 4. Folder Restructuring

```bash
# Archive old structure
mkdir -p docs/archive
mv docs/plans docs/archive/
mv docs/sessions docs/archive/

# Keep specs
# docs/specs/ stays as-is (PRD, ARCHITECTURE, SCHEMA)
# docs/marketing/ stays as-is (out of scope)

# Update BOTH CLAUDE.md files to reference Space-Agents workflow
# - Root CLAUDE.md (lines 19-42 reference superpowers)
# - docs/CLAUDE.md (lines 3-42 reference superpowers)
```

### 5. Bulk Superpowers Reference Cleanup

**Problem:** 20+ plan files in `complete/` and `archive/` contain:
```
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-step.
```

**Approach:**
- Grep for `superpowers:` references across all markdown files
- Remove or update these instructions in archived plans
- Low priority since archived files are read-only reference

### 6. Command Cleanup

Remove or archive `.claude/commands/`:
- `continue.md` → replaced by `/launch`
- `wrap-up.md` → replaced by `/land`
- `handover-prompt.md` → no longer needed (CAPCOM persists)
- `execute.md` → replaced by `/mission-*`
- `orchestrate.md` → replaced by `/mission-orchestrated`

Keep if still useful:
- `code-review.md` → may complement `/review`
- `debug.md` → may complement `/debug`
- `issue.md` → replaced by `bd create`

## Error Handling

- **DEV-NOTES parsing failure:** Script should log unparseable entries, not fail
- **Beads migration failure:** Individual issue failures shouldn't block others
- **Folder move conflicts:** Check for uncommitted changes before moving

## Testing Approach

1. **Dry run DEV-NOTES transformation** - output to temp file, verify format
2. **Sample Beads migration** - create 2-3 test issues, verify structure
3. **Verify existing work** - ensure documents-redesign context is preserved
4. **Run `/launch`** - confirm new system works

## Validation Notes

Report validated against codebase on 2026-01-25. Corrections made:
- Issue count: 41 → 31 (actual count in ACTIVE.md)
- Added dual CLAUDE.md files (root + docs/) that both need updating
- Added AGENTS.md to structure (created by Beads init)
- Added todo/ features: stack-agent, backend-hardening
- Removed issues.jsonl from target (using SQLite mode)
- Added bulk superpowers reference cleanup task (20+ files)
- Confirmed 24 completed features in complete/

## Open Questions

None - all decisions made during brainstorm.

## Next Steps

1. Run `/plan` to create detailed implementation tasks
2. Execute migration in isolated worktree (optional)
3. Verify with `/launch` after migration
