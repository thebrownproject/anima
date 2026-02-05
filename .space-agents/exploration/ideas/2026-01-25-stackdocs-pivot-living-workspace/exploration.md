# Stackdocs: Canvas Workspace

**Date**: 2026-01-25 (updated 2026-01-26)
**Status**: Ready for Planning
**Type**: Major Feature - Canvas-Based Stacks

---

## Vision

**Document extraction remains the foundation** - users upload documents, AI extracts structured data.

**What's new: the interface paradigm.**

Instead of static tabs with tables, Stacks become canvas workspaces where the AI spawns windows on demand based on what the user asks.

```
User talks → Agent interprets → Windows appear on canvas
```

**Examples:**
- "Show me my invoices" → Document preview windows appear
- "Extract data from these" → Table window populates with extracted data
- "Create a projects list" → Table window spawns
- "Store this contact" → Contacts table updates
- "Create some notes" → Notes window opens

**The insight:** You're building mini-apps on demand. The system molds to what the user needs rather than forcing them through fixed workflows. HAL-OS for the web.

---

## HAL-OS to Stackdocs Translation

| HAL-OS (Terminal) | Stackdocs (Web) |
|-------------------|-----------------|
| Markdown tables (`contacts.md`) | Table windows on canvas |
| Task checklists | Table or Kanban windows |
| Notes files | Notes windows (markdown editor) |
| Subsystem CLAUDE.md | Stack `agent_config` field |
| Folder structure | Stacks in sidebar |
| Agent reads/writes files | Agent creates/updates windows |

The agent's job is the same - read/write structured data. The difference is presentation: markdown in terminal vs React components on canvas.

---

## Technical Decisions (Confirmed)

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **Canvas library** | React Flow (@xyflow/react) | Infinite canvas, zoom/pan, custom React nodes, grid snap built-in |
| **Infinite canvas** | Yes | Pan/zoom, unlimited space for windows |
| **Agent control** | Create and update only | Agent manages content; user owns position/size |
| **Window positioning** | Grid snap | New windows snap to grid |
| **Subbar** | Window tabs | Like browser tabs - click to focus, X to close |
| **Tab design** | Generic icon + title | MVP simplicity |
| **Layout persistence** | localStorage first | Supabase later for cross-device sync |
| **State management** | Zustand | Already using, performant |
| **Agent protocol** | SSE with `canvas` event type | Extends existing event pattern |

---

## Architecture

### What Changes

| Component | Current | New |
|-----------|---------|-----|
| `StackDetailClient` | Tab switcher (Docs/Tables) | React Flow canvas container |
| `StackDocumentsTab` | TanStack table of docs | Document windows on canvas |
| `StackTableView` | TanStack table of rows | Table windows on canvas |
| SubBar | Tab navigation | Window tabs (taskbar) |

### What Stays The Same

- **Sidebar** - Stack navigation, Documents link
- **Header (@header)** - Stack name, breadcrumbs, actions
- **Agent Bar** - Chat input, file drops, SSE status
- **Documents page** - Table view for file management (untouched)
- **Data layer** - Supabase tables, queries, RLS

### Component Structure

```
frontend/components/canvas/
├── stack-canvas.tsx          # React Flow wrapper
├── canvas-window.tsx         # Base window component (title bar, controls)
├── windows/
│   ├── document-window.tsx   # PDF/image preview
│   ├── table-window.tsx      # Data grid
│   └── notes-window.tsx      # Markdown editor
└── stores/
    └── canvas-store.ts       # Zustand store for window state
```

---

## Agent Tools for Canvas

The agent has tools to create and update windows. When a tool is called, it yields an SSE event that the frontend processes.

### Backend Tools

```python
# Agent tools (Claude Agent SDK)
create_window(type="table", title="Expenses", columns=[...], rows=[...])
create_window(type="document", document_id="...", title="invoice.pdf")
create_window(type="notes", title="Meeting Notes", content="...")
update_window(window_id="...", rows=[...])  # Update table data
close_window(window_id="...")
```

### SSE Event Flow

```python
# Backend agent yields
yield {"canvas": "create_window", "data": {"type": "table", "title": "Expenses", ...}}
yield {"canvas": "update_window", "data": {"windowId": "...", "rows": [...]}}
```

```typescript
// Frontend processSSELine() - extend to handle 'canvas' event
if ('canvas' in parsed) {
  onCanvasEvent({ command: parsed.canvas, data: parsed.data })
}
```

### Current SSE Events (for reference)

```python
yield {"text": "..."}      # Agent response text
yield {"tool": "...", "input": {...}}  # Tool activity
yield {"complete": True}   # Done
yield {"error": "..."}     # Error
```

Adding `canvas` event type alongside these.

---

## Window Types (MVP)

| Type | Content | Agent Creates Via |
|------|---------|-------------------|
| **Document** | PDF/image preview (react-pdf) | `create_window(type="document", document_id="...")` |
| **Table** | Editable data grid | `create_window(type="table", columns=[...], rows=[...])` |
| **Notes** | Markdown editor | `create_window(type="notes", content="...")` |

Future: Calendar, Kanban, Chart, Form

---

## Subbar as Window Manager

The subbar becomes a taskbar showing tabs for each window on the canvas.

```
┌─────────────────────────────────────────────────────────────────┐
│  SubBar: [📄 invoice.pdf] [📊 Expenses] [📝 Notes] [+]          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   CANVAS (React Flow)                                           │
│                                                                 │
```

- **Click tab** → Focus/bring window to front
- **X button** → Close window
- **+ button** → Add new window (menu: Document, Table, Notes)

---

## MVP Phases

### Phase 1: Canvas Foundation

**Goal:** Replace StackDetailClient tab content with React Flow canvas.

- [ ] Install @xyflow/react
- [ ] Create `components/canvas/` folder structure
- [ ] Build `StackCanvas` - React Flow wrapper with pan/zoom/grid
- [ ] Build `CanvasWindow` - base node component (title bar, resize, close)
- [ ] Build `DocumentWindow` - renders document preview
- [ ] Build `TableWindow` - renders data grid
- [ ] Create `canvas-store.ts` - Zustand store for window state
- [ ] Update `StackDetailClient` to render `StackCanvas`
- [ ] Update subbar to show window tabs
- [ ] Persist layout to localStorage

**Outcome:** Open a stack → see canvas with draggable windows instead of tabs.

### Phase 2: Agent Integration

**Goal:** Agent can create/update windows via chat.

- [ ] Define `CanvasCommand` types
- [ ] Add `canvas` event type to SSE handler (`agent-api.ts`)
- [ ] Create agent tools: `create_window`, `update_window`, `close_window`
- [ ] Create stack canvas agent with tools
- [ ] Wire frontend to process canvas events → update React Flow nodes
- [ ] Test: "Create an expenses table" → table window appears

**Outcome:** Chat with agent → windows appear/update on canvas.

### Phase 3: Notes + Polish

- [ ] Build `NotesWindow` (markdown editor)
- [ ] Add notes tool to agent
- [ ] Export table as CSV
- [ ] Window creation from sidebar (drag documents)
- [ ] Right-click context menu on canvas

### Phase 4: Future

- Calendar window + sync
- Stack templates
- Keyboard shortcuts
- Mobile responsive

---

## Future Vision: AI-Native OS

The MVP proves the pattern. The long-term vision is bigger:

**The agent can spawn any window type on demand** - not just the predefined Document/Table/Notes, but dynamically generated UI based on what the user needs.

```
User: "I need a kanban for my job applications"
Agent: Creates kanban window with columns (Applied, Interview, Offer, Rejected)

User: "Track my expenses with a chart"
Agent: Creates table + chart window linked to it

User: "Build me a contacts CRM"
Agent: Creates contacts table + notes + calendar integration

User: "I need a habit tracker"
Agent: Creates custom tracker window with daily checkboxes
```

**The system molds to the user.** No fixed app boundaries. The agent:
- Creates window types that don't exist yet (within a component library)
- Connects windows together (table → chart, document → extraction → table)
- Remembers context across sessions (CAPCOM pattern)
- Manages data structures automatically (creates Supabase tables as needed)

**HAL-OS in the browser.** What you do in terminal with markdown files and CLI commands, non-technical users do on the web with natural language and visual windows.

This is the future of personal computing: AI generates the interface.

---

## Files to Modify

### Frontend

| File | Change |
|------|--------|
| `package.json` | Add @xyflow/react |
| `components/canvas/*` | NEW - all canvas components |
| `components/stacks/stack-detail-client.tsx` | Replace tabs with StackCanvas |
| `app/(app)/stacks/[id]/@subbar/page.tsx` | Window tabs instead of tab navigation |
| `lib/agent-api.ts` | Add `canvas` event type to processSSELine |
| `components/agent/stores/agent-store.ts` | Optional: canvas event queue |

### Backend

| File | Change |
|------|--------|
| `app/agents/stack_agent/` | NEW - stack canvas agent |
| `app/agents/stack_agent/tools.py` | create_window, update_window, close_window |
| `app/routes/agent.py` | Endpoint for stack canvas agent |

---

## Data Model

No schema changes needed for MVP. Window layout stored in localStorage.

Future: Add `stacks.canvas_layout` JSONB field for server-side persistence.

---

## Success Criteria

1. Open a stack → see React Flow canvas (not tabs)
2. Windows can be dragged, resized, closed
3. Subbar shows tabs for each window
4. Layout persists in localStorage
5. (Phase 2) Agent can create windows via chat

---

*Last updated: 2026-01-26*
*Status: Ready for `/exploration-plan`*
