# Exploration: Stackdocs v2 - Sovereign Agent Platform

**Date:** 2026-02-06 (finalized Session 117)
**Status:** Ready for planning

---

## Problem

Stackdocs v1 is a standard multi-tenant SaaS: centralized API on DigitalOcean, shared Supabase database, document extraction via stateless agent calls. While functional, this architecture has critical limitations:

1. **No agent persistence** - Agents lose context between sessions, can't access bash or install tools
2. **WebSocket timeout** - Vercel serverless functions have a 10-second limit, blocking real-time streaming
3. **No collaboration** - Users can't work alongside agents on their documents in real-time
4. **Shared security surface** - Multi-tenant Supabase increases attack surface and compliance complexity
5. **Generic SaaS constraints** - Can't offer true data isolation, persistent workspaces, or installable tools
6. **No memory** - Agents don't learn user patterns, document conventions, or extraction preferences

The mental model shift: Stackdocs v2 is **not a SaaS** — it's a **personal AI computer** for document intelligence. Each workspace (stack) is an isolated machine the user owns, with an AI agent that learns, remembers, and works autonomously.

---

## Solution

### The Core Idea

**The agent IS the operating system.** Each stack is a persistent VM running a Claude Code-equivalent agent with full compute power. The user doesn't navigate UI or click through workflows — they talk to the agent, and the agent pulls up the right information, organizes data, calls APIs, installs packages, and renders results to a visual Canvas. It's what Claude Code is for developers, but for everyone.

**This is not a SaaS. It's a personal AI computer.**

The agent runs on its own VM (Sprite). It's not stateless. It's not shared. It has:
- **Persistent memory** that survives across sessions (soul.md, daily journals, learned patterns)
- **Full bash/compute** — can install packages, run scripts, call any API, process any file format
- **Self-improvement** — learns extraction patterns, updates its own configuration, gets better over time
- **Two output surfaces** — text chat (conversational) AND Canvas (visual windows: tables, documents, notes)
- **A two-way gateway** — receives triggers from the user, webhooks, cron jobs, heartbeat AND can reach out to external APIs, send notifications, export data

### Architecture

Three infrastructure components:

1. **Vercel** (keep) — Next.js frontend with Canvas UI, Clerk auth
2. **Fly.io Bridge** (new) — Lightweight WebSocket proxy + gateway between browser and Sprites
3. **Sprites.dev** (new) — Per-stack persistent microVMs running Python agent runtime

Every stack gets its own **Sprite** (VM) that runs:
- **Full Claude Agent SDK** — the same capabilities as Claude Code: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, subagents, MCP servers, hooks. The agent can run terminal commands, install packages, write scripts, search the web, and spawn sub-agents.
- **Custom tools** for document extraction (OCR, save_extraction), Canvas (create/update windows), and memory (read/write memory files)
- **OpenClaw-inspired memory system** (soul.md, user.md, daily journals, heartbeat, pre-compaction flush)
- Local SQLite database (documents, extractions, memory index)
- 100GB persistent filesystem (documents, OCR cache, artifacts, installed packages)

### How Users Interact

The user talks to the agent. The agent controls both the **chat** (text responses) and the **Canvas** (visual WIMP interface — windows, icons, menus, pointer). The user asks questions, the agent pulls up the relevant information:

- "Show me last month's invoices" → Agent queries SQLite, opens table window on Canvas
- "Extract data from these" → Agent reads documents, populates extraction table live
- "That vendor is wrong" → Agent corrects, updates table, remembers for next time
- "Export to Xero" → Agent calls Xero API, pushes structured data

The agent decides what to show and how to show it. The Canvas is the agent's screen.

### The Gateway (Two-Way I/O)

The gateway isn't just "user types, agent responds." It's a two-way I/O bus:

**Inbound (triggers the agent):**
- User chat messages (MVP)
- File uploads / drag-and-drop (MVP)
- Canvas interactions — editing cells, clicking (MVP)
- Heartbeat — agent wakes itself periodically (MVP infrastructure, post-MVP actions)
- Webhooks — email arrives, payment received, file shared (post-MVP)
- Cron jobs — scheduled reports, daily summaries (post-MVP)

**Outbound (agent acts on the world):**
- Canvas updates — create/update windows with results (MVP)
- Text responses — conversational chat (MVP)
- File exports — CSV, JSON, PDF generation (MVP)
- External API calls — Xero, Google Sheets, email (post-MVP)
- Notifications — proactive alerts to the user (post-MVP)

**Because the agent runs on a VM with full bash/SDK access, it can do anything a developer can do.** Need the Xero SDK? `pip install xrb`. Need to parse a weird CSV? Install pandas. Need to call a REST API? Write a Python script and run it. The VM persists — installed packages, API credentials, scripts all survive across sessions.

---

## Requirements

### Architecture (Decided)

- [x] Python runtime on Sprites (preserve existing agent code)
- [x] Vercel for frontend (keep SSR, CDN, zero-config deployment)
- [x] Fly.io Bridge Service for WebSocket proxying
- [x] Sprites.dev for per-stack persistent microVMs
- [x] One Sprite per stack (not per user)
- [x] Supabase (trimmed) for platform data (users + stacks + sprite mapping)
- [x] Raw `ws` library for WebSocket (not Socket.io)
- [x] One repo: `frontend/`, `bridge/`, `sprite/`
- [x] Bridge-to-Sprite via TCP Proxy + Services API (Option B)
- [x] API keys injected as env vars at Service start on Sprite
- [x] JWT validated on WebSocket connect only (trust connection, Clerk webhook for revocation)
- [x] Full Claude Agent SDK on Sprite (Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, subagents, MCP, hooks)
- [x] Platform API keys for MVP (BYOK option post-MVP)
- [x] Lazy Sprite provisioning (created on first stack open, not at signup)
- [x] Single Bridge Machine for MVP (horizontally scalable — connection state only, no persistent state)
- [x] Mandatory UUIDs on all WebSocket messages (responses include `request_id`)
- [x] Build v2 Canvas into existing frontend repo as spike (reuse shadcn, Clerk, chat bar)

### Canvas UI (Decided)

- [x] React Flow (@xyflow/react) for infinite canvas with pan/zoom/grid
- [x] Window types: Document, Table, Notes (MVP)
- [x] Agent creates/updates/closes windows via WebSocket canvas_update messages
- [x] Two-way Canvas awareness — agent receives Canvas state at session start + user interactions (close, edit, resize)
- [x] Subbar as window manager (tabs for each window)
- [x] Zustand + localStorage for Canvas state persistence
- [x] Nested message format: `{ type: 'canvas_update', payload: { command, ... } }`

### Memory System (Decided — Full OpenClaw-inspired adoption)

- [x] soul.md — Stack identity/config, extraction rules, agent-maintained
- [x] user.md — User preferences, learned patterns
- [x] MEMORY.md — Persistent global memory, curated summaries
- [x] memory/YYYY-MM-DD.md — Daily journals, append-only
- [x] JSONL audit transcripts — Immutable record of all tool calls
- [x] Pre-compaction memory flush — Post-MVP (requires raw Anthropic SDK `pause_after_compaction`; claude-agent-sdk doesn't expose compaction controls)
- [x] Heartbeat system — Periodic proactive agent wake-ups
- [x] Hybrid BM25 + vector search via SQLite FTS5

### MVP Demo (Decided)

- [ ] Login -> Sprite wakes, Canvas loads (persistence demo)
- [ ] Upload 3 invoices -> documents stream to Canvas as windows
- [ ] "Extract all vendor data" -> table window populates live (real-time demo)
- [ ] Correct a field through chat -> table updates in real-time
- [ ] Close browser, reopen -> everything persists (Sprite memory demo)
- [ ] Export as CSV -> download structured data

### Post-MVP Stretch Goals

**Compute Power:**
- [ ] Multi-document cross-analysis ("compare totals across all invoices")
- [ ] Bash power demo ("install pandas and generate a spending report")
- [ ] Checkpoint time travel ("show me state before that correction")

**Gateway Integrations (Inbound Triggers):**
- [ ] Email webhook — email arrives, agent processes attachment automatically
- [ ] Payment webhook — Stripe/payment received, agent files and categorizes
- [ ] File sync webhook — Dropbox/Google Drive file shared, agent ingests
- [ ] Cron scheduling — daily/weekly reports, month-end summaries
- [ ] Heartbeat proactive actions — agent reviews workspace, suggests actions

**Gateway Integrations (Outbound Actions):**
- [ ] Xero/accounting API export — agent pushes extracted data to accounting software
- [ ] Google Sheets export — agent writes to shared spreadsheets
- [ ] Email sending — agent sends reports, notifications, summaries
- [ ] Slack/Teams notifications — agent posts updates to channels

**Ecosystem:**
- [ ] Tool store / package marketplace (installable capabilities)
- [ ] Custom MCP server connections (user adds their own data sources)
- [ ] Stack templates (pre-configured stacks for common workflows)

---

## Non-Requirements

### MVP Exclusions

- **Cross-stack document sharing** — Stacks are fully isolated for MVP
- **Multi-user Sprite sharing** — Each Sprite belongs to one stack/user
- **Auto-provisioning at scale** — Manual Sprite creation for early users, automate later
- **Billing integration** — Show architecture, don't build Stripe webhooks for MVP
- **Time travel UI** — Checkpoint API available, UI is stretch goal
- **Advanced Canvas visualizations** — Plotly charts are stretch; tables + markdown sufficient
- **Full lane queue** — Simple async lock for MVP gateway, not OpenClaw-style lane queues
- **Heartbeat proactive actions** — Heartbeat infrastructure built, proactive features are post-MVP

### Architecture Simplifications

- **No Docker images** — Sprites.dev doesn't use Docker; code deployed via git pull
- **No FastAPI on Sprites** — Sprites run a persistent Python WebSocket server, not HTTP
- **No Supabase for user data** — Documents, extractions, OCR all on Sprite-local SQLite + filesystem
- **No Supabase Realtime** — Replaced entirely by WebSocket Bridge
- **No SSE streaming** — Replaced by WebSocket messages
- **No DigitalOcean** — Eliminated; agents move to Sprites

---

## Architecture

### Deployment Topology

```
                         HTTPS (pages, SSR, auth)
            +----------------------------------------------+
            |                                              |
  Browser --|  www.stackdocs.io (Vercel)                   |
            |  Next.js 16, App Router, Clerk               |
            |  Canvas UI (React Flow)                      |
            |  Reads Supabase (platform data only)         |
            +----------------------------------------------+
            |
            |  WebSocket (wss://ws.stackdocs.io)
            |  JWT validated on connect, trust connection
            v
  +--------------------------------------------------------+
  |  Fly.io Machine: Bridge Service                        |
  |  Node.js (~300 lines)                                  |
  |                                                        |
  |  Responsibilities:                                     |
  |  - WebSocket server (browser connections)              |
  |  - Clerk JWT validation (on connect only)              |
  |  - Route user_id -> stack -> sprite_name (via Supabase)|
  |  - Proxy messages: browser <-> Sprite                  |
  |  - Inject API keys as env vars at Service start        |
  |  - Handle Sprite sleep/wake reconnection               |
  |  - Keepalive pings to prevent 30s Sprite sleep         |
  |  - Clerk webhook receiver for session revocation       |
  |  - Sprite provisioning (create from golden checkpoint) |
  +------------------------+-------------------------------+
                           |  TCP Proxy API (WSS)
                           |  via /v1/sprites/{name}/proxy
                           v
  +--------------------------------------------------------+
  |  Sprites.dev (one per stack)                           |
  |                                                        |
  |  Service: Python WebSocket server (auto-restarts)      |
  |  +-- SpriteGateway (message router)                    |
  |  |   +-- mission handler (async lock)                  |
  |  |   +-- file_upload handler                           |
  |  |   +-- canvas_update handler                         |
  |  |   +-- heartbeat handler (async lock)                |
  |  |   +-- correction handler                            |
  |  |   +-- system command handler                        |
  |  |                                                     |
  |  +-- Agent Runtime (Claude Agent SDK — full access)     |
  |  |   +-- Built-in: Read, Write, Edit, Bash, Glob, Grep |
  |  |   +-- Built-in: WebSearch, WebFetch                 |
  |  |   +-- Built-in: Subagents, MCP servers, Hooks       |
  |  |   +-- Custom: Canvas tools (create/update window)   |
  |  |   +-- Custom: Extraction tools (read_ocr, save)     |
  |  |   +-- Custom: Memory tools (read/write memory)      |
  |  |   +-- Both Claude PDF + Mistral OCR available       |
  |  |                                                     |
  |  +-- Memory System (OpenClaw-inspired)                 |
  |  |   +-- soul.md (stack config, agent-maintained)      |
  |  |   +-- user.md (user preferences)                    |
  |  |   +-- MEMORY.md (persistent global memory)          |
  |  |   +-- memory/YYYY-MM-DD.md (daily journals)         |
  |  |   +-- MemoryIndex (SQLite FTS5, hybrid search)      |
  |  |                                                     |
  |  +-- Storage: 100GB persistent filesystem              |
  |      +-- /workspace/documents/  (uploaded files)       |
  |      +-- /workspace/ocr/        (cached OCR text)      |
  |      +-- /workspace/artifacts/  (agent outputs)        |
  |      +-- /workspace/memory/     (memory files)         |
  |      +-- /workspace/agent.db    (SQLite database)      |
  |      +-- /workspace/transcripts/(JSONL audit logs)     |
  |                                                        |
  |  Behavior:                                             |
  |  - Auto-sleep after 30s inactivity (Bridge sends pings)|
  |  - Processes killed on sleep (filesystem preserved)    |
  |  - Service auto-restarts on wake                       |
  |  - TCP connections die on sleep (Bridge reconnects)    |
  |  - Checkpoint creation ~300ms, wake 1-12s from cold    |
  |  - Full bash/Python access (pip install, scripts)      |
  +--------------------------------------------------------+

  External Services:
  - Clerk (auth only, JWT on WS connect)
  - Stripe (billing, future)
  - Anthropic Claude API (key as env var on Sprite)
  - Mistral OCR API (key as env var on Sprite, optional tool)
  - Supabase (platform DB: users + stacks + sprite mapping)
```

### Supabase Schema (Platform Gateway Only)

```sql
CREATE TABLE public.users (
    id TEXT PRIMARY KEY,                -- Clerk user ID
    email TEXT NOT NULL,
    subscription_tier TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.stacks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    sprite_name TEXT,                   -- Sprites.dev sprite name
    sprite_status TEXT DEFAULT 'pending',  -- pending | provisioning | active | suspended
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Sprite provisioning lifecycle:** Stack record created at signup (`sprite_status: 'pending'`, `sprite_name: NULL`). On first stack open, Bridge provisions Sprite from golden checkpoint → `provisioning` → `active`. Lazy provisioning avoids paying for unused VMs.

Everything else (documents, extractions, OCR, stacks data) lives on the Sprite's SQLite.

### Sprite SQLite Schema (On-Sprite)

```sql
-- Documents (metadata only, files on filesystem)
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,           -- /workspace/documents/{id}_{filename}
    file_size_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    status TEXT DEFAULT 'processing',  -- processing | ocr_complete | completed | failed
    display_name TEXT,
    tags TEXT,                         -- JSON array (no TEXT[] in SQLite)
    summary TEXT,
    session_id TEXT,                   -- Agent SDK session for corrections
    uploaded_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- OCR Results (text cached on filesystem, metadata here)
CREATE TABLE ocr_results (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL UNIQUE REFERENCES documents(id),
    ocr_file_path TEXT NOT NULL,       -- /workspace/ocr/{document_id}.md
    page_count INTEGER NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    model TEXT NOT NULL,               -- 'mistral-ocr-latest' or 'claude-native'
    created_at TEXT DEFAULT (datetime('now'))
);

-- Extractions
CREATE TABLE extractions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    extracted_fields TEXT NOT NULL,     -- JSON (replaces JSONB)
    confidence_scores TEXT,            -- JSON
    mode TEXT NOT NULL,
    custom_fields TEXT,                -- JSON array
    status TEXT DEFAULT 'completed' CHECK(status IN ('pending','in_progress','completed','failed')),
    session_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Memory Index (hybrid BM25 + vector search)
CREATE VIRTUAL TABLE memory_fts USING fts5(
    chunk_id,
    content,
    source_file,
    agent_id
);

-- Stacks, stack_documents, stack_tables, stack_table_rows
-- Same structure as v1, using TEXT for JSON fields instead of JSONB
```

### WebSocket Message Protocol

```typescript
// All messages between Browser <-> Bridge <-> Sprite
interface WebSocketMessage {
  type: string
  payload: any
  timestamp: number
  id: string          // Mandatory UUID on every message
  request_id?: string // References the request this is responding to
}

// === Browser -> Sprite ===

// User sends a mission (chat message)
interface MissionMessage {
  type: 'mission'
  payload: {
    text: string
    attachments?: string[]  // document IDs to reference
  }
}

// File upload
interface FileUploadMessage {
  type: 'file_upload'
  payload: {
    filename: string
    mime_type: string
    data: string           // Base64 encoded, max 25MB
  }
}

// Canvas interaction (user edited a cell, moved a window)
interface CanvasInteraction {
  type: 'canvas_interaction'
  payload: {
    window_id: string
    action: 'edit_cell' | 'resize' | 'move' | 'close'
    data: any
  }
}

// Auth (connect only)
interface AuthConnect {
  type: 'auth'
  payload: { token: string }  // Clerk JWT, validated once
}

// === Sprite -> Browser ===

// Agent thinking/streaming text
interface AgentEvent {
  type: 'agent_event'
  payload: {
    event_type: 'text' | 'tool' | 'complete' | 'error'
    content: string
    meta?: { extractionId?: string; sessionId?: string }
  }
}

// Canvas commands (nested under canvas_update)
interface CanvasUpdate {
  type: 'canvas_update'
  payload: {
    command: 'create_window' | 'update_window' | 'close_window'
    window_id: string
    window_type?: 'table' | 'document' | 'notes'
    title?: string
    data?: any  // columns/rows for table, content for notes, doc_id for document
    mission_id?: string
  }
}

// Document status updates
interface StatusUpdate {
  type: 'status'
  payload: {
    document_id: string
    status: 'processing' | 'ocr_complete' | 'completed' | 'failed'
    message?: string
  }
}

// System messages
interface SystemMessage {
  type: 'system'
  payload: {
    event: 'connected' | 'sprite_waking' | 'sprite_ready' | 'error'
    message?: string
  }
}
```

### Sprite Gateway Router

```python
import asyncio
from typing import Any

class SpriteGateway:
    """Routes incoming WebSocket messages to appropriate handlers.

    Simple async lock for missions/heartbeat (serial execution).
    File uploads and canvas interactions don't need the lock.
    """

    def __init__(self, agent_runtime, memory_system, db):
        self.mission_lock = asyncio.Lock()
        self.agent = agent_runtime
        self.memory = memory_system
        self.db = db

    async def route(self, message: dict) -> None:
        match message['type']:
            case 'mission':
                async with self.mission_lock:
                    await self.handle_mission(message)
            case 'file_upload':
                await self.handle_upload(message)
            case 'canvas_interaction':
                await self.handle_canvas(message)
            case 'heartbeat':
                async with self.mission_lock:
                    await self.handle_heartbeat(message)
            case 'system':
                await self.handle_system(message)
```

### Memory System Architecture

Adapted from OpenClaw for intelligent document processing:

```
/workspace/memory/
  +-- soul.md                    Stack identity & extraction config
  |                              "This is an invoice processing workspace.
  |                               Extract: vendor, date, line items, total.
  |                               Bunnings invoices have ABN in footer."
  |
  +-- user.md                    User preferences
  |                              "Prefers AU date format (DD/MM/YYYY).
  |                               Always wants vendor names uppercase.
  |                               Project codes should be extracted."
  |
  +-- MEMORY.md                  Persistent global memory
  |                              "Processed 47 invoices total.
  |                               XYZ Corp always uses PO numbers.
  |                               User corrected vendor on 3 docs last week."
  |
  +-- 2026-02-06.md              Today's daily journal
  |                              "Processed 5 invoices. Corrected vendor on
  |                               inv_003. New field 'project_code' added."
  |
  +-- 2026-02-05.md              Yesterday's journal (also loaded)

/workspace/transcripts/
  +-- 2026-02-06T09-30-00.jsonl  Full audit trail of session
```

**Memory loading order at session start:**
1. Load `soul.md` (stack identity)
2. Load `user.md` (user preferences)
3. Load `MEMORY.md` (global context)
4. Load today's + yesterday's daily journals
5. Inject all into system prompt
6. Hybrid search for relevant episodic memories

**Pre-compaction flush (when context window nears limit):**
1. System injects hidden prompt: "Session nearing compaction. Store durable memories now."
2. Agent writes critical context to daily journal
3. Agent responds NO_REPLY (invisible to user)
4. Older conversation history is compressed
5. One flush per compaction cycle

**soul.md is agent-maintained:** The agent updates soul.md as it learns extraction patterns. User can request changes via chat ("always extract project codes from now on") but the agent owns the file.

### Data Flow: Upload + Extract

```
1. Browser: User drops file onto Canvas
2. Browser -> Bridge (WS): { type: 'file_upload', payload: { filename, data (base64) } }
3. Bridge -> Sprite (TCP Proxy): Forward message
4. Sprite Gateway: Routes as 'file_upload'
5. Sprite: Decode base64, write to /workspace/documents/
6. Sprite: Create document record in SQLite (status: 'processing')
7. Sprite -> Bridge -> Browser: { type: 'status', payload: { status: 'processing' } }
8. Sprite agent decides OCR method:
   a. Claude native: Read PDF directly in extraction prompt
   b. Mistral OCR: Call Mistral API, cache text to /workspace/ocr/
9. Sprite: Update SQLite (status: 'ocr_complete')
10. Sprite -> Bridge -> Browser: { type: 'canvas_update', payload: { command: 'create_window', window_type: 'document' } }
11. Sprite agent: Run extraction (Claude Agent SDK)
12. Sprite: Write extraction to SQLite
13. Sprite -> Bridge -> Browser: { type: 'canvas_update', payload: { command: 'create_window', window_type: 'table', data: {...} } }
14. Sprite: Update daily journal with extraction summary
15. Sprite: Update soul.md if new patterns detected
```

### Canvas UI Architecture

```
frontend/components/canvas/
+-- stack-canvas.tsx          # React Flow wrapper (pan/zoom/grid/snap)
+-- canvas-window.tsx         # Base window component (title bar, resize, close)
+-- windows/
|   +-- document-window.tsx   # PDF/image preview (react-pdf)
|   +-- table-window.tsx      # Data grid (TanStack Table)
|   +-- notes-window.tsx      # Markdown editor
+-- stores/
    +-- canvas-store.ts       # Zustand store for window state + localStorage

frontend/app/(app)/stacks/[id]/
+-- page.tsx                  # StackCanvas replaces StackDetailClient tabs
+-- @subbar/page.tsx          # Window tabs (taskbar) instead of tab navigation

frontend/lib/
+-- websocket.ts              # WebSocket connection manager
+-- canvas-protocol.ts        # Message type definitions
```

**Window management:**
- Agent creates windows via `canvas_update` messages
- User owns position/size (drag, resize)
- Agent owns content (data, title)
- Subbar shows tabs: click to focus, X to close, + to add manually
- Layout persists in localStorage (Supabase later for cross-device)

### Bridge Reconnection Flow

Since Sprite TCP connections die on sleep/wake:

```
1. Bridge detects Sprite connection drop (WS close/error)
2. Bridge sends { type: 'system', payload: { event: 'sprite_waking' } } to browser
3. Bridge calls Sprites API (any endpoint) -> triggers automatic wake
4. Bridge polls Sprite status until 'running'
5. Bridge re-establishes TCP Proxy connection to Sprite's WS server port
6. Bridge sends { type: 'system', payload: { event: 'sprite_ready' } } to browser
7. Bridge replays any buffered messages from browser
```

**Keepalive during active sessions:**
Bridge sends periodic pings to Sprite to prevent 30s auto-sleep. Pings stop when the browser disconnects (allowing the Sprite to sleep).

### Security Model

**API Key Management:**
- Anthropic and Mistral API keys injected as env vars at Service start
- Keys are in Sprite process memory, NOT on filesystem
- Bridge manages key injection during provisioning
- If Sprite is compromised, only that stack's session is affected (per-stack isolation)

**Auth Flow:**
- Browser authenticates with Clerk (JWT)
- WebSocket connection sends Clerk JWT as first message
- Bridge validates JWT once, extracts user_id
- Bridge looks up stack's sprite_name from Supabase
- Connection trusted for lifetime (no periodic refresh)
- Clerk webhook to Bridge for session revocation -> force disconnect

**Data Isolation:**
- Each Sprite has isolated filesystem (Firecracker microVM)
- SQLite is single-user (no RLS needed)
- Documents never leave Sprite except via user's WebSocket
- Stacks fully isolated — no cross-stack data access

### Patterns Preserved from v1

| Pattern | v1 Location | v2 Adaptation |
|---------|-------------|---------------|
| Tool factory (scoped closures) | `backend/app/agents/*/tools/` | Same, `db` param is SQLite not Supabase |
| MCP server + allowed_tools | `extraction_agent/agent.py` | Identical Claude Agent SDK usage |
| Agent SDK session resume | `ClaudeAgentOptions(resume=session_id)` | Identical |
| AgentEvent interface | `frontend/lib/agent-api.ts` | Preserved, transport changes to WebSocket |
| humanizeToolName() | `frontend/lib/agent-api.ts` | Preserved |
| Zustand agent store | `frontend/components/agent/stores/` | Extended with Canvas state |
| Resizable panels | `frontend/components/preview-panel/` | Adapted for Canvas window nodes |
| TanStack Table | `frontend/components/documents/` | Reused for extraction tables in Canvas |
| Clerk auth | `frontend/proxy.ts` | Preserved, Bridge validates JWT |
| Upload flow | `frontend/components/agent/flows/` | Adapted for WebSocket file upload |

### Patterns Removed from v1

| Pattern | Reason |
|---------|--------|
| Supabase Realtime hooks | Replaced by WebSocket |
| SSE streaming (EventSourceResponse) | Replaced by WebSocket |
| FastAPI routes | No HTTP API; agents communicate via WebSocket |
| Supabase Client in tool factories | Replaced by SQLite |
| BackgroundTasks (FastAPI) | Replaced by asyncio in Sprite process |
| Service role key bypass | No RLS needed on single-tenant SQLite |
| PostgreSQL RPC functions | Logic moves to Python application code |
| Direct browser-to-S3 upload | Files flow through WebSocket to Sprite |

---

## Constraints

### Technical Constraints

- **Sprites.dev behavior** — Processes killed on sleep (filesystem only). Services auto-restart on wake. TCP connections die. 1-12s cold wake time. 30s inactivity sleep.
- **Sprites.dev API** — Must use Sprites API for provisioning, exec, filesystem, checkpoints, services. No Docker images.
- **Clerk JWT** — 60-second token lifetime. Validated once on WS connect. Clerk webhook for revocation.
- **Python Agent SDK** — Claude Agent SDK is Python. Must stay Python on Sprites.
- **SQLite limitations** — No TEXT[] arrays (use JSON), no stored procedures, no GIN indexes. Enable WAL mode for concurrent reads. Subagent writes should serialize through main agent or write queue.
- **Base64 file encoding** — 33% overhead on wire for document uploads. 25MB file size limit.
- **Sprites.dev regions** — Verify latency from Australia for real-time Canvas updates.

### Patterns to Preserve

- Tool factory pattern (scoped closures for security)
- MCP server registration with allowed_tools whitelist
- Agent SDK session resume capability
- AgentEvent interface (transport-agnostic)
- Zustand state management with persistence
- shadcn/ui component library (new-york style, Tabler icons)

### Cost Constraints

- Sprites.dev billing: CPU/memory when active, storage for diff from base
- Auto-sleep minimizes idle costs (Bridge sends keepalive only during active sessions)
- Free tier: 1 stack (1 Sprite), Paid: multiple stacks
- Mistral OCR: $0.002/page, Claude PDF: ~$0.004-0.012/page (agent chooses)
- Target customer pricing: $100-500/month per customer

---

## Success Criteria

### Architecture Validation

- [ ] Bridge service proxies WebSocket messages between browser and Sprite
- [ ] Sprite runs Python WS server as a Service (auto-restarts on wake)
- [ ] Bridge connects to Sprite via TCP Proxy API
- [ ] Tool factories work with SQLite instead of Supabase
- [ ] API keys injected as env vars, accessible in Sprite process
- [ ] File upload streams through Bridge to Sprite filesystem (base64 JSON)
- [ ] Sprite can call Mistral OCR directly with injected API key
- [ ] Sprite can call Claude API directly with injected API key
- [ ] Sprite auto-sleeps and wakes on Bridge reconnection
- [ ] Bridge handles sleep/wake reconnection gracefully
- [ ] Keepalive pings prevent sleep during active sessions

### Canvas UI

- [ ] Open a stack -> React Flow canvas renders (not tabs)
- [ ] Document windows display PDF/image preview
- [ ] Table windows display extracted data (TanStack Table)
- [ ] Windows can be dragged, resized, closed
- [ ] Subbar shows tabs for each window
- [ ] Layout persists in localStorage
- [ ] Agent can create/update/close windows via WebSocket messages

### Memory System

- [ ] soul.md loaded at session start, configures extraction behavior
- [ ] user.md preserves user preferences across sessions
- [ ] MEMORY.md persists global context across sessions
- [ ] Daily journal captures session activity
- [ ] Pre-compaction flush saves context before overflow
- [ ] Memory survives Sprite sleep/wake (filesystem persistence)

### MVP Demo Flow

- [ ] Login -> Sprite wakes -> Canvas loads with persisted state
- [ ] Upload invoices -> documents appear as Canvas windows
- [ ] Chat "extract vendor data" -> table populates live
- [ ] Chat correction -> table updates in real-time
- [ ] Close/reopen browser -> everything persists
- [ ] Export CSV from table window

---

## Open Questions

### To Resolve During Implementation

1. **Sprites.dev region latency** — What's the latency from Australia? Does this affect real-time Canvas updates?
2. **Service auto-restart confidence** — Sprites docs don't explicitly confirm auto-restart on wake (MEDIUM confidence). Test during Phase 1.
3. **Golden checkpoint strategy** — How to set up the template Sprite with base Python environment + packages?
4. **Memory vector embeddings** — Which embedding model for the hybrid search? Local (on Sprite) or API call?
5. **Heartbeat scheduling** — How often should the heartbeat fire? What proactive actions for MVP?
6. **Canvas window z-ordering** — How to handle overlapping windows in React Flow?

### Deferred Decisions

7. **Cross-stack document sharing** — Post-MVP. Currently fully isolated.
8. **Full lane queue** — Post-MVP if parallel agent crews are added.
9. **Billing/Stripe integration** — Architecture supports it, build later.
10. **Tool store / package marketplace** — Post-MVP but architecture enables it.

---

## Next Steps

1. **`/plan`** to create implementation tasks from this spec
2. **Phase 1: Bridge + Sprite scaffold** — Fly.io Machine, Sprites API integration, TCP Proxy connection
3. **Phase 2: Sprite runtime** — Adapt existing agents for SQLite + WebSocket, memory system foundation
4. **Phase 3: Canvas UI** — React Flow, window components, WebSocket hooks
5. **Phase 4: Upload + extraction flow** — End-to-end document processing through new pipeline
6. **Phase 5: Memory + polish** — Full memory system, pre-compaction, daily journals, demo prep

### Dependencies to Resolve First

- [ ] Fly.io account setup (for Bridge Machine)
- [ ] Sprites.dev account/API token
- [ ] Test Sprite creation and exec API
- [ ] Verify Sprites.dev region availability for Australia
- [ ] Test WebSocket latency: Browser -> Bridge -> Sprite

---

## Vision: The Agent as Operating System

**READ THIS FIRST.** This is the north star for every architectural and product decision.

Stackdocs v2 is not a document extraction tool with AI. It's a **personal AI computer** for business users. The mental model:

```
TRADITIONAL SOFTWARE          STACKDOCS V2
──────────────────           ──────────────
User navigates UI     →     User talks to agent
User clicks buttons   →     Agent pulls up information
User exports CSV      →     Agent pushes to Xero
User checks email     →     Webhook triggers agent
User runs reports     →     Cron triggers agent
User learns software  →     Software learns user
```

### Why This Works (The VM Advantage)

The agent runs on its own persistent VM. This is the key differentiator over every other AI product:

- **Not stateless** — It remembers. soul.md learns extraction patterns. user.md learns preferences. Daily journals capture everything. The agent gets better over time.
- **Not sandboxed** — It has full bash, pip install, web access, file system. It can install the Xero SDK, write a Python script, call any API. If a developer can do it from a terminal, the agent can do it.
- **Not shared** — Each stack is isolated. Your data, your agent, your packages, your configuration. No multi-tenant concerns.
- **Not ephemeral** — The VM sleeps when idle but wakes in seconds. Everything persists — installed packages, API credentials, SQLite data, memory files, documents.

### The Two Output Surfaces

The agent has TWO ways to communicate with the user:

1. **Chat (text)** — Conversational responses, explanations, questions. "I found 3 invoices from Bunnings. The total is $4,250. Should I add them to the expenses table?"
2. **Canvas (visual)** — Windows the agent creates and controls: data tables, document previews, notes, charts. The agent decides what to show based on what the user needs.

Both are always available. The agent chooses the right mix. A simple answer is text. A data result is a Canvas table. A comparison is both — text explanation + visual table.

### The Two-Way Gateway

The gateway makes the agent reactive AND proactive:

**Reactive:** User asks → agent responds (MVP)
**Proactive:** Heartbeat fires → agent reviews workspace → "You have 3 unprocessed invoices from yesterday" (post-MVP)
**Event-driven:** Webhook fires → agent acts automatically → "New invoice from Xero, extracted and filed" (post-MVP)

This is what makes it an OS, not a chatbot. The agent doesn't just answer questions — it manages the user's document workflow end-to-end.

### Comparison to OpenClaw

OpenClaw proved this model works for developers (100K+ GitHub stars). Stackdocs v2 adapts it for business users:

| OpenClaw | Stackdocs v2 |
|----------|-------------|
| Terminal output | Canvas UI (visual windows) |
| WhatsApp/Telegram/Slack channels | WebSocket + Canvas + webhooks |
| General-purpose assistant | Document intelligence specialist |
| Docker on user's machine | Sprite (managed VM in cloud) |
| Developer audience | SMB / non-technical audience |
| soul.md = personality | soul.md = extraction config + workspace identity |

Same engine. Different interface. Different audience. Same power.

---

## Research Summary

### Session 116 (Previous) — Codebase Analysis

4 parallel research agents analyzed the v1 codebase:

- **Frontend**: Next.js 16, App Router, `@header` parallel routes, `proxy.ts` for Clerk, Zustand agent stores, SSE via ReadableStream, shadcn/ui
- **Backend**: 3 agents (extraction, document_processor, stack stub), Claude Agent SDK, tool factory pattern, SSE streaming
- **Database**: 8 Supabase tables with RLS, 10 migrations, 2 RPC functions, documents storage bucket
- **Integrations**: Clerk auth, Mistral OCR (sync SDK via `asyncio.to_thread`), Anthropic API, Supabase Realtime

### Session 117 (This Session) — Architecture Finalization

**Sprites.dev deep dive** (research agent):
- Processes killed on sleep, not frozen (filesystem-only persistence, no CRIU)
- Services auto-restart on wake (HIGH confidence for filesystem, MEDIUM for services)
- TCP connections die on sleep/wake (Bridge must reconnect)
- Any API call wakes a sleeping Sprite (implicit, no explicit wake endpoint)
- Checkpoint creation ~300ms, cold wake 1-12 seconds
- Services API: `PUT /v1/sprites/{name}/services/{name}` with command, args, needs, http_port
- TCP Proxy API: `WSS /v1/sprites/{name}/proxy` with `ProxyInitMessage`
- Early reliability issues noted in community (Jan/Feb 2026)

**OpenClaw memory architecture** (research agent):
- Layered memory: soul.md, user.md, MEMORY.md, daily journals, JSONL transcripts
- Pre-compaction flush: silent agentic turn saves context before overflow
- Heartbeat: periodic proactive agent wake-ups
- Gateway: 6-stage pipeline (Channel Adapter -> Gateway -> Lane Queue -> Agent Runner -> Agentic Loop -> Response Path)
- Hybrid BM25 + vector search via SQLite FTS5, sliding window chunking
- Project history: ClawdBot -> MoltBot -> OpenClaw (Peter Steinberger, 100K+ GitHub stars)

**Claude PDF capabilities** (research agent):
- Native PDF support via `type: "document"` content block (base64 or URL)
- 100 pages per request, 32MB max, 1,500-3,000 tokens/page + image tokens
- Mistral OCR: $2/1,000 pages vs Claude Haiku: ~$6.50/1,000 pages (2-3x more expensive)
- Mistral better for tables (96.6%) and handwriting (88.9%)
- Decision: Both available as tools, agent decides which to use per document

### Canvas UI (from Session 113, Jan 25-26)

- React Flow (@xyflow/react) confirmed for infinite canvas
- Window types: Document (react-pdf), Table (TanStack Table), Notes (markdown editor)
- Agent tools: create_window, update_window, close_window
- Subbar as window manager (taskbar pattern)
- Component structure in `frontend/components/canvas/`

### Session 118 — Architecture Review

**Compaction / pre-compaction flush** (research agent):
- Anthropic Messages API has server-side compaction beta (`compact-2026-01-12`)
- `pause_after_compaction: true` returns `stop_reason == "compaction"` — this IS the hook for pre-compaction flush
- Token counting API: `client.messages.count_tokens()` for proactive monitoring
- **BUT** `claude-agent-sdk` does NOT expose compaction controls — it manages its own context internally
- For pre-compaction flush, need raw `anthropic` SDK with custom agentic loop
- Decision: Keep `claude-agent-sdk` for MVP, add raw SDK compaction post-MVP

**Architecture review findings** (no changes to core decisions):
- Bridge: single Machine for MVP, horizontally scalable by design (connection state only)
- File uploads: base64 over WS is fine — per-user connection, most files 1-5MB, no cross-user blocking
- Sprite provisioning: lazy (on first stack open, not at signup)
- API keys: platform keys for MVP, BYOK post-MVP
- Message protocol: mandatory UUIDs on all messages, `request_id` for response correlation
- Canvas: two-way awareness — agent receives Canvas state + user interactions
- SQLite: WAL mode for concurrent reads, serialize subagent writes
- Frontend: build v2 into existing repo as spike, reuse shadcn/Clerk/chat bar components

---

*Finalized: 2026-02-06, Session 117*
*Reviewed: 2026-02-06, Session 118*
*Previous version: Session 116 (architecture decisions only, Canvas/MVP/memory pending)*
