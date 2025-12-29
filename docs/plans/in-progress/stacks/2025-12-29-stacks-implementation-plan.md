# Stacks Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Stacks feature for batch document extraction with AI-first UX.

**Architecture:**
- Frontend: Next.js 16 App Router with parallel routes, TanStack Table, contextual sub-bar with tabs
- Backend: FastAPI with Claude Agent SDK, SSE streaming, scoped MCP tools
- Database: Existing Supabase tables (stacks, stack_documents, stack_tables, stack_table_rows)

**Tech Stack:** Next.js 16, TanStack Table v8, Supabase JS, FastAPI, Claude Agent SDK, shadcn/ui

---

## Plan Structure

This implementation is split into multiple files for clarity:

| File | Description |
|------|-------------|
| [01-foundation.md](./01-foundation.md) | Types, queries, sidebar integration |
| [02-stack-pages.md](./02-stack-pages.md) | Stacks list page, stack detail page with tabs |
| [03-stack-tables.md](./03-stack-tables.md) | Table view component with dynamic columns |
| [04-backend-routes.md](./04-backend-routes.md) | Stack API routes and SSE endpoints |
| [05-agent-tools.md](./05-agent-tools.md) | Stack agent tool implementations |
| [06-chat-bar-integration.md](./06-chat-bar-integration.md) | Dynamic chat bar for stacks |

---

## Implementation Order

### Phase 1: Foundation (01-foundation.md)
1. Type definitions for stacks
2. Supabase query functions
3. Sidebar integration with dynamic stacks

### Phase 2: Frontend Pages (02-stack-pages.md)
4. Stacks list page
5. Stack detail page with tabs
6. Header parallel routes

### Phase 3: Stack Table View (03-stack-tables.md)
7. StackTableView component with dynamic columns
8. "Not extracted" indicator for pending docs
9. CSV export functionality

### Phase 4: Backend (04-backend-routes.md)
10. Stack creation endpoint
11. Add document to stack endpoint
12. Extract table data (SSE streaming)

### Phase 5: Agent Tools (05-agent-tools.md)
13. Read tools (documents, OCR, existing extractions)
14. Write tools (create table, set columns, save rows)
15. System prompts for stack agent

### Phase 6: Chat Bar (06-chat-bar-integration.md)
16. Stack-context aware chat bar
17. Agent popup states
18. Integration with stack detail page

---

## Key Patterns to Follow

### Frontend Data Fetching
```typescript
// Use React cache() for deduplication across parallel routes
export const getStackWithDetails = cache(async function(stackId: string) {
  const supabase = await createServerSupabaseClient()
  // ... fetch logic
})
```

### Backend SSE Streaming
```python
@router.post("/extract")
async def extract_with_streaming(...):
    async def event_stream() -> AsyncIterator[str]:
        async for event in extract_with_agent(...):
            yield f"data: {json.dumps(event)}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

### Agent Tool Pattern
```python
def create_tool(stack_id: str, user_id: str, db: Client):
    @tool("tool_name", "description", {})
    async def tool_fn(args: dict) -> dict:
        # Scoped to stack_id and user_id
        return {"content": [{"type": "text", "text": "..."}]}
    return tool_fn
```

---

## Success Criteria

- [ ] User can create stack via sidebar `+` button
- [ ] User can add documents (new upload or existing)
- [ ] User can create table with AI-suggested columns
- [ ] Table view shows spreadsheet with document column
- [ ] New documents show "not extracted" indicator
- [ ] Export to CSV works
- [ ] Chat bar shows dynamic status during operations
