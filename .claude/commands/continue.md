---
description: Resume StackDocs development from where you left off
---

You are resuming the **StackDocs** project. Get oriented and wait for direction.

**FIRST**: Activate the using-superpowers skill to ensure proper workflow:
```
/superpowers:using-superpowers
```

**TOKEN BUDGET**: Target <5,000 tokens for initial context loading. Use grep/offset/limit to read selectively.

## Step 1: Read Context

**CRITICAL**: Use offset/limit parameters to avoid loading entire files.

Read in order:

1. **Read ROADMAP.md** (current progress):

   ```
   Read docs/ROADMAP.md
   ```

   - Shows what's In Progress vs Todo vs Completed
   - Identifies current feature being worked on

2. **Latest session only** from `docs/DEV-NOTES.md`:

   - First run: `grep -n "^## Session" docs/DEV-NOTES.md | tail -1`
   - Extract the line number (e.g., "2137:## Session 18 - ..." → 2137)
   - Then use Read tool with offset: `Read docs/DEV-NOTES.md offset=[line_number]`
   - **Key benefit**: "Next Session" section shows what to work on next

3. **Skip reading these at startup** (grep on-demand instead):
   - `docs/PRD.md` - Only grep specific requirements when needed
   - `docs/ARCHITECTURE.md` - Grep for specific sections during implementation
   - `docs/SCHEMA.md` - Grep for table definitions when needed

## Step 2: Check Git Status

```bash
git branch --show-current
git status --short
```

## Step 3: Identify Current Work

From ROADMAP.md and latest DEV-NOTES session:

- What feature is **In Progress**?
- What was the **last completed task**?
- What is the **next step**?

Check `docs/plans/in-progress/` for active feature plans:

```bash
ls docs/plans/in-progress/
```

## Step 4: Present Summary

```
📍 StackDocs Status

**Branch:** [name]
**Current Feature:** [feature name from ROADMAP In Progress]

**Progress:**
✅ Last: [What was completed in last session]
📂 Plan: docs/plans/in-progress/[feature]/

**Next Steps** (from DEV-NOTES):
[List next steps from last session's "Next Session" section]

**Git:** [clean or uncommitted changes]

**Awaiting your direction:**
- `/superpowers:brainstorm` - Design a new feature
- `/superpowers:write-plan` - Create implementation plan from design
- `/superpowers:execute-plan` - Execute existing plan
```

## Step 5: Wait for User Direction

**IMPORTANT**: Do NOT start any work until user triggers a superpowers command or gives explicit instruction.

Present the summary and wait. The user will choose:

- `/superpowers:brainstorm` for new feature design
- `/superpowers:write-plan` to create implementation plan
- `/superpowers:execute-plan` to continue implementation
- Or give direct instructions

## Project Reminders

**Architecture:**

- Frontend → Supabase directly (reads, writes, realtime)
- Frontend → FastAPI (AI agent triggers only)
- FastAPI → Claude Agent SDK → Supabase (extractions)

**Key Locations:**

- Plans: `docs/plans/in-progress/[feature]/`
