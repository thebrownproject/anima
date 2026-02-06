# Feature: Superpowers to Space-Agents Migration

**Goal:** Migrate Stackdocs from superpowers workflow to Space-Agents with Beads integration

## Overview

This migration transitions the project from the existing superpowers workflow (custom commands, DEV-NOTES, manual issue tracking) to the Space-Agents system (CAPCOM, Beads, exploration folders). The migration preserves all historical context while enabling the new workflow.

Key components:
- 111 sessions of DEV-NOTES history → CAPCOM format
- 31 tracked issues → Beads
- 4 active features → Beads epics
- 2 CLAUDE.md files → updated references
- Folder restructuring with archive

## Tasks

### Task: Transform DEV-NOTES to CAPCOM

**Goal:** Convert 111 sessions from DEV-NOTES.md to CAPCOM format
**Files:** Create `scripts/migrate-dev-notes.py`, Modify `.space-agents/comms/capcom.md`
**Depends on:** None

**Steps:**
1. Create Python script to parse DEV-NOTES.md
2. Handle standard format: `## Session N - YYYY-MM-DD - Description`
3. Handle variant format: Session 15 with colon and date in body
4. Handle edge cases: duplicate Session 50, missing 49/61/69, date typos in 80-81
5. Transform to CAPCOM format: `## [YYYY-MM-DD] Session N`
6. Map sections: Tasks Completed → What Happened, Key Decisions → Decisions Made, Next Session → Next Action
7. Dry run to temp file, verify output
8. Append transformed content to capcom.md
9. Verify grep-ability of final output

**Acceptance:**
- All 111 sessions in CAPCOM with correct format
- Grep `"Session 50"` returns entries
- No parse errors logged

---

### Task: Migrate Issues to Beads

**Goal:** Convert 31 issues from ACTIVE.md to Beads
**Files:** Read `docs/plans/issues/ACTIVE.md`, Create Beads via `bd create`
**Depends on:** None

**Steps:**
1. Read and parse ACTIVE.md format (checkbox list with categories)
2. Extract: issue title, category (bug/feature/tech-debt), description
3. For each issue:
   - `bd create "<title>" -t bug|task -p <priority>`
   - Add labels if category info available
4. Run `bd sync` after all creates
5. Verify with `bd list` that all 31 issues exist

**Acceptance:**
- 31 issues in Beads
- Categories preserved as labels or types
- `bd list` shows all migrated issues

---

### Task: Migrate Features to Beads

**Goal:** Convert 4 features from plans/ to Beads epics with tasks
**Files:** Read `docs/plans/in-progress/`, `docs/plans/todo/`, Create Beads
**Depends on:** Migrate Issues to Beads

**Steps:**
1. **documents-redesign** (in-progress, 4 phases):
   - Create epic: `bd create "Documents Redesign" -t feature`
   - Create tasks for each phase under the epic
   - Mark as in_progress

2. **stacks** (in-progress, paused):
   - Create epic: `bd create "Stacks" -t feature`
   - Create tasks from plan
   - Add blocker note or mark as blocked

3. **stack-agent** (todo):
   - Create epic: `bd create "Stack Agent" -t feature`
   - Create tasks from plan
   - Leave as open/pending

4. **backend-hardening** (todo):
   - Create epic: `bd create "Backend Hardening" -t feature`
   - Create tasks from plan
   - Leave as open/pending

5. Set up any cross-feature dependencies with `bd dep add`
6. Run `bd sync`

**Acceptance:**
- 4 feature epics in Beads
- documents-redesign has 4 phase tasks
- `bd list -t feature` shows all 4

---

### Task: Update CLAUDE.md Files

**Goal:** Update both CLAUDE.md files to reference Space-Agents workflow
**Files:** Modify `CLAUDE.md` (root), Modify `docs/CLAUDE.md`
**Depends on:** None

**Steps:**
1. **Root CLAUDE.md** (lines 19-42):
   - Replace superpowers workflow table with Space-Agents commands
   - Update session commands: `/launch`, `/land`, `/capcom`
   - Update planning flow: `/exploration` → `/plan` → `/mission`
   - Remove references to `/continue`, `/wrap-up`, `/handover-prompt`

2. **docs/CLAUDE.md** (lines 3-42):
   - Update workflow instructions to match new system
   - Reference `.space-agents/` instead of `docs/plans/`
   - Update Beads commands instead of manual issue tracking

3. Keep AGENTS.md unchanged (Beads landing instructions)

**Acceptance:**
- No `superpowers:` references in either CLAUDE.md
- `/launch`, `/land`, `/mission` documented
- `docs/plans/` references updated to `.space-agents/exploration/`

---

### Task: Restructure Folders

**Goal:** Archive old structure, keep specs and marketing
**Files:** Move `docs/plans/`, `docs/sessions/` to `docs/archive/`
**Depends on:** Transform DEV-NOTES, Migrate Issues, Migrate Features

**Steps:**
1. Verify all migrations completed successfully
2. Create archive directory: `mkdir -p docs/archive`
3. Move old plans: `git mv docs/plans docs/archive/`
4. Move old sessions: `git mv docs/sessions docs/archive/`
5. Keep unchanged:
   - `docs/specs/` (PRD, ARCHITECTURE, SCHEMA)
   - `docs/marketing/`
   - `docs/CLAUDE.md` (already updated)
6. Commit the restructuring

**Acceptance:**
- `docs/archive/plans/` contains old structure
- `docs/archive/sessions/DEV-NOTES.md` preserved
- `docs/specs/` still accessible
- No broken references in active code

---

### Task: Cleanup Commands

**Goal:** Archive or delete old .claude/commands/ that are replaced
**Files:** Modify `.claude/commands/`
**Depends on:** Restructure Folders

**Steps:**
1. Verify new system works: run `/launch` successfully
2. Archive replaced commands:
   - `continue.md` → replaced by `/launch`
   - `wrap-up.md` → replaced by `/land`
   - `handover-prompt.md` → replaced by CAPCOM
   - `execute.md` → replaced by `/mission-*`
   - `orchestrate.md` → replaced by `/mission-orchestrated`
   - `issue.md` → replaced by `bd create`
3. Keep potentially useful:
   - `code-review.md` → may complement `/review`
   - `debug.md` → may complement `/debug`
4. Either delete or move to `.claude/commands/archive/`

**Acceptance:**
- `/launch` works without old commands
- No duplicate functionality
- Useful commands retained

---

### Task: Cleanup Superpowers References

**Goal:** Remove stale superpowers references from archived plan files
**Files:** Multiple files in `docs/archive/plans/complete/` and `docs/archive/plans/archive/`
**Depends on:** Restructure Folders

**Steps:**
1. Grep for superpowers references:
   ```bash
   grep -r "superpowers:" docs/archive/ --include="*.md"
   ```
2. Identify files with `REQUIRED SUB-SKILL: Use superpowers:executing-plans`
3. Options:
   - Remove the instruction lines entirely
   - Replace with note: `<!-- Historical: was superpowers workflow -->`
   - Leave as-is (archived files, low impact)
4. If modifying: bulk sed/awk or script

**Acceptance:**
- No confusing superpowers instructions in active paths
- Archived files clearly marked as historical
- Low priority - can defer if time constrained

---

## Sequence

```
Phase 1 - Data Migration (Parallel):
├── Task: Transform DEV-NOTES to CAPCOM
├── Task: Migrate Issues to Beads
└── Task: Update CLAUDE.md Files

Phase 2 - Feature Migration (Sequential):
└── Task: Migrate Features to Beads
    └── (depends on Issues migration for Beads familiarity)

Phase 3 - Restructuring:
└── Task: Restructure Folders
    └── (depends on all migrations complete)

Phase 4 - Cleanup:
├── Task: Cleanup Commands
│   └── (depends on restructuring, verify new system)
└── Task: Cleanup Superpowers References
    └── (low priority, can defer)

Verification Gate:
└── Run /launch and confirm system works
```

## Success Criteria

- [ ] CAPCOM contains all 111 sessions in correct format
- [ ] 31 issues exist in Beads with correct types
- [ ] 4 features exist as Beads epics with tasks
- [ ] Both CLAUDE.md files reference Space-Agents (no superpowers)
- [ ] Old structure archived in docs/archive/
- [ ] Old commands archived or deleted
- [ ] `/launch` successfully shows project status
- [ ] `/land` successfully appends to CAPCOM
