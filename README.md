# Anima

A personal AI computer for document intelligence. Each user gets a persistent VM running a Claude-powered agent that learns, remembers, and works autonomously.

**Core loop:** Talk to agent → AI extracts structured data from documents → Correct via chat → Agent learns → Export CSV/JSON

**Mental model:** The agent IS the operating system. Users talk to it; it pulls up information, organizes data, and renders results to a visual Canvas.

---

## Architecture

```
Browser ──HTTPS──> Vercel (Next.js 16, Clerk auth, Canvas UI)
   │
   └──WSS──> Fly.io Bridge (Node.js WS proxy)
                │
                └──TCP Proxy──> Sprites.dev (one VM per user)
                                  - Claude Agent SDK (full tool access)
                                  - Memory system (learns across sessions)
                                  - SQLite databases
                                  - 100GB persistent filesystem
```

## Codebases

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `frontend/` | Next.js 16, Clerk, Zustand, shadcn/ui | Canvas UI, WebSocket client |
| `bridge/` | Node.js, Fly.io | WS proxy, auth, provisioning, API key proxy |
| `sprite/` | Python, Claude Agent SDK, SQLite | Agent runtime, memory, extraction |
| `backend/` | FastAPI (v1, being replaced) | Legacy endpoints |

## Key Concepts

- **One Sprite per user** — each user gets a dedicated VM with persistent storage, memory, and conversation history
- **Canvas** — agent creates/updates/closes visual windows via WebSocket messages; custom viewport with momentum physics
- **Memory** — 6 markdown files loaded into system prompt; observation processor (Haiku) runs every 10 turns to extract learnings
- **Sleep/wake** — Sprite VMs freeze on idle (CRIU checkpoint), Bridge handles reconnection transparently

## Development

```bash
# Frontend
cd frontend && npm install && npm run dev

# Bridge
cd bridge && npm install && npm run dev

# Bridge tests (186 passing)
cd bridge && npm test
```

See `CLAUDE.md` for detailed architecture, key patterns, and development workflow.
