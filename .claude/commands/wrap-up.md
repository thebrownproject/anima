---
description: Wrap up development session and save progress
---

You are wrapping up the current development session. Document progress, update plans, and commit work.

## Step 1: Update Feature Plan

1. Check current feature in `docs/plans/in-progress/`:
   ```bash
   ls docs/plans/in-progress/
   ```

2. Update the plan file (`*-plan.md`) for the feature you worked on:
   - Mark completed tasks with `[x]`
   - Note any blockers or decisions made
   - Update "Current State" section if applicable

## Step 2: Update DEV-NOTES.md

Add a session entry at the END of `docs/DEV-NOTES.md`:

```markdown
---

## Session [N] - YYYY-MM-DD - [Brief Description]

**Feature**: [Feature from plans/in-progress/]
**Branch**: [branch name]

### Tasks Completed

- [x] **[Major task]**:
  - Detail of what was done
  - Files created/modified
  - Key outcomes
- [x] **[Another task]**:
  - Details...

### Key Decisions (if any)

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| [What was decided] | [Choice made] | [Why] |

### Tasks Remaining

- [ ] [What's left to do]
- [ ] [Next priority]

### Next Session

**Task**: [Primary focus for next session]

**Process**:
1. [First step]
2. [Second step]
3. [etc.]
```

Keep notes detailed enough that grepping session titles gives useful context.

## Step 3: Update ROADMAP.md (if milestone reached)

If a feature phase completed or priorities changed:
1. Read `docs/ROADMAP.md`
2. Update "In Progress" or "Completed" sections as needed

## Step 4: Git Commit

1. Check git status:
   ```bash
   git status
   ```

2. Stage changes:
   ```bash
   git add -A
   ```

3. Create commit with clear message (use HEREDOC format):
   ```bash
   git commit -m "$(cat <<'EOF'
   [type]: [Brief summary]

   - Specific change 1
   - Specific change 2

   Feature: [feature name]
   EOF
   )"
   ```

   Types: `feat`, `fix`, `refactor`, `docs`, `chore`

4. Show commit hash and confirm success

## Step 5: Session Summary

Provide user with:

```
📦 Session Wrap-Up Complete

**Feature:** [name]
**Branch:** [name]

**Completed This Session:**
- [Task completed]
- [Files modified]

**Git:**
- Commit: [hash]
- Status: [clean]

**Next Session:**
- Continue with: [Next task]
- Run `/continue` to resume

**Key Files Modified:**
- [file paths]
```

## Step 6: Move to Complete (if feature done)

If the entire feature is complete:

1. Move plan folder:
   ```bash
   git mv docs/plans/in-progress/[feature] docs/plans/complete/
   ```

2. Update reference docs (ARCHITECTURE.md, SCHEMA.md) to reflect new reality

3. Update ROADMAP.md to move feature to "Completed"

## Important Notes

- **Only mark tasks complete if verified working**
- **Document decisions** - Future sessions need context
- **Keep plans up to date** - They're the source of truth for feature progress
