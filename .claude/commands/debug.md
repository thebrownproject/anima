---
description: Spawn debugging subagent for systematic issue investigation
arguments:
  - name: issue
    description: The bug, error, or unexpected behavior to investigate
    required: true
---

Dispatch a debugging subagent to investigate this issue systematically.

## Spawn Debugging Agent

Use the Task tool with `subagent_type: "general-purpose"`.

**Prompt for the agent:**

```
You are debugging an issue. Follow the `systematic-debugging` skill exactly.

## Issue to Investigate

$ARGUMENTS

## Your Job

1. **Phase 1: Root Cause Investigation** (MANDATORY before any fix)
   - Read error messages carefully
   - Reproduce consistently
   - Trace the code path
   - Identify the actual root cause

2. **Phase 2: Hypothesis**
   - Form a clear hypothesis about the cause
   - Explain why this is the root cause

3. **Phase 3: Fix**
   - Implement minimal fix for root cause
   - Don't fix symptoms

4. **Phase 4: Verify**
   - Confirm fix works
   - Ensure no regressions

## MCP Verification

- Use **context7** to verify API usage if relevant
- Use **perplexity** to check for known issues with libraries/frameworks

## Report Format

- **Root Cause**: What actually caused the issue
- **Fix Applied**: What was changed (file:line references)
- **Verification**: How you confirmed it works
- **Regressions Checked**: What else you verified still works
```

## After Debug

Report findings to the user and ask if they want to proceed with the fix or discuss further.
