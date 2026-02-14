# CLAUDE.md

## Project Overview

**Stackdocs** is a **personal AI computer** for document intelligence. Each user gets a persistent VM (Sprite) running a full Claude Code-equivalent agent that learns, remembers, and works autonomously.

**Core Value:** Talk to agent → AI extracts structured data from documents → Correct via chat → Agent learns → Export CSV/JSON

**Mental Model:** The agent IS the operating system. Users talk to it; it pulls up information, organizes data, and renders results to a visual Canvas.

---

## Architecture

```
Browser ──HTTPS──> Vercel (Next.js 16, Clerk auth, Canvas UI)
   │
   └──WSS──> Fly.io Bridge (Node.js WS proxy)
                │  - Clerk JWT validation (on connect only)
                │  - Route user_id → sprite_name (via Supabase users table)
                │  - API key proxy (Anthropic + Mistral for Sprites)
                │  - Sprite provisioning + lazy code updates
                │  - Sleep/wake reconnection + keepalive pings
                │
                └──TCP Proxy──> Sprites.dev (one VM per user)
                                  - Python WebSocket server (persists through sleep/wake)
                                  - Agent Runtime (Claude Agent SDK — full tool access)
                                  - Memory System (6 md files + observation processor)
                                  - SQLite databases (transcript, memory, workspace)
                                  - 100GB persistent filesystem
```

**Three codebases in one repo:**

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `frontend/` | Next.js 16, Clerk, Zustand, glass components | Canvas UI, WebSocket client |
| `bridge/` | Node.js, Fly.io | WS proxy, auth, provisioning, API key proxy |
| `sprite/` | Python, Claude Agent SDK, SQLite | Agent runtime, memory, extraction |
| `backend/` | FastAPI (v1, being replaced) | Legacy endpoints on DigitalOcean |

---

## Frontend

Next.js 16 (App Router), Clerk auth, shadcn/ui + glass components, Zustand stores.

**Key paths:**
- `app/(desktop)/desktop/page.tsx` — main desktop page (no dynamic route)
- `components/desktop/` — viewport, cards, chat, panels, ws-provider (13 components)
- `components/debug/` — debug panel (Cmd+Shift+D toggle, WS message inspector)
- `components/ui/` — shadcn/ui primitives + glass-* components
- `lib/websocket.ts` — WebSocket connection manager
- `lib/stores/` — chat-store (ephemeral), desktop-store (persisted), wallpaper-store
- `types/ws-protocol.ts` — message types (copy of bridge source)

---

## Bridge

Node.js WebSocket proxy on Fly.io. Routes messages between browsers and Sprites.

**Key paths:**
- `src/index.ts` — HTTP server + WS upgrade on `/ws`
- `src/auth.ts` — Clerk JWT + Supabase users table lookup
- `src/protocol.ts` — WebSocket message types (source of truth)
- `src/proxy.ts` — browser ↔ Sprite forwarding (keyed by userId)
- `src/api-proxy.ts` — Anthropic/Mistral API key proxy for Sprites
- `src/provisioning.ts` — lazy Sprite creation + bootstrap
- `src/connection-store.ts` — browser connection registry
- `src/reconnect.ts` + `src/keepalive.ts` — sleep/wake handling

**Tests:** 136 passing (Vitest) — unit, integration, E2E with mock Sprite

---

## Sprite Runtime

Python agent runtime on each Sprite VM. One per user.

**Key paths:**
- `src/server.py` — WebSocket server on port 8765
- `src/gateway.py` — message router (dispatches to agent or handles directly)
- `src/runtime.py` — AgentRuntime wrapping Claude Agent SDK
- `src/database.py` — three async SQLite databases (TranscriptDB, MemoryDB, WorkspaceDB)
- `src/tools/canvas.py` — create/update/close Canvas windows
- `src/tools/memory.py` — memory read/write tools
- `src/memory/processor.py` — ObservationProcessor (Haiku-powered, runs every 25 turns)
- `src/memory/hooks.py` — TurnBuffer + SDK hook callbacks
- `src/memory/loader.py` — load memory files into system prompt

**Memory files** (on Sprite at `/workspace/.os/memory/`):
- `soul.md`, `os.md` — deploy-managed (stack identity, system rules)
- `tools.md`, `files.md`, `user.md`, `context.md` — daemon-managed (auto-updated by processor)

---

## Database

**Supabase (platform data only):**

| Table | Purpose |
|-------|---------|
| `users` | Clerk ID, email, tier, `sprite_name`, `sprite_status` |
| `stacks` | Stack metadata (`name`, `color`, `sort_order`, `archived_at`) |

**Sprite SQLite (per-user, on-VM):**

| Database | Tables | Purpose |
|----------|--------|---------|
| `transcript.db` | observations, sessions | Append-only conversation log |
| `memory.db` | learnings, learnings_fts | Extracted knowledge (FTS5 indexed) |
| `workspace.db` | stacks, cards, chat_messages | Canvas state + chat history |

---

## Deployment

| Component | URL | Host |
|-----------|-----|------|
| Frontend | `www.stackdocs.io` | Vercel |
| Bridge | `ws.stackdocs.io` | Fly.io (syd, auto-stop/start) |
| Sprites | per-user VMs | Sprites.dev |
| Backend | `api.stackdocs.io` | DigitalOcean (v1, being replaced) |

---

## Key Patterns

**One Sprite per user:** Bridge maps `user_id → sprite_name` via Supabase `users` table. Stacks are lightweight canvas layouts on the same Sprite. Multiple browser tabs share one Sprite TCP connection.

**WebSocket protocol:** TypeScript types in `bridge/src/protocol.ts` (source of truth), Python dataclasses in `sprite/src/protocol.py`. Every message has mandatory `id` (UUID) and `timestamp`.

**Tool factory (scoped closures):** `create_tools(...)` — same pattern from v1, `db` param is now SQLite.

**Canvas architecture:** Agent creates/updates/closes windows via `canvas_update` messages. Custom viewport with momentum physics (not React Flow). Zustand desktop-store + localStorage persistence.

**Memory system:** 6 markdown files loaded into system prompt. ObservationProcessor (Haiku) runs every 25 turns to extract learnings and update daemon-managed files. TurnBuffer captures user messages + tool calls + agent responses via SDK hooks.

**Sprites.dev behavior:** Processes frozen on sleep (CRIU checkpoint, same PID on wake). TCP connections die on sleep — Bridge reconnects. 30s auto-sleep, keepalive prevents during active sessions.

**Debug panel:** `Cmd+Shift+D` toggles left-side WS inspector. Shows connection status, all messages sent/received, agent tool calls. `localStorage.setItem('stackdocs:debug', 'true')` also works.

---

## Development Workflow

Uses **Space-Agents** for planning and execution: `/launch`, `/exploration`, `/mission`, `/land`.

**Issue tracking:** Beads (`bd list`, `bd show`, `bd ready`). MCP tools: **context7** for library docs, **perplexity** for verification, **supabase** for DB queries.

---

## Code Principles

**KISS:** Keep it simple. Direct WebSocket messages, SQLite queries, asyncio tasks.

**YAGNI:** Don't build features not in current task. Ask before adding "helpful" extras.

**DRY:** Reuse tool factory pattern, shared protocol types, common Canvas window logic.

**Understand before solving:** Always examine the existing structure before proposing workarounds.

**Protocol types are shared:** Changes to message types must update both TypeScript and Python.

**Supabase is platform-only:** User data lives on Sprite SQLite + filesystem, not Supabase.

**Ask before adding:** No extra features, refactoring, or "improvements" without explicit request.

**Inspector bloat findings are not optional:** If a review agent reports bloat, flag it immediately. Design targets are constraints, not suggestions.
