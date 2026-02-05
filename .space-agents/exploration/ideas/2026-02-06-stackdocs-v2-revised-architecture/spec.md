# Exploration: Stackdocs v2 - Revised Architecture (Sprites.dev + Vercel)

**Date:** 2026-02-06
**Status:** Needs discussion (Canvas UI and MVP scope pending next session)

---

## Problem

Stackdocs v1 is a standard multi-tenant SaaS: centralized API on DigitalOcean, shared Supabase database, document extraction via stateless agent calls. While functional, this architecture has critical limitations:

1. **No agent persistence** - Agents lose context between sessions, can't access bash or install tools
2. **WebSocket timeout** - Vercel serverless functions have a 10-second limit, blocking real-time streaming for long agent operations
3. **No collaboration** - Users can't work alongside agents on their documents in real-time
4. **Shared security surface** - Multi-tenant Supabase increases attack surface and compliance complexity
5. **Generic SaaS constraints** - Can't offer true data isolation, persistent workspaces, or installable tools

Customers want more than extraction - they want **collaborative AI agents** that analyze, process, and work through documents with persistent memory, bash access, and true isolation.

---

## Solution

**Sovereign Agent Platform** using three components:

1. **Vercel** (keep) - Next.js frontend, unchanged deployment
2. **Bridge Service** (new, Fly.io Machine) - Lightweight WebSocket proxy between browser and Sprites
3. **User Sprites** (new, Sprites.dev) - Per-user persistent microVMs running Python agent runtime

Every user gets their own **Sprite** (Sprites.dev microVM) that runs:
- Commander agent (orchestrator) + specialist agents (researcher, analyst, coder)
- Local SQLite database (agent memory, extraction results, document metadata)
- 100GB persistent filesystem (documents, OCR cache, artifacts)
- Full bash/Python access (install packages, run scripts)

The frontend opens a WebSocket to the Bridge (`wss://ws.stackdocs.io`), which proxies messages to the user's Sprite. A **Dual-Pane Canvas UI** replaces the current document-centric interface with a chat pane (missions) and canvas pane (real-time agent workspace).

---

## Requirements

### Architecture (Decided)

- [x] Python runtime on Sprites (preserve existing agent code)
- [x] Vercel for frontend (keep SSR, CDN, zero-config deployment)
- [x] Fly.io Bridge Service for WebSocket proxying
- [x] Sprites.dev for per-user persistent microVMs
- [x] Supabase (trimmed) for Gateway platform data
- [x] Raw `ws` library for WebSocket (not Socket.io)
- [x] One repo: `frontend/`, `bridge/`, `sprite/`

### Canvas UI (Next session)

- [ ] Define Canvas UI component architecture (dual-pane layout)
- [ ] Define WebSocket message format (Canvas updates, agent events)
- [ ] Define artifact types (table, markdown, JSON, terminal output)
- [ ] Determine how Canvas state persists across page navigations

### MVP Scope (Next session)

- [ ] Define essential features for 1-month demo
- [ ] Define what "demo to consulting company" actually requires
- [ ] Identify stretch vs essential features

---

## Non-Requirements

### MVP Exclusions

- **Multi-user Sprite sharing** - Each Sprite belongs to one user, no cross-Sprite access
- **Auto-provisioning at scale** - Manual Sprite creation for early users, automate later
- **Billing integration** - Show architecture, don't build Stripe webhooks for MVP
- **Time travel UI** - Sprites.dev checkpoints are available but UI is stretch goal
- **Advanced Canvas visualizations** - Plotly charts are stretch; tables + markdown sufficient for MVP
- **Docker images** - Sprites.dev doesn't use Docker; code deployed via Filesystem/Exec API
- **Node.js on Sprites** - Decided against; Python preserves existing agent codebase

### Architecture Simplifications

- **No FastAPI on Sprites** - Sprites run a persistent Python process, not an HTTP server
- **No Supabase for user data** - Documents, extractions, OCR all on Sprite-local SQLite + filesystem
- **No Supabase Realtime** - Replaced entirely by WebSocket Bridge
- **No SSE streaming** - Replaced by WebSocket messages
- **No DigitalOcean** - Eliminated; agents move to Sprites

---

## Architecture

### Deployment Topology

```
                         HTTPS (pages, SSR, auth)
            ┌──────────────────────────────────────────┐
            │                                          │
  Browser ──┤  www.stackdocs.io (Vercel)               │
            │  Next.js 16, App Router, Clerk           │
            │  Reads Supabase (platform data only)     │
            └──────────────────────────────────────────┘
            │
            │  WebSocket (wss://ws.stackdocs.io)
            ▼
  ┌──────────────────────────────────────────────────────┐
  │  Fly.io Machine: Bridge Service                      │
  │  Node.js (~300 lines)                                │
  │                                                      │
  │  Responsibilities:                                   │
  │  - WebSocket server (browser connections)             │
  │  - Clerk JWT validation                              │
  │  - Route user_id -> sprite_name (via Supabase)       │
  │  - Proxy messages: browser <-> Sprite                │
  │  - Security: inject ANTHROPIC_API_KEY, Mistral key   │
  │  - OCR proxy: forward Mistral API calls for Sprites  │
  └──────────────┬───────────────────────────────────────┘
                 │  Sprites API (WSS exec / TCP proxy)
                 ▼
  ┌──────────────────────────────────────────────────────┐
  │  Sprites.dev (one per user)                          │
  │                                                      │
  │  Runtime: Python 3.11                                │
  │  ├── Commander agent (orchestrator)                  │
  │  ├── Specialist agents (researcher, analyst, coder)  │
  │  ├── Tool factories (scoped closures for security)   │
  │  └── WebSocket/exec client -> Bridge                 │
  │                                                      │
  │  Storage: 100GB persistent filesystem                │
  │  ├── /workspace/documents/   (uploaded files)        │
  │  ├── /workspace/ocr/         (cached OCR text)       │
  │  ├── /workspace/artifacts/   (agent outputs)         │
  │  └── /workspace/agent.db     (SQLite database)       │
  │                                                      │
  │  Features:                                           │
  │  - Auto-sleep after 30s inactivity                   │
  │  - Checkpoint/restore in ~300ms                      │
  │  - Wake on WebSocket connection                      │
  │  - Bash/Python access (pip install, scripts)         │
  └──────────────────────────────────────────────────────┘

  External Services:
  - Clerk (auth only)
  - Stripe (billing, future)
  - Anthropic Claude API (via Bridge proxy)
  - Mistral OCR API (via Bridge proxy)
  - Supabase (platform DB: users + sprite mapping)
```

### Supabase Schema (Trimmed for Gateway)

```sql
-- Only table needed on Supabase (everything else moves to Sprite SQLite)
CREATE TABLE public.users (
    id TEXT PRIMARY KEY,              -- Clerk user ID
    email TEXT NOT NULL,
    sprite_name TEXT,                 -- Sprites.dev sprite name
    sprite_status TEXT DEFAULT 'pending', -- pending | provisioning | active | suspended | deleted
    subscription_tier TEXT DEFAULT 'free',
    usage_this_month INTEGER DEFAULT 0,
    usage_reset_date DATE DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Tables removed from Supabase (moved to Sprite SQLite):
- `documents` -> Sprite SQLite + filesystem
- `ocr_results` -> Sprite filesystem (`/workspace/ocr/`)
- `extractions` -> Sprite SQLite
- `stacks` -> Sprite SQLite
- `stack_documents` -> Sprite SQLite
- `stack_tables` -> Sprite SQLite
- `stack_table_rows` -> Sprite SQLite

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
    ocr_file_path TEXT NOT NULL,       -- /workspace/ocr/{document_id}.txt
    page_count INTEGER NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    model TEXT NOT NULL,
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

-- Stacks, stack_documents, stack_tables, stack_table_rows
-- Same structure as v1, using TEXT for JSON fields instead of JSONB
```

### Bridge-to-Sprite Communication

Two viable patterns (to be decided during implementation):

**Option A: Sprites API Exec**
Bridge uses `WSS /sprites/{name}/exec` to start a Python process and stream stdin/stdout. Simpler, uses Sprites native API.

**Option B: TCP Proxy**
Sprite runs a Python WebSocket server on a port. Bridge uses `WSS /sprites/{name}/proxy/{port}` to connect. More flexible, standard WebSocket protocol between Bridge and Sprite.

### WebSocket Message Format (Draft)

```typescript
// Browser <-> Bridge <-> Sprite messages
interface WebSocketMessage {
  type: 'mission' | 'canvas_update' | 'agent_event' | 'file_upload' | 'error' | 'ping'
  payload: any
  timestamp: number
}

// Canvas update from Sprite
interface CanvasUpdate {
  type: 'canvas_update'
  payload: {
    artifact_type: 'table' | 'markdown' | 'json' | 'terminal'
    data: any
    mission_id: string
  }
}

// Agent event (text, tool use, completion)
interface AgentEvent {
  type: 'agent_event'
  payload: {
    event_type: 'text' | 'tool' | 'complete' | 'error'
    content: string
    meta?: { extractionId?: string; sessionId?: string }
  }
}
```

### Data Flow: Upload + Extract

```
1. Browser: User drops file
2. Browser -> Bridge (WS): { type: 'file_upload', payload: { filename, data } }
3. Bridge -> Sprite (Sprites API): Write file to /workspace/documents/
4. Sprite: Writes to SQLite (documents table, status: 'processing')
5. Sprite -> Bridge -> Browser (WS): { type: 'agent_event', payload: { event_type: 'text', content: 'Processing...' } }
6. Sprite: Calls Mistral OCR via Bridge proxy (Bridge injects API key)
7. Sprite: Caches OCR text to /workspace/ocr/
8. Sprite: Updates SQLite (status: 'ocr_complete')
9. Browser -> Bridge -> Sprite (WS): { type: 'mission', payload: 'Extract vendor data' }
10. Sprite: Commander spawns Analyst agent
11. Analyst: Reads OCR, calls Claude via Bridge proxy (Bridge injects API key)
12. Analyst: Writes extraction to SQLite
13. Sprite -> Bridge -> Browser (WS): { type: 'canvas_update', payload: { artifact_type: 'table', data: {...} } }
14. Canvas: Renders extraction results in real-time
```

### Security Model

**API Key Isolation:**
- Sprites NEVER have API keys (ANTHROPIC_API_KEY, MISTRAL_API_KEY)
- Bridge intercepts all outbound LLM/OCR requests from Sprites
- Bridge injects API keys before forwarding to Anthropic/Mistral
- Sprites.dev network policies can restrict direct outbound access

**Auth Flow:**
- Browser authenticates with Clerk (JWT)
- WebSocket connection sends Clerk JWT to Bridge
- Bridge validates JWT, extracts user_id
- Bridge looks up sprite_name from Supabase
- Bridge proxies to correct Sprite
- Clerk JWT refresh every 50 seconds (existing pattern)

**Data Isolation:**
- Each Sprite has isolated filesystem (Sprites.dev guarantee)
- SQLite is single-user (no RLS needed)
- Documents never leave Sprite except via user's WebSocket
- Sprites.dev provides Firecracker microVM isolation

### Patterns Preserved from v1

| Pattern | v1 Location | v2 Adaptation |
|---------|-------------|---------------|
| Tool factory (scoped closures) | `backend/app/agents/*/tools/` | Same, but `db` param is SQLite not Supabase |
| MCP server + allowed_tools | `extraction_agent/agent.py` | Identical Claude Agent SDK usage |
| Agent SDK session resume | `ClaudeAgentOptions(resume=session_id)` | Identical |
| AgentEvent interface | `frontend/lib/agent-api.ts` | Preserved, transport changes to WebSocket |
| humanizeToolName() | `frontend/lib/agent-api.ts` | Preserved |
| Zustand agent store | `frontend/components/agent/stores/` | Extended with Canvas state |
| Resizable panels | `frontend/components/preview-panel/` | Adapted for Canvas layout |
| TanStack Table | `frontend/components/documents/` | Reused for extraction tables in Canvas |
| Clerk auth | `frontend/proxy.ts`, `backend/app/auth.py` | Preserved, Gateway validates JWT |
| Upload flow system | `frontend/components/agent/flows/` | Adapted for WebSocket file upload |

### Patterns Removed from v1

| Pattern | Reason |
|---------|--------|
| Supabase Realtime hooks | Replaced by WebSocket |
| SSE streaming (EventSourceResponse) | Replaced by WebSocket |
| FastAPI routes | No HTTP API; agents communicate via WebSocket |
| Supabase Client in tool factories | Replaced by SQLite |
| BackgroundTasks (FastAPI) | Replaced by asyncio task management |
| Service role key bypass | No RLS needed on single-tenant SQLite |
| PostgreSQL RPC functions | Logic moves to Python application code |

---

## Constraints

### Technical Constraints

- **Sprites.dev API** - Must use Sprites API for provisioning, exec, filesystem, checkpoints. No Docker images.
- **Clerk JWT expiry** - 60-second token lifetime. Bridge must handle refresh for persistent WebSocket connections (50-second interval).
- **Python Agent SDK** - Claude Agent SDK is Python (`claude-agent-sdk>=0.1.17`). Must stay Python on Sprites.
- **SQLite limitations** - No TEXT[] arrays (use JSON), no stored procedures (move to app code), no GIN indexes (use regular indexes on JSON).
- **Sprites.dev auto-sleep** - 30-second inactivity timeout. Agent must handle reconnection after wake.
- **Sprites.dev regions** - Check available regions for Australian users (latency matters for real-time Canvas).

### Patterns to Preserve

- Tool factory pattern (scoped closures for security)
- MCP server registration with allowed_tools whitelist
- Agent SDK session resume capability
- AgentEvent interface (transport-agnostic)
- Zustand state management with persistence
- shadcn/ui component library (new-york style, Tabler icons)

### Cost Constraints

- Sprites.dev billing: CPU/memory when active, storage for diff from base
- Auto-sleep minimizes idle costs
- Target pricing: $100-500/month per customer
- Must be profitable at this price point

---

## Success Criteria

### Architecture Validation

- [ ] Bridge service proxies WebSocket messages between browser and Sprite
- [ ] Sprite runs Python agent runtime with Claude Agent SDK
- [ ] Tool factories work with SQLite instead of Supabase
- [ ] API key proxy works (Sprite never has keys)
- [ ] Clerk JWT validation works on Bridge
- [ ] File upload streams through Bridge to Sprite filesystem
- [ ] OCR requests go through Bridge proxy to Mistral
- [ ] Claude API requests go through Bridge proxy to Anthropic
- [ ] Sprite auto-sleeps and wakes on WebSocket connection
- [ ] Checkpoint/restore works for Sprite state

### Canvas UI (To be defined next session)

- [ ] TBD

### MVP Demo (To be defined next session)

- [ ] TBD

---

## Open Questions

### To Resolve Next Session

1. **Canvas UI architecture** - How does the dual-pane layout work? What components render which artifact types? How does Canvas state persist across navigation?
2. **MVP scope** - What features are essential for the consulting company demo? What can be cut?
3. **Bridge-to-Sprite communication** - Option A (Sprites API Exec) vs Option B (TCP Proxy)? Need to test both.

### To Resolve During Implementation

4. **Sprites.dev regions** - Where are Sprites deployed? What's the latency from Australia?
5. **Code deployment pattern** - How to update Python code on all Sprites? Golden checkpoint vs filesystem writes?
6. **File upload over WebSocket** - Binary frames or base64 encoding? Size limits?
7. **Clerk token refresh over WebSocket** - How does the browser send refreshed tokens to an existing connection?
8. **Sprite provisioning flow** - When user signs up, how is their Sprite created? Webhook? On-demand?

---

## Next Steps

1. **Next session**: `/brainstorm` Canvas UI design and MVP scope refinement
2. **After Canvas decisions**: `/plan` to create implementation tasks from this spec
3. **Phase 1**: Bridge Service scaffold + Sprites.dev integration
4. **Phase 2**: Sprite runtime (adapt existing agents for SQLite + WebSocket)
5. **Phase 3**: Canvas UI foundation (dual-pane, WebSocket hooks)
6. **Phase 4**: Document upload + extraction flow (end-to-end)
7. **Phase 5**: Multi-agent crews + bash demonstration

### Dependencies to Resolve First

- [ ] Fly.io account setup (for Bridge Machine)
- [ ] Sprites.dev account/API token
- [ ] Test Sprite creation and exec API
- [ ] Verify Sprites.dev region availability for Australia
- [ ] Test WebSocket latency: Browser -> Bridge -> Sprite

---

## Research Summary

### Codebase Analysis (4 parallel research agents, this session)

**Frontend (Next.js 16):**
- App Router with `@header` parallel routes, `proxy.ts` for Clerk middleware
- Agent flow system: registry pattern with `FlowMetadata`, `FlowHookResult`, per-flow hooks
- Zustand stores: `agent-store.ts` with persist middleware, flow discriminated unions
- Supabase Realtime: 2 hooks (`useDocumentRealtime`, `useExtractionRealtime`) with 50s token refresh
- SSE consumption: Custom `ReadableStream` parser in `agent-api.ts` (NOT native EventSource)
- Key components: `AgentCard`, `ExtractedDataTable`, `PreviewPanel`, `SelectedDocumentContext`
- shadcn/ui: new-york style, Tabler icons, Radix primitives, motion/react animations

**Backend (FastAPI/Python):**
- 3 agents: `extraction_agent`, `document_processor_agent`, `stack_agent` (stub)
- Claude Agent SDK: `ClaudeSDKClient`, `create_sdk_mcp_server`, `ClaudeAgentOptions`
- Tool factory pattern: scoped closures capturing `extraction_id`, `document_id`, `user_id`, `db`
- Tools: `read_ocr`, `read_extraction`, `save_extraction`, `set_field`, `delete_field`, `complete`, `save_metadata`
- SSE: `StreamingResponse` with `text/event-stream`, events as JSON
- Session resume: `ClaudeAgentOptions(resume=session_id)` with `max_turns=3`
- Dockerfile: python:3.11-slim multi-stage, uvicorn, healthcheck

**Database (Supabase PostgreSQL):**
- 8 tables, all with RLS using Clerk JWT (`auth.jwt()->>'sub'`)
- 10 migrations (001-010), Clerk integration in 009
- 2 RPC functions: `update_extraction_field`, `remove_extraction_field` (JSONB operations)
- Storage: `documents` bucket, folder-based RLS, signed URLs (1hr expiry)
- PostgreSQL-specific: `jsonb_set()`, `#-`, `TEXT[]`, `GIN` indexes, `SECURITY DEFINER`

**Integrations:**
- Clerk: `proxy.ts` (Next.js 16), `clerk-backend-api` (FastAPI), webhook sync to Supabase
- Mistral OCR: `mistralai==1.10.0`, sync SDK wrapped with `asyncio.to_thread()`
- Anthropic: `anthropic==0.75.0`, `claude-agent-sdk>=0.1.17`
- Three communication channels in v1: Supabase Realtime, SSE, HTTP REST -> all unified to WebSocket in v2
