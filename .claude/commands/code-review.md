---
description: Review code changes for quality, correctness, and best practices
---

Perform a code review on the code written this session by spawning a code review agent.

## Spawn Code Review Agent

Use the Task tool with `subagent_type: "superpowers:code-reviewer"`.

The agent has access to the full conversation context - it already knows what files were created/modified.

**Example prompt to the agent:**

```
Review the code I just created/modified this session. Check for:

1. Code quality and readability
2. TypeScript correctness (types, null safety, no `any`)
3. Framework patterns (Next.js/React hooks, component composition)
4. Library usage (shadcn/ui, TanStack, etc.)
5. Error handling and edge cases
6. Security concerns (injection, XSS, auth)
7. Accessibility (for UI components)

Files to review:
- [list the main files worked on this session]

**Use MCP tools to verify correctness:**
- **shadcn MCP**: Use `view_items_in_registries` and `get_item_examples_from_registries` to verify component patterns match official examples
- **context7**: Resolve library ID then fetch docs to verify hooks/API usage matches current documentation
- **perplexity**: If unsure about a pattern, verify against current best practices

**Output format:**
- Critical issues (must fix) - with file:line references
- Important issues (should fix) - with file:line references
- Suggestions (nice to have)
- What was done well

Be specific and include file paths and line numbers for each issue.
```

## After Review

Report findings to the user:

```
## Code Review Complete

### Critical Issues
- [Issue]: `file.tsx:42` - [Description]

### Important Issues
- [Issue]: `file.tsx:15` - [Description]

### Suggestions
- [Suggestion]

### Done Well
- [Positive feedback]

**Verdict:** Ready to commit / Needs fixes first
```

**Then ask the user:**
- If critical issues found: "Want me to fix the critical issues?"
- If only suggestions: "Ready to commit, or want me to address any suggestions?"
- Offer options if multiple issues: "Which would you like me to address?"

Do NOT auto-fix anything - let the user decide what to fix.

## Usage

- Run `/code-review` after completing a feature, before `/wrap-up`
- Critical issues block commits; suggestions are optional
- Agent takes 30-60 seconds for thorough review
