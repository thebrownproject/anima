# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

---

## Project Overview

**Stackdocs** is a **personal AI computer** for document intelligence. Each workspace (stack) runs on its own persistent VM (Sprite) with a full Claude Code-equivalent agent that learns, remembers, and works autonomously.

**Core Value:** Talk to agent → AI extracts structured data from documents → Correct via chat → Agent learns → Export CSV/JSON

**Target Audience:** SMBs eliminating manual data entry from documents

**Business Model:** Free tier (1 stack) → Paid tiers (multiple stacks, $100-500/month)

**Mental Model:** The agent IS the operating system. Users don't navigate UI — they talk to the agent, and it pulls up information, organizes data, and renders results to a visual Canvas.

---

## Development Workflow

This project uses the **Space-Agents workflow** for planning and implementing features:

| Phase   | Skill                  | Output                                        |
| ------- | ---------------------- | --------------------------------------------- |
| Explore | `/exploration`         | Brainstorm, debug, plan, or review modes      |
| Plan    | `/exploration-plan`    | Task-by-task implementation plan in Beads     |
| Execute | `/mission`             | Working code with Worker/Inspector/Analyst    |

**Session Commands:**

| Command   | When to Use |
|-----------|-------------|
| `/launch` | Start of session - loads context, displays project status |
| `/land`   | End of session - syncs CAPCOM and Beads, commits |
| `/capcom` | Check mission status and progress |

**MCP Tools Guide:**

- **context7** - Fetch current library docs before writing code
- **perplexity** - Verify latest versions, APIs, and best practices

**Reference Docs:**

| Doc | Purpose |
|-----|---------|
| `.space-agents/mission/staged/m7b-stackdocs-v2-sovereign-agent-platform/spec.md` | v2 architecture spec (source of truth) |
| `.space-agents/mission/staged/m7b-stackdocs-v2-sovereign-agent-platform/plan.md` | v2 implementation plan (29 tasks) |
| `docs/specs/ARCHITECTURE.md` | v1 system design (being replaced) |
| `docs/specs/SCHEMA.md` | Database schema (v1 Supabase + v2 Sprite SQLite) |
| `docs/specs/PRD.md` | Product requirements |
| `.space-agents/comms/capcom.md` | Session history (grep for context, don't read in full) |
| `docs/CLAUDE.md` | Planning index, workflow details |
| Beads | Issue tracking - `bd list`, `bd show`, `bd ready` |

---

## Architecture (v2)

```
                         HTTPS (pages, SSR, auth)
            +----------------------------------------------+
            |                                              |
  Browser --|  www.stackdocs.io (Vercel)                   |
            |  Next.js 16, App Router, Clerk               |
            |  Canvas UI (React Flow)                      |
            +----------------------------------------------+
            |
            |  WebSocket (wss://ws.stackdocs.io)
            |  JWT validated on connect, trust connection
            v
  +--------------------------------------------------------+
  |  Fly.io Machine: Bridge Service                        |
  |  Node.js, lightweight WS proxy (~300 lines)            |
  |                                                        |
  |  - WebSocket server (browser connections)              |
  |  - Clerk JWT validation (on connect only)              |
  |  - Route user_id → stack → sprite_name (via Supabase) |
  |  - Proxy messages: browser ↔ Sprite                   |
  |  - Sprite provisioning (create from golden checkpoint) |
  |  - Handle Sprite sleep/wake reconnection               |
  |  - Keepalive pings to prevent 30s Sprite sleep         |
  +------------------------+-------------------------------+
                           |  TCP Proxy API (WSS)
                           v
  +--------------------------------------------------------+
  |  Sprites.dev (one VM per stack)                        |
  |                                                        |
  |  Python WebSocket server (auto-restarts on wake)       |
  |  +-- SpriteGateway (message router)                    |
  |  +-- Agent Runtime (Claude Agent SDK — full access)    |
  |  |   +-- Extraction tools, Canvas tools, Memory tools  |
  |  |   +-- Bash, Read, Write, WebSearch, subagents       |
  |  +-- Memory System (soul.md, user.md, journals)        |
  |  +-- SQLite database (documents, extractions, memory)  |
  |  +-- 100GB persistent filesystem                       |
  +--------------------------------------------------------+
```

**Three codebases in one repo:**

```
frontend/     # Next.js 16 — Canvas UI, Clerk auth, WebSocket client
bridge/       # Node.js — Fly.io WS proxy (NEW for v2)
sprite/       # Python — Sprite agent runtime (NEW for v2)
backend/      # FastAPI — v1 backend (being replaced by sprite/)
```

---

## Frontend

Next.js 16 (App Router) with Clerk auth, shadcn/ui components, and React Flow Canvas.

```
frontend/
├── app/(app)/              # Protected routes with @header/@subbar parallel slots
├── components/
│   ├── canvas/             # v2: React Flow canvas, window components (NEW)
│   ├── agent/              # v1: Agent flow system (being replaced by Canvas chat)
│   ├── documents/          # Document tables, detail views
│   ├── stacks/             # Stack list, detail views
│   └── ui/                 # shadcn/ui primitives
├── lib/
│   ├── websocket.ts        # v2: WebSocket connection manager (NEW)
│   ├── stores/
│   │   ├── ws-store.ts     # v2: WS connection state (NEW)
│   │   └── canvas-store.ts # v2: Canvas window state (NEW)
│   └── supabase/           # Supabase client (platform data only in v2)
└── types/
    └── ws-protocol.ts      # v2: WebSocket message types (NEW)
```

See `frontend/CLAUDE.md` for patterns and directory structure.

---

## Bridge (NEW — v2)

Node.js WebSocket proxy on Fly.io. Lightweight — routes messages between browsers and Sprites.

```
bridge/
├── src/
│   ├── index.ts            # HTTP server + WS upgrade
│   ├── auth.ts             # Clerk JWT validation
│   ├── protocol.ts         # WebSocket message types (source of truth)
│   ├── sprites-client.ts   # Sprites.dev REST API client
│   ├── provisioning.ts     # Lazy Sprite creation from golden checkpoint
│   ├── proxy.ts            # Message forwarding browser ↔ Sprite
│   ├── sprite-connection.ts # TCP Proxy connection to Sprite
│   ├── reconnect.ts        # Sleep/wake reconnection logic
│   └── keepalive.ts        # Prevent Sprite auto-sleep during sessions
├── tests/
├── Dockerfile
└── fly.toml
```

---

## Sprite Runtime (NEW — v2)

Python agent runtime that runs on each Sprite VM. Ports v1 extraction agents from Supabase to SQLite.

```
sprite/
├── src/
│   ├── server.py           # WebSocket server on port 8765
│   ├── gateway.py          # SpriteGateway message router
│   ├── runtime.py          # AgentRuntime wrapping Claude Agent SDK
│   ├── database.py         # Async SQLite wrapper (aiosqlite)
│   ├── protocol.py         # WebSocket message types (Python dataclasses)
│   ├── agents/
│   │   ├── extraction_agent/  # Ported from backend/app/agents/
│   │   └── shared/
│   │       ├── canvas_tools.py  # create/update/close windows
│   │       └── memory_tools.py  # write_memory, update_soul
│   ├── memory/
│   │   ├── loader.py       # Load soul.md + journals into system prompt
│   │   ├── journal.py      # Daily journal append
│   │   └── transcript.py   # JSONL audit logging
│   ├── handlers/
│   │   └── upload.py       # File upload handler
│   └── services/
│       └── ocr.py          # Mistral OCR + Claude native PDF
├── tests/
└── requirements.txt
```

---

## Backend (v1 — Being Replaced)

FastAPI on DigitalOcean. Still running for v1 features. Being replaced by Sprite runtime.

See `backend/CLAUDE.md` for legacy endpoints and deployment.

---

## Database

**Supabase (platform data only in v2):**

| Table    | Purpose |
|----------|---------|
| `users`  | User profiles (Clerk ID, email, subscription tier) |
| `stacks` | Stack metadata + Sprite mapping (`sprite_name`, `sprite_status`) |

v1 tables (`documents`, `extractions`, `ocr_results`, etc.) still exist but are being replaced by Sprite-local SQLite.

**Sprite SQLite (per-stack, on-VM):**

| Table | Purpose |
|-------|---------|
| `documents` | Uploaded file metadata (files on Sprite filesystem) |
| `ocr_results` | OCR text metadata (text cached at `/workspace/ocr/`) |
| `extractions` | AI-extracted structured data (JSON fields) |
| `memory_fts` | FTS5 virtual table for memory search |

---

## Deployment

| Component | URL | Host |
|-----------|-----|------|
| Frontend  | `www.stackdocs.io` | Vercel |
| Bridge    | `ws.stackdocs.io` | Fly.io |
| Sprites   | (per-stack VMs) | Sprites.dev |
| Backend   | `api.stackdocs.io` | DigitalOcean (v1, being replaced) |

---

## Key Patterns

**Tool factory (scoped closures):** `create_tools(extraction_id, doc_id, user_id, db)` — same pattern from v1, `db` param changes from Supabase to SQLite.

**WebSocket message protocol:** TypeScript types in `bridge/src/protocol.ts` (source of truth), Python dataclasses in `sprite/src/protocol.py`. Every message has mandatory `id` (UUID) and `timestamp`.

**Canvas architecture:** Agent creates/updates/closes windows via WebSocket `canvas_update` messages. Zustand store + localStorage for persistence. React Flow for pan/zoom/grid.

**Memory system:** `soul.md` (stack identity), `user.md` (user prefs), `MEMORY.md` (global context), daily journals. Loaded into system prompt at session start.

**Sprites.dev behavior:** Processes killed on sleep (filesystem persists). Services auto-restart on wake. TCP connections die on sleep — Bridge must reconnect. 30s auto-sleep, 1-12s cold wake.

---

## Code Principles

**KISS:** Keep it simple. Direct WebSocket messages, SQLite queries, asyncio tasks.

**YAGNI:** Don't build features not in current task. Ask before adding "helpful" extras.

**DRY:** Reuse tool factory pattern, shared protocol types, common Canvas window logic.

**Understand before solving:** Always examine the existing structure before proposing workarounds.

---

## Key Reminders

1. **Three codebases:** `frontend/`, `bridge/`, `sprite/` — know which you're working in
2. **Protocol types are shared** — changes to message types must update TS and Python
3. **Supabase is platform-only in v2** — user data lives on Sprite SQLite + filesystem
4. **OCR is cached on Sprite** — `/workspace/ocr/{doc_id}.md` persists across sessions
5. **Sprites sleep after 30s** — Bridge keepalive prevents this during active sessions
6. **Pre-compaction flush is post-MVP** — claude-agent-sdk doesn't expose compaction controls
7. **Ask before adding** — No extra features without explicit request
