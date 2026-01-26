# Stackdocs Pivot: From Document Extraction to Living Workspace

**Date**: 2026-01-25
**Status**: Exploration Complete
**Type**: Major Product Pivot

---

## Executive Summary

Stackdocs pivots from a document extraction SaaS ($50-100/month for SMBs) to a **personal AI workspace platform** - essentially HAL-OS for the web, designed for non-technical users. The system "molds to the user" by generating UI components on demand through natural language conversation.

The core insight: **Stacks evolve from "document groupings for batch extraction" into persistent workspaces/apps** - like HAL-OS's subsystems (calendar, networking, second-brain, vibe) but web-based with Supabase as the data layer.

---

## The Vision

### From This (Current Stackdocs)
```
Upload document → AI extracts structured data → Download CSV/JSON
```

### To This (Living Workspace)
```
Chat with AI → Windows appear on canvas → Manage your digital life
```

### Core Principles

1. **Chat-first interaction** - Users talk to the system in natural language, not through menus
2. **Canvas as desktop** - Windows/cards appear on demand, representing data and tools
3. **Stacks as apps** - Persistent workspaces with their own data and agent configuration
4. **Agents are invisible** - Users see results, not the orchestration behind them
5. **System molds to user** - No fixed phases or workflows; the system adapts to what you need

---

## Architecture Overview

### Implementation Strategy: Evolve, Don't Rebuild

**Key insight:** Transform Stacks into canvas workspaces while keeping the rest of the app intact.

- **Documents section** → Keep as-is (table view for file management)
- **Stacks section** → Transform into canvas workspaces
- **Navigation** → Keep existing header + subbar parallel routes
- **Chat bar** → Keep existing agent bar at bottom

This is an evolution of the current UI, not a rebuild.

### Current vs New Layout

**Current Stack Detail (`/stacks/[id]`):**
```
┌─────────────────────────────────────────────────────────────────┐
│  Header: "Invoice Processing"                      Actions      │
├─────────────────────────────────────────────────────────────────┤
│  SubBar: [Documents] [Table 1] [Table 2]    Search   Filter     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   TanStack Table (one view at a time, tab-based)                │
│   - Documents tab shows docs in stack                           │
│   - Table tabs show extracted data                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  💬 Agent Bar: "How can I help you today?"                      │
└─────────────────────────────────────────────────────────────────┘
```

**New Stack Detail (`/stacks/[id]`):**
```
┌─────────────────────────────────────────────────────────────────┐
│  Header: "Invoice Processing"                      Actions      │
├─────────────────────────────────────────────────────────────────┤
│  SubBar: Canvas controls (zoom, grid toggle, etc.)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   CANVAS (replaces tab content)                                 │
│                                                                 │
│   ┌──────────────┐  ┌──────────────────────┐                   │
│   │ invoice1.pdf │  │ Extracted Data       │                   │
│   │ [preview]    │  │ ──────────────────   │                   │
│   │              │  │ Vendor | Amount      │                   │
│   └──────────────┘  │ Acme   | $1,200      │                   │
│                     │ Bob Co | $850        │                   │
│   ┌──────────────┐  └──────────────────────┘                   │
│   │ invoice2.pdf │                                              │
│   └──────────────┘                                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  💬 Agent Bar: "Extract all invoices into the table"            │
└─────────────────────────────────────────────────────────────────┘
```

### What Changes

| Component | Current | New |
|-----------|---------|-----|
| `StackDetailClient` | Tab switcher (Docs/Tables) | Canvas container |
| `StackDocumentsTab` | TanStack table of docs | → Document windows on canvas |
| `StackTableView` | TanStack table of rows | → Table windows on canvas |
| SubBar | Tab navigation + search | Canvas controls + search |
| Data model | Same | Same (stack_documents, stack_tables, stack_table_rows) |

### What Stays The Same

| Component | Notes |
|-----------|-------|
| **Sidebar** | Stack navigation, Documents link, Recent Stacks |
| **Header (@header)** | Stack name, breadcrumbs, actions |
| **Agent Bar** | Chat input, file drops, SSE status |
| **Documents page** | Table view for file management (untouched) |
| **Data layer** | Supabase tables, queries, RLS |

### Component Architecture

```
app/(app)/stacks/[id]/page.tsx
└── StackDetailClient (modified)
    └── StackCanvas (NEW)
        ├── CanvasArea
        │   ├── DocumentWindow (draggable)
        │   ├── TableWindow (draggable)
        │   └── NotesWindow (draggable)
        └── CanvasControls (zoom, grid, etc.)

components/canvas/ (NEW folder)
├── stack-canvas.tsx          # Main canvas container
├── canvas-area.tsx           # Drag/drop area with grid
├── canvas-window.tsx         # Base draggable window component
├── windows/
│   ├── document-window.tsx   # PDF/image preview
│   ├── table-window.tsx      # Data grid
│   └── notes-window.tsx      # Markdown editor
└── stores/
    └── canvas-store.ts       # Zustand store for window state
```

---

## Documents vs Stacks: Two Paradigms

### Documents = File Browser (Keep As-Is)

The Documents section remains a traditional file management interface:
- Table/list view of all uploaded files
- Bulk upload, organize, tag, delete
- Preview panel on the right
- Filter by type, date, stacks

**Why keep it:** Already built, still useful for file management. Can deprecate later if Stacks subsumes it.

### Stacks = Canvas Workspaces (Transform)

Stacks become dynamic canvas workspaces where windows appear:
- Each stack is a persistent workspace (like HAL-OS subsystems)
- Documents, tables, notes appear as draggable windows
- Agent can create/manipulate windows via chat
- Layout persists per stack

**Why transform:** This is where the innovation happens. Stacks already have the right mental model ("create a stack for invoices"), we're just changing the UI from tabs to canvas.

### User Mental Model

| Need | Where to Go |
|------|-------------|
| "I need to upload some files" | Documents |
| "I need to organize my invoices" | Create a Stack |
| "I need to track expenses" | Create a Stack with table |
| "I need a calendar view" | Create a Stack (future) |

---

## Stacks: The App Model

### Concept

Stacks are **persistent workspaces** - the web equivalent of HAL-OS's storage subsystems. Each stack:

- Lives in the sidebar
- Has its own data (tables, documents, files)
- Has its own agent configuration (like subsystem CLAUDE.md)
- Can spawn windows on the canvas
- Remembers context across sessions

### HAL-OS to Stackdocs Mapping

| HAL-OS | Stackdocs | Data Model |
|--------|-----------|------------|
| `storage/calendar/` | Calendar stack | Events table + Apple/Google Calendar sync |
| `storage/networking/` | Networking stack | Contacts table + Events table |
| `storage/second-brain/` | Notes stack | Notes table with markdown content |
| `storage/vibe/` | Work stack | Tasks table + Job references |
| Folder's `CLAUDE.md` | Stack's `agent_config` | JSONB field with system prompt |
| Markdown files | Supabase tables + storage | Structured data + file storage |

### Stack Schema (Supabase)

```sql
-- Existing stacks table, enhanced
stacks (
  id uuid primary key,
  user_id uuid references users(id),
  name text not null,
  icon text,  -- emoji or icon name
  description text,
  agent_config jsonb,  -- system prompt, tools, personality
  created_at timestamptz,
  updated_at timestamptz
)

-- Stack can have multiple tables
stack_tables (
  id uuid primary key,
  stack_id uuid references stacks(id),
  name text not null,
  schema jsonb,  -- column definitions
  created_at timestamptz
)

-- Table rows (flexible schema via JSONB)
stack_table_rows (
  id uuid primary key,
  table_id uuid references stack_tables(id),
  data jsonb,
  created_at timestamptz,
  updated_at timestamptz
)

-- Documents attached to stacks
stack_documents (
  stack_id uuid,
  document_id uuid,
  primary key (stack_id, document_id)
)
```

### Stack Agent Configuration

Each stack can have custom agent behavior:

```json
{
  "name": "Networking",
  "system_prompt": "You help Fraser manage professional contacts and networking events. Track who he met, where, and follow-up actions needed.",
  "tools": ["create_contact", "log_event", "set_reminder"],
  "personality": "professional, proactive about follow-ups"
}
```

---

## Canvas: The Workspace

### Technology Decision

**Recommendation: CSS Grid + Framer Motion drag**

| Option | Verdict |
|--------|---------|
| React Flow | Overkill - built for node graphs with edges |
| tldraw | Consider if infinite canvas needed later |
| Konva | Too low-level, not React-native |
| Custom + Framer | Best fit - already using Framer, full control |

### Canvas Features

- **Draggable windows** - Move cards freely on canvas
- **Resize handles** - Adjust window size
- **Z-index management** - Click to bring forward
- **Minimize/close** - Window chrome controls
- **Persist layout** - Remember positions per stack

### Window Component Types

| Type | Content | Actions |
|------|---------|---------|
| **Document Preview** | PDF/image viewer | Download, extract, delete |
| **Table** | Editable data grid | Sort, filter, export CSV, add row |
| **Calendar** | Month/week/day view | Add event, sync external |
| **Notes** | Markdown editor | Save, format, link |
| **Chart** | Visualization | Change type, export |
| **Form** | Data entry | Submit, validate |
| **List** | Simple items | Check off, reorder |

---

## Agent-to-UI Protocol

### How It Works

User speaks → Agent processes → Agent sends UI command → Frontend renders

### Command Structure

```typescript
interface CanvasCommand {
  action: 'create' | 'update' | 'remove' | 'focus';
  windowId: string;
  type: 'document' | 'table' | 'calendar' | 'notes' | 'chart' | 'form' | 'list';
  title: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  data: WindowData;  // Type-specific payload
}

// Example: Create a table
{
  action: 'create',
  windowId: 'window-1',
  type: 'table',
  title: 'Harbourtown Expenses',
  data: {
    columns: [
      { id: 'date', name: 'Date', type: 'date' },
      { id: 'vendor', name: 'Vendor', type: 'text' },
      { id: 'amount', name: 'Amount', type: 'currency' }
    ],
    rows: [
      { date: '2026-01-20', vendor: 'Bunnings', amount: 1200 },
      { date: '2026-01-22', vendor: 'Officeworks', amount: 350 }
    ],
    sourceTable: 'stack_tables:uuid-here'
  }
}
```

### SSE Streaming

Agent streams commands as events:

```
event: canvas
data: {"action": "create", "type": "table", ...}

event: status
data: {"message": "Extracting data from 3 invoices..."}

event: canvas
data: {"action": "update", "windowId": "window-1", "data": {...}}

event: complete
data: {"message": "Created expenses table with 12 entries"}
```

Frontend listens and updates canvas in real-time.

---

## Chat Bar: The Command Interface

### Current State (Stackdocs)

- Agent bar at bottom of screen
- Dynamic Island pattern (expands for flows)
- File upload via popup
- SSE streaming for status

### Enhanced For Pivot

- **File drop zone** - Drag files directly onto bar
- **Natural language primary** - Text input is main interaction
- **Context awareness** - Knows current stack, visible windows
- **Suggestions** - Quick actions based on context

### Example Interactions

| User Says | Agent Does |
|-----------|------------|
| "Here are my January invoices" + drops PDFs | Creates document preview windows on canvas |
| "Extract expenses into a table" | Runs extraction, creates table window |
| "Show my calendar" | Opens calendar window (syncs if connected) |
| "Add meeting with Anh Tuesday 3pm" | Creates calendar event |
| "Create a stack for job hunting" | Creates new stack in sidebar |
| "Export this as CSV" | Downloads table data |
| "What did I discuss with Sai?" | Searches notes/contacts, shows results |

---

## Data Layer

### Supabase as File System

Just as HAL-OS uses markdown files, Stackdocs uses Supabase:

| HAL-OS | Stackdocs |
|--------|-----------|
| Folder structure | Stack hierarchy |
| Markdown files | JSONB in tables |
| File contents | `stack_table_rows.data` |
| CLAUDE.md | `stacks.agent_config` |
| tmp.md | Session state (Zustand, ephemeral) |

### Hybrid Data Sources

The agent draws from multiple sources:

1. **Conversation history** - Current session context
2. **Stack data** - Tables, documents in active stack
3. **User profile** - Preferences, connected accounts
4. **External APIs** - Calendar sync, etc.

### CAPCOM Pattern (Session Logging)

Adopt Space-Agents CAPCOM for web:

```sql
session_logs (
  id uuid primary key,
  user_id uuid,
  stack_id uuid,  -- optional, if stack-specific
  timestamp timestamptz,
  summary text,  -- AI-generated session summary
  decisions jsonb,  -- key decisions made
  next_actions jsonb  -- suggested follow-ups
)
```

Enables context recovery across sessions without bloating conversation history.

---

## What Carries Forward

### From Current Stackdocs

| Component | Status | Changes Needed |
|-----------|--------|----------------|
| Supabase infrastructure | Keep | Add new tables |
| Document upload + storage | Keep | Enhance for drag-drop |
| OCR (Mistral) | Keep | No changes |
| Extraction agents | Keep | Become one capability |
| Agent bar UI | Keep | Enhance for canvas commands |
| Zustand stores | Keep | Add canvas state |
| SSE streaming | Keep | Add canvas event type |
| FastAPI backend | Keep | Add canvas endpoints |
| Claude Agent SDK | Keep | Add new tools |

### From Space-Agents

| Pattern | Application |
|---------|-------------|
| Ralph loop | Background processing for heavy tasks |
| CAPCOM | Session logging for context recovery |
| Beads | Could track user-facing tasks/todos |
| Skill system | Stack agent configurations |
| "Agents are compute" | Stateless agents, state in Supabase |

### From HAL-OS

| Pattern | Application |
|---------|-------------|
| OS metaphor | Stacks as apps, canvas as desktop |
| Subsystem CLAUDE.md | Stack agent configs |
| `/boot`, `/shutdown` | Session lifecycle (login context, logout persist) |
| Memory/Storage split | Session state vs persisted data |
| MCP drivers | Calendar sync, external integrations |

---

## What's New

### New Components (Phase 1)

| Component | Purpose | Location |
|-----------|---------|----------|
| `StackCanvas` | Main canvas container, replaces tab content | `components/canvas/stack-canvas.tsx` |
| `CanvasArea` | Drag/drop zone with optional grid | `components/canvas/canvas-area.tsx` |
| `CanvasWindow` | Base draggable window (title bar, controls) | `components/canvas/canvas-window.tsx` |
| `DocumentWindow` | PDF/image preview in a window | `components/canvas/windows/document-window.tsx` |
| `TableWindow` | Data grid in a window | `components/canvas/windows/table-window.tsx` |
| `NotesWindow` | Markdown editor in a window | `components/canvas/windows/notes-window.tsx` |
| `canvas-store` | Zustand store for window state | `components/canvas/stores/canvas-store.ts` |

### Modified Components

| Component | Change |
|-----------|--------|
| `StackDetailClient` | Replace tab content with `StackCanvas` |
| `@subbar/stacks/[id]` | Remove tab navigation, add canvas controls |
| Agent SSE handler | Add `canvas` event type for window commands |

### New Backend (Phase 2)

| Item | Purpose |
|------|---------|
| `CanvasCommand` type | Agent-to-UI protocol definition |
| `create_window` tool | Agent creates windows on canvas |
| `update_window` tool | Agent updates window content |
| `canvas` SSE event | Stream window commands to frontend |

### Future Integrations

- **Calendar sync** - Google Calendar first, Apple later
- **Notes import** - Notion, Obsidian markdown
- **File sync** - Google Drive, Dropbox

---

## Competitive Context

### AI Co-Founder (aicofounder.com)

Validated the chat + canvas pattern:
- 30,000+ users
- $100k revenue in 12 months
- Chat in center, canvas on right

**Their weaknesses (our opportunities):**

| Their Problem | Our Advantage |
|---------------|---------------|
| No cross-phase memory | CAPCOM pattern |
| Fixed phases (Ideation → Research → etc) | Molds to user |
| Shallow research | Ralph loop for deep work |
| Domain-specific (startups) | General-purpose workspace |
| Website hosting complexity | Focus on personal productivity |

### Differentiation

| Them | Us |
|------|-----|
| Startup validation tool | Personal AI workspace |
| Fixed workflow | Adaptive to user needs |
| One-time research | Persistent stacks with memory |
| Documents as output | Documents as input + output |

---

## User Personas

### Primary: Non-Technical Professional

- Freelancers, consultants, small business owners
- Comfortable with chat interfaces (WhatsApp, Slack)
- Not comfortable with complex software
- Wants things to "just work"
- Values: simplicity, speed, feeling organized

### Secondary: Technical User (Developer)

- Appreciates the power, uses advanced features
- May want API access, custom integrations
- Values: flexibility, automation, extensibility

### Tertiary: Team User (Future)

- Shared stacks, collaborative editing
- Permissions, roles
- Values: coordination, visibility, accountability

---

## Example User Session

### New User Onboarding

1. Signs up, lands on empty canvas
2. System: "Welcome! I'm your AI workspace. What would you like to organize first?"
3. User: "I need to track my freelance invoices"
4. System creates "Invoices" stack, opens on canvas
5. System: "Drop some invoices here and I'll extract the key info"
6. User drops 3 PDFs
7. Document previews appear on canvas
8. System: "I found: Client names, amounts, dates, due dates. Want me to create a tracking table?"
9. User: "Yes"
10. Table window appears with extracted data
11. System: "Your invoices stack is set up. You can ask me to add more, filter by client, or export anytime."

### Returning User Session

1. User logs in, canvas shows last layout
2. System: "Welcome back. You have 2 invoices due this week."
3. User: "Show my calendar"
4. Calendar window opens
5. User: "Add a reminder to follow up with Acme Corp on Friday"
6. Calendar updates, linked to Acme invoice
7. User: "What's my total outstanding?"
8. System calculates from invoices table: "$12,400 across 4 invoices"

---

## Technical Decisions

### Confirmed

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Canvas tech | CSS Grid + Framer Motion | Already using Framer, full control, simple |
| Data persistence | Supabase | Already invested, RLS, realtime |
| Agent framework | Claude Agent SDK | Already using, proven |
| State management | Zustand | Already using, performant |
| Streaming | SSE | Already implemented |

### To Decide

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Window positioning | Free-form vs grid snap | Start free-form, add snap later |
| Calendar integration | Apple vs Google vs both | Google first (API easier) |
| Stack templates | Pre-built vs user-created | Both - templates for onboarding |
| Mobile support | Responsive vs separate app | Responsive first, app later |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep (infinite features) | High | MVP with 3 window types only |
| Canvas performance (many windows) | Medium | Virtualization, limit visible |
| Agent reliability (wrong commands) | High | Confirmation for destructive actions |
| User confusion (too open-ended) | Medium | Guided onboarding, templates |
| Calendar sync complexity | Medium | Start with view-only, add write later |

---

## MVP Scope

### Implementation Approach

**Evolve Stacks, Keep Documents:**
- Documents page remains a table view (file management)
- Stacks become canvas workspaces (the innovation)
- Existing nav bars (@header, @subbar) stay in place
- Agent bar at bottom stays in place

### Phase 1: Canvas in Stacks

**Goal:** Replace `StackDetailClient` tab content with a canvas where windows appear.

- [ ] Create `components/canvas/` folder structure
- [ ] Build `StackCanvas` component with Framer Motion drag
- [ ] Build `CanvasWindow` base component (draggable, resizable, closeable)
- [ ] Build `DocumentWindow` - renders document preview
- [ ] Build `TableWindow` - renders data grid (port from StackTableView)
- [ ] Create `canvas-store.ts` (Zustand) for window positions/state
- [ ] Replace `StackDetailClient` content with `StackCanvas`
- [ ] Persist window layout per stack (Supabase or localStorage)

**Outcome:** Open a stack → see canvas with draggable document/table windows instead of tabs.

### Phase 2: Agent Integration

**Goal:** Agent can create and manipulate windows via chat.

- [ ] Define Agent-to-UI protocol (CanvasCommand type)
- [ ] Add `canvas` event type to SSE streaming
- [ ] Agent tool: `create_window` (type, title, data)
- [ ] Agent tool: `update_window` (windowId, data)
- [ ] Frontend listens to canvas events, updates store
- [ ] "Add invoice1.pdf to canvas" → document window appears
- [ ] "Create expenses table" → table window appears

**Outcome:** Chat with agent → windows appear/update on canvas in real-time.

### Phase 3: Enhanced Workflows

- [ ] Extract data from documents to table windows
- [ ] Export table windows as CSV
- [ ] NotesWindow component (markdown editor)
- [ ] Stack-specific agent configs (custom prompts per stack)
- [ ] File drop directly on canvas (not just chat bar)

### Phase 4: Polish & Expand

- [ ] Calendar window + Google Calendar sync
- [ ] Stack templates (Invoices, Contacts, Notes)
- [ ] Canvas controls in subbar (zoom, grid snap toggle)
- [ ] Keyboard shortcuts (Cmd+N new window, Delete to close, etc.)
- [ ] Mobile responsive canvas
- [ ] Onboarding flow for new users

---

## Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| DAU/MAU ratio | > 30% | Indicates habit formation |
| Stacks per user | > 3 | Shows expansion beyond single use case |
| Session length | > 10 min | Meaningful engagement |
| Return within 7 days | > 50% | Retention signal |
| Documents processed | > 10/user/month | Core value delivery |

---

## Open Questions

1. **Pricing model** - Per stack? Per seat? Usage-based (like AI Co-Founder credits)?
2. **Collaboration** - When to add shared stacks? MVP or later?
3. **Offline support** - PWA with local storage? Or online-only?
4. **API access** - Developer tier with API? When?
5. **White-label** - Enterprise version with custom branding?

---

## Next Steps

1. **Run `/exploration-plan`** - Break Phase 1 into Beads tasks
2. **Build canvas foundation** - `StackCanvas`, `CanvasWindow`, `DocumentWindow`
3. **Replace StackDetailClient** - Swap tab content for canvas
4. **Test with existing data** - Open a stack, see documents as windows
5. **Iterate** - Add TableWindow, agent integration, polish

---

## Appendix: Reference Materials

### HAL-OS Structure
```
HAL-9000/
├── CLAUDE.md              # Kernel
├── tmp.md                 # Scratch buffer
├── system/
│   ├── memory/            # RAM - working state
│   │   ├── context.md
│   │   └── sessions.md
│   └── storage/           # Persistent storage
│       ├── calendar/
│       ├── second-brain/
│       ├── networking/
│       └── vibe/
```

### Space-Agents Workflow
```
/launch → /exploration → /mission → /land
```

### AI Co-Founder Phases
```
Ideation → Research → Solution → Website → Marketing
```

### Current Stackdocs Architecture
```
Frontend (Next.js) ←→ Supabase (direct) + FastAPI (AI only)
                              ↓
                    Claude Agent SDK + Mistral OCR
```

---

*Last updated: 2026-01-25 18:30*
*Session: Brainstorm with HOUSTON*
*Status: Ready for `/exploration-plan`*
