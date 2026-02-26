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
                                  - Memory daemon (learns across sessions)
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

---

## Canvas — Streamable UI

The agent renders structured data to the user's desktop by streaming Canvas cards over WebSocket. Cards are not static templates — the agent creates, updates, and closes them in real-time as it works.

Each card has a **type** (document, metric, table, data) and contains **blocks** — composable content units the agent assembles:

| Block | Purpose |
|-------|---------|
| `heading` | Title + optional subtitle |
| `stat` | Single metric with label and trend |
| `key-value` | Extracted field pairs |
| `table` | Columns + rows |
| `text` | Freeform markdown content |
| `badge` | Status indicators |
| `progress` | Completion bars |

The frontend renders these on a custom viewport with momentum physics and drag-to-arrange. Card state persists in SQLite on the Sprite and syncs on reconnect — the desktop survives browser refreshes, tab closes, and VM sleep/wake cycles.

---

## Memory Daemon

Each Sprite runs a background memory daemon that watches conversations and builds a persistent understanding of the user over time. The agent doesn't just respond — it learns.

**How it works:**

1. **TurnBuffer** captures every user message, tool call, and agent response via Claude Agent SDK hooks
2. Observations are written to `transcript.db` (append-only SQLite)
3. Every 10 turns, the **ObservationProcessor** fires — a Haiku-powered batch job that reads unprocessed observations and extracts structured learnings
4. Learnings are stored in `memory.db` (FTS5-indexed for search) and used to update 4 daemon-managed markdown files

**Memory files** (loaded into the agent's system prompt every turn):

| File | Managed by | Content |
|------|------------|---------|
| `soul.md` | Deploy | Agent identity and character |
| `os.md` | Deploy | System rules and capabilities |
| `tools.md` | Daemon | What tools the agent has used and learned about |
| `files.md` | Daemon | What's on the user's filesystem |
| `user.md` | Daemon | User preferences, corrections, patterns |
| `context.md` | Daemon | Current project state, recent activity |

The agent's system prompt is rebuilt on every turn from these files, so daemon updates take effect immediately. Deploy-managed files (`soul.md`, `os.md`) are overwritten on code updates. Daemon-managed files evolve autonomously — the agent literally gets smarter the more you use it.

---

## Voice

The agent supports real-time voice conversation — speak to it and hear it respond.

**Speech-to-text:** Deepgram Nova-3 via WebSocket. Live transcription with interim results streamed to the chat input as the user speaks. Temporary API tokens generated server-side to avoid exposing credentials.

**Text-to-speech:** OpenAI `gpt-4o-mini-tts` via streaming PCM. Audio is decoded and played through a shared 24kHz AudioContext singleton using an AudioWorklet processor — no `<audio>` elements or MP3 decoding.

**Persona Orb:** A Rive-animated avatar that reflects the agent's state in real-time — idle, listening, thinking, speaking, or asleep. Sits at the center of the desktop and gives the agent a visual presence.

Voice is feature-flagged via `NEXT_PUBLIC_VOICE_ENABLED` and requires Deepgram + OpenAI API keys.

---

## Key Concepts

- **One Sprite per user** — each user gets a dedicated VM with persistent storage, memory, and conversation history
- **Sleep/wake** — Sprite VMs freeze on idle via CRIU checkpoint (same PID on wake). Bridge handles TCP reconnection transparently. 30s auto-sleep, keepalive pings prevent it during active sessions.
- **API key proxy** — Sprites never hold API keys. Bridge proxies Anthropic/Mistral calls, injecting keys server-side. Prevents prompt injection from stealing credentials.

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
