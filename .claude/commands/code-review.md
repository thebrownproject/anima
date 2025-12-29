---
description: Request code review on recent changes
---

Use the `requesting-code-review` skill to review recent changes.

**IMPORTANT:** Always dispatch the `superpowers:code-reviewer` subagent for code reviews. Do not review inline.

## Subagent Instructions

When dispatching the code-reviewer subagent, include these MCP verification instructions:

- **context7**: Resolve library ID then fetch current docs to verify API usage
- **shadcn MCP**: Use `view_items_in_registries` and `get_item_examples_from_registries`
  to verify component patterns match official examples
- **perplexity**: Verify against current best practices if uncertain

## After Review

Follow the `receiving-code-review` skill to handle feedback properly:
- Verify before implementing
- Push back if reviewer is wrong (with technical reasoning)
- Fix one item at a time, test each

Report findings and ask if user wants to address any issues.
