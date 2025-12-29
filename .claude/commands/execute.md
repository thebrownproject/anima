---
description: Execute plan with subagents and review checkpoints
---

Execute the current plan using the `subagent-driven-development` skill.

## Subagent Instructions

When dispatching subagents (implementer, spec-reviewer, or code-reviewer),
include these MCP verification instructions in the prompt:

- **context7**: Resolve library ID then fetch current docs to verify API usage
- **shadcn MCP**: Use `view_items_in_registries` and `get_item_examples_from_registries`
  to verify component patterns match official examples
- **perplexity**: Verify against current best practices if uncertain

Subagents should verify against current documentation, not just training knowledge.

## Checkpoint Rule

Pause for human review after:
- Completing a phase (as defined in the plan)
- Or when a meaningful chunk of work is done

Present:
- Summary of what was built
- Key decisions made by subagents
- Any patterns or issues worth noting

Then ask: "Ready to continue to the next phase?"

## Before Starting

Check if currently in a git worktree:

```bash
git rev-parse --show-toplevel
git worktree list
```

If NOT in a worktree, ask:
> "This feature could use an isolated worktree for clean separation.
> Want me to set one up using `using-git-worktrees`, or proceed in the current branch?"

- If yes → Use `using-git-worktrees` skill to create worktree first
- If no → Proceed in current branch

## Begin

Read the plan from `docs/plans/in-progress/` and present an execution briefing:

```
## Execution Briefing

**Plan**: [plan name]
**Total Tasks**: [N tasks]
**Phases**: [list phases with task counts]

**Checkpoint Schedule**:
- After Phase 1: [task names] → pause for review
- After Phase 2: [task names] → pause for review
- ...

**Estimated Scope**: [brief summary of what will be built]

Ready to begin execution?
```

Wait for user confirmation before starting.
