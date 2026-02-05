# Exploration: Stackdocs v2 - Sovereign Agent Platform & Canvas UI

**Date:** 2026-02-06
**Status:** Ready for planning

---

## Problem

Stackdocs v1 is a standard multi-tenant SaaS: centralized API, shared database, document extraction via queue-based agents. While functional, this architecture has limitations:

1. **No agent persistence** - Agents can't maintain context between sessions, can't access bash or install tools
2. **Limited collaboration** - Users can't work alongside agents on their documents in real-time
3. **Vercel WebSocket timeout** - Current deployment (Vercel) has 10-second WebSocket limits, blocking real-time features
4. **Shared security surface** - Multi-tenant architecture increases attack surface and compliance complexity
5. **Generic SaaS constraints** - Can't offer true data isolation or persistent agent workspaces

Customers want more than extraction - they want **collaborative AI agents** that can analyze, process, and work through documents with persistent memory, bash access, and true isolation.

---

## Solution

**Pivot to a Sovereign Agent Platform** on Fly.io:

Every user gets their own **private Sprite** (Fly.io microVM) that runs:
- Commander agent (orchestrator)
- Specialist agents (researcher, analyst, coder)
- Local SQLite database (agent memory, extraction results)
- 100GB filesystem (documents, OCR cache, artifacts)
- Full bash/Python access (install packages, run scripts)

**Dual-Pane Canvas UI** replaces chat interface:
- **Left pane**: Chat & commands (user gives missions)
- **Right pane**: Real-time Canvas showing agent work (tables, charts, markdown, visualizations)
- **WebSocket bridge**: Streams Sprite updates to browser instantly

**Key architectural shift**: From shared-nothing multi-tenant to shared-nothing single-tenant per user. True isolation, persistent state, collaborative workspace.

---

## Requirements

### MVP (1-month demo target)

- [ ] Single Sprite deployment (manual `fly launch` for demo)
- [ ] Document extraction working (reuse current `document_processor_agent`)
- [ ] Canvas UI showing extraction results (table/markdown renderer)
- [ ] WebSocket bridge streaming live updates from Sprite
- [ ] Bash access demonstration (agent runs command, shows output)
- [ ] Commander + specialist agent architecture on Sprite
- [ ] Sprite-local storage (documents on Sprite filesystem, not Supabase)

### Infrastructure Migration

- [ ] Move Next.js frontend from Vercel to Fly.io Gateway
- [ ] Remove FastAPI backend (functionality moves to Gateway/Sprites)
- [ ] Remove Supabase PostgreSQL (user data moves to Sprite-local SQLite)
- [ ] Remove Supabase Storage (documents move to Sprite filesystems)
- [ ] Implement WebSocket bridge (Gateway ↔ Sprite over 6PN network)
- [ ] Security proxy for API keys (Gateway injects ANTHROPIC_API_KEY, Mistral key)

### External Services (Retained)

- [ ] Clerk for auth (JWT tokens only, no user data storage)
- [ ] Stripe for billing (subscription management)
- [ ] Anthropic Claude API (via Gateway security proxy)
- [ ] Mistral OCR API (via Gateway security proxy)

### Stretch Goals (if time permits)

- [ ] Time travel / checkpoints (HAL-OS style mission branching)
- [ ] Rich Canvas visualizations (Plotly charts, interactive graphs)
- [ ] Multi-agent crews (parallel specialists)
- [ ] Terminal view component (stream agent stdout)

---

## Non-Requirements

### MVP Exclusions

- **Multi-user support** - Demo will have 1 hardcoded Sprite, no auto-provisioning
- **Billing integration** - Show architecture, don't build Stripe webhooks
- **Auto-provisioning** - Manually deploy Sprites for demo, automate later
- **Document sharing** - Sprites are isolated by design, no cross-Sprite access
- **Time travel** - Cool feature, but not core to demo value
- **Advanced Canvas visualizations** - Table/markdown sufficient for MVP

### Architecture Simplifications

- **No Supabase database** - All user data moves to Sprite-local SQLite
- **No Supabase storage** - Documents stored on Sprite filesystems
- **No FastAPI backend** - OCR proxy moves to Gateway (Node.js)
- **No Vercel hosting** - Everything on Fly.io for WebSocket support

---

## Architecture

### v1 vs v2 Comparison

```
v1 (Current):
┌─────────────────┐
│  Vercel (Front) │  Next.js frontend
└────────┬────────┘
         │
    ┌────┴─────┐ ┌──────────────┐
    │ Supabase │ │ FastAPI      │  Backend (OCR, agents)
    │ (DB+Auth)│ ├──────────────┤
    └──────────┘ │ DigitalOcean │
                 └──────────────┘

v2 (Target):
┌─────────────────────────────────────────────────────────┐
│  Fly.io                                                 │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │  Gateway (Next.js 15)                           │   │
│  │  - Frontend UI + Canvas                         │   │
│  │  - WebSocket bridge                             │   │
│  │  - Clerk auth                                   │   │
│  │  - OCR proxy (Node.js → Mistral)                │   │
│  │  - Security proxy (inject API keys)             │   │
│  └────────────┬────────────────────────────────────┘   │
│               │ (6PN private network)                   │
│  ┌────────────▼────────────────────────────────────┐   │
│  │  User Sprite (Node.js + Agent SDK)              │   │
│  │  - Commander agent (orchestrator)               │   │
│  │  - Specialist agents (researcher, analyst)       │   │
│  │  - Local SQLite DB (100GB)                      │   │
│  │  - Filesystem (docs, OCR, artifacts)            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

External:
- Clerk (auth only)
- Stripe (billing only)
- Anthropic (via Gateway)
- Mistral (via Gateway)
```

### Component Breakdown

#### Gateway (Fly.io Machine)

**Responsibilities:**
- Serve Next.js frontend (Canvas UI)
- WebSocket server (browser → Gateway → Sprite tunneling)
- Auth proxy (Clerk JWT validation)
- API security proxy (inject ANTHROPIC_API_KEY, Mistral key)
- OCR proxy (Node.js wrapper around Mistral API)
- Sprite IP mapping (user_id → sprite_ip from metadata)

**Tech Stack:**
- Next.js 15 (App Router)
- Socket.io (WebSocket server)
- Clerk SDK (auth)
- Node.js fetch (API proxying)

**Data Storage:**
- No user data (metadata only for routing)
- Sprite registry (user_id → sprite_id → IP address)

#### Sprite (Fly.io Sprite)

**Responsibilities:**
- Run Commander agent (receive missions from Gateway)
- Spawn specialist agents (researcher, analyst, coder)
- Maintain local SQLite DB (agent memory, extraction results)
- Store documents on filesystem (100GB persistent)
- Execute bash commands (install packages, run scripts)
- Stream Canvas updates via WebSocket

**Tech Stack:**
- Node.js runtime
- Claude Agent SDK
- SQLite (better-sqlite3)
- Bash/Python access

**Data Storage:**
- Documents: `/workspace/documents/{doc_id}.pdf`
- OCR cache: `/workspace/ocr/{doc_id}.txt`
- Extraction results: `/workspace/agent.db` (SQLite)
- Agent artifacts: `/workspace/artifacts/{mission_id}/`

**Agent Architecture:**
```
Commander Agent
    ├── Researcher Agent (web search, doc analysis)
    ├── Analyst Agent (data extraction, code execution)
    └── Coder Agent (file operations, Python scripts)

Communication:
- SQLite as message bus (write results, read by Commander)
- Filesystem as shared workspace (pass files, data)
- Direct SDK calls (Commander invokes specialists)
```

#### Canvas UI (Dual-Pane)

**Left Pane (Chat & Command):**
- Conversational interface
- User gives high-level missions ("Analyze these 50 contracts")
- Agent provides status updates, asks clarifying questions

**Right Pane (Canvas):**
- Real-time rendering of agent work
- Dynamic artifact types:
  - Tables (TanStack Table, reuse from v1)
  - Markdown (react-markdown)
  - JSON viewers ( collapsible nodes)
  - Charts (stretch: Plotly)
- Live streaming via WebSocket

**WebSocket Events:**
```typescript
interface CanvasUpdate {
  type: 'table' | 'markdown' | 'json' | 'chart'
  data: any
  mission_id: string
}

interface LogStream {
  type: 'stdout' | 'stderr'
  text: string
  timestamp: number
}
```

### Data Flow

#### Upload Flow
```
1. Browser: Upload document via Gateway
2. Gateway: Stream to Sprite filesystem (/workspace/documents/)
3. Sprite: Request OCR via Gateway proxy (signed URL)
4. Gateway: Call Mistral OCR with Sprite's signed URL
5. Gateway: Return OCR text to Sprite
6. Sprite: Cache OCR locally (/workspace/ocr/)
7. Sprite: Update SQLite DB (document.status = 'ocr_complete')
8. Sprite: Emit CanvasUpdate event via WebSocket
9. Gateway: Forward to browser
10. Canvas: Render "OCR complete" status
```

#### Extraction Flow
```
1. Browser: Send mission "Extract vendor info from Invoice.pdf"
2. Gateway: Forward to Sprite Commander via WebSocket
3. Commander: Spawn Analyst agent with mission
4. Analyst: Read OCR from /workspace/ocr/Invoice.pdf
5. Analyst: Extract fields using Claude via Gateway proxy
6. Gateway: Inject ANTHROPIC_API_KEY, forward to Anthropic
7. Gateway: Return Claude response to Sprite
8. Analyst: Write results to SQLite
9. Analyst: Emit CanvasUpdate {type: 'table', data: {vendor: 'Acme', total: 500}}
10. Gateway: Forward to browser
11. Canvas: Render table with extraction results
```

### Security Model

**API Key Isolation:**
- Sprites never have API keys
- Gateway intercepts all LLM/OCR requests
- Gateway injects `ANTHROPIC_API_KEY` and Mistral key
- Sprites only see signed URLs for their own files

**Network Isolation:**
- Sprites on Fly.io private 6PN network (no public IP)
- Gateway bridges public internet → private network
- Sprites cannot directly access external APIs
- All external traffic goes through Gateway proxy

**Data Isolation:**
- Each Sprite has isolated filesystem (100GB)
- SQLite DB is single-user (no RLS needed)
- Documents never leave Sprite (except billing events)
- True multi-tenant isolation at infrastructure level

---

## Constraints

### Timeline Constraints

- **1 month to MVP demo** - Must show working prototype to consulting company
- **AI-assisted development** - Using Claude Code and agents for speed
- **Aggressive scope** - Essential features only, stretch goals if time

### Technical Constraints

- **Fly.io infrastructure only** - No Vercel, no DigitalOcean
- **Clerk auth required** - Must use Clerk JWT tokens
- **Sprite-local SQLite** - No PostgreSQL on Sprites
- **WebSocket-only** - No polling, SSE replaced by WebSocket bridge
- **Node.js runtime** - Sprites run Node.js (not Python)

### Architecture Patterns to Preserve (from v1)

**From Research Agents:**

**Agent Architecture:**
- Tool factory pattern (scoped closures for security)
- MCP server registration with allowed_tools whitelist
- Session resume capability (Agent SDK features)
- SSE streaming pattern (adapt to WebSocket)

**Frontend Patterns:**
- Agent flow system (extend for Canvas)
- Zustand stores with persistence (add Canvas state)
- Supabase Realtime pattern (adapt for Sprite WebSocket)
- Resizable panels (Canvas layout)
- TanStack Table (data grids)

**Database Schema:**
- RLS pattern concept (applied to Sprite isolation)
- Session persistence (VARCHAR(50) for Agent SDK)
- JSONB flexibility (adapt to SQLite JSON)

### Cost Constraints

**Fly.io Pricing (researched):**
- CPU: $0.07 / CPU-hour
- Memory: $0.04375 / GB-hour
- Storage (cold): $0.000027 / GB-hour
- Storage (hot): $0.000683 / GB-hour

**Target Pricing:**
- $100-500/month per customer
- 100GB Sprite storage = $1.97/month (cold) or $49.85/month (hot)
- Must be profitable at this price point

**Cost Optimization:**
- Idle Sprites sleep (Fly.io suspend/resume)
- Wake on user login (Gateway triggers)
- Per-session billing vs always-on

---

## Success Criteria

### MVP Demo (1 month)

- [ ] User can log in via Clerk
- [ ] User uploads document to their Sprite
- [ ] Sprite performs OCR (via Gateway proxy)
- [ ] Commander receives mission "Extract vendor data"
- [ ] Analyst agent extracts fields, displays in Canvas
- [ ] Canvas shows real-time updates via WebSocket
- [ ] User sees bash demonstration (agent runs `ls`, shows files)
- [ ] Consultant understands architecture (Gateway + Sprites + Canvas)

### Architecture Validation

- [ ] WebSocket bridge works (no 10-second timeout)
- [ ] Sprite isolation works (documents stay on Sprite)
- [ ] API key proxy works (Sprite never has keys)
- [ ] Canvas renders multiple artifact types (table, markdown)
- [ ] Commander orchestrates specialists (SQLite + files + SDK)

### Migration Completeness

- [ ] No FastAPI backend running
- [ ] No Supabase database queries
- [ ] No Supabase storage usage
- [ ] All code on Fly.io (Gateway + Sprite)
- [ ] Clerk auth only external dependency (besides LLM/OCR APIs)

---

## Open Questions

### Resolved (Ready for Planning)

1. **Storage location** - ✓ Sprite-local (documents on Sprite filesystem)
2. **Pricing target** - ✓ $100-500/month ( Sprite storage is viable)
3. **Platform** - ✓ Full Fly.io migration (no Vercel)
4. **Backend** - ✓ Remove FastAPI (functionality moves to Gateway/Sprites)
5. **Database** - ✓ Remove Supabase (Sprite-local SQLite)
6. **WebSocket timeout** - ✓ Fly.io solves Vercel's 10s limit

### To Be Determined (Not Blocking)

1. **OCR proxy implementation** - Node.js wrapper around Mistral API (or call Python?)
2. **Gateway routing** - How does Gateway map user_id → sprite_ip? (in-memory DB or etcd?)
3. **Sprite wake/sleep** - Suspend idle Sprites to save costs? (implementation detail)
4. **Canvas renderer library** - Custom implementation or React Flow / D3.js?
5. **Multi-agent communication** - Mix of SQLite + files + SDK (need examples)

### Technical Decisions Needed (During Planning)

1. **Monorepo structure** - Should we use Turborepo, Nx, or simple workspaces?
2. **Sprite Dockerfile** - Base image, system dependencies, Python for Pandas?
3. **WebSocket library** - Socket.io or raw ws?
4. **OCR proxy** - Can Node.js call Mistral API directly or need Python bridge?
5. **SQLite schema** - What tables for agents, missions, checkpoints?

---

## Next Steps

1. **Create implementation plan** - Use `/plan` to break down into phases/tasks
2. **Phase 1**: Monorepo setup + Gateway scaffold
3. **Phase 2**: Sprite runtime + Commander agent
4. **Phase 3**: WebSocket bridge + Canvas UI foundation
5. **Phase 4**: OCR proxy + document extraction flow
6. **Phase 5**: Multi-agent crews + bash demonstration
7. **Phase 6**: Stretch goals (time travel, charts, terminal)

### Dependencies to Resolve First

- **Fly.io account setup** - Ensure access to Fly.io for deployment
- **Clerk app configuration** - JWT token validation for Gateway
- **Anthropic API key** - For Gateway security proxy
- **Mistral API key** - For Gateway OCR proxy

### Parallel Work Opportunities

- Gateway frontend can be built while Sprite runtime is developed
- Canvas UI components can be built in parallel with WebSocket bridge
- Agent prompts/tools can be developed independently from infrastructure

---

## Research Summary

### Codebase Analysis (4 research agents)

**Extraction Agent Architecture:**
- ✓ Already uses Claude Agent SDK with MCP server pattern
- ✓ Tool factory pattern for security (scoped closures)
- ✓ SSE streaming (can adapt to WebSocket)
- ✓ ~1,009 lines, clean codebase

**Database & Storage:**
- ✓ Clerk JWT auth with RLS pattern (concept applies to Sprite isolation)
- ✓ Session persistence (VARCHAR(50) for Agent SDK)
- ✓ `stacks` table can become `sprites` (add agent_config JSONB)
- ✓ Tables to remove: documents, ocr_results, extractions (move to Sprite-local)

**Frontend Patterns:**
- ✓ Agent flow system (extend for Canvas)
- ✓ Zustand stores with persistence
- ✓ Supabase Realtime subscriptions (adapt for Sprite WebSocket)
- ✓ Resizable panels, TanStack Table

**OCR & Document Processing:**
- ✓ Mistral OCR integration with async wrapper
- ✓ OCR caching in Supabase (move to Sprite-local)
- ✓ Signed URL generation (reuse for Gateway proxy)
- ✓ Tool factory pattern (preserve for Sprite security)

**WebSocket Timeout Issue:**
- ✓ Current architecture has 10-second timeout (Vercel or Supabase Realtime)
- ✓ No timeout in Stackdocs code (external limitation)
- ✓ Fly.io solves this (persistent WebSocket connections)

### Key Architectural Decisions Made

1. **Full Fly.io migration** - No Vercel, no DigitalOcean, single platform
2. **Remove all Supabase** - No database, no storage, auth via Clerk only
3. **Remove FastAPI backend** - Gateway (Node.js) + Sprites (Node.js) only
4. **Sprite-local storage** - Documents, OCR, SQLite all on Sprite filesystem
5. **Sovereign agents** - True isolation, persistent state, bash access
6. **Canvas UI** - Dual-pane collaborative workspace, not chatbot

### Preserved Patterns from v1

- Tool factory pattern (scoped security)
- MCP server registration
- Agent SDK session resume
- Zustand state management
- Resizable panel layout
- TanStack Table component
- Agent flow registry system

### New Components to Build

- Gateway WebSocket server (Socket.io or ws)
- WebSocket bridge (Gateway ↔ Sprite tunneling)
- Security proxy (inject API keys)
- Canvas renderer (tables, markdown, charts)
- Sprite runtime (Dockerfile + Agent SDK bootstrap)
- Commander + specialist agents
- Sprite-local SQLite schema
- OCR proxy (Node.js wrapper)
- Sprite provisioning (manual for MVP)

---

## Appendix: Cost Model

### Fly.io Sprite Cost Breakdown

**Storage (per month):**
- 10GB cold: $0.20
- 10GB hot: $6.66
- 100GB cold: $1.97
- 100GB hot: $49.85
- 1TB cold: $19.71
- 1TB hot: $498.54

**Compute (per month, assuming 30 hours usage):**
- 1 CPU + 2GB RAM: ~$10-20/month
- 2 CPU + 4GB RAM: ~$20-40/month

**Target Pricing:**
- Starter (10GB, light usage): $50-100/month
- Standard (100GB, moderate usage): $100-200/month
- Pro (1TB, heavy usage): $300-500/month

**Cost Optimization:**
- Suspend idle Sprites (no compute when not in use)
- Wake on login (Gateway triggers Fly.io resume)
- Per-session billing vs always-on (user choice)

**Conclusion:** Sprite-local storage is economically viable at $100-500/month price point.
