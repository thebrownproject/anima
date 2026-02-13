# Exploration: One Sprite VM Per User (Architecture Change)

**Date:** 2026-02-13
**Status:** Ready for planning

---

## Problem

The current architecture provisions **one Sprite VM per stack**. Each stack gets its own isolated VM with its own filesystem, SQLite database, agent runtime, and WebSocket connection. This made sense when stacks were heavyweight workspaces, but the product vision has evolved:

**Stacks are now lightweight — like browser tabs, not VMs.** Users create and delete them frequently. They're virtual desktops for organizing card layouts, not isolated sandboxes. The agent should be a persistent personal assistant that works across all of a user's workspaces, not a fresh instance per tab.

The per-stack VM model creates problems:
- **Cost**: A user with 5 stacks = 5 VMs. Most sit idle. Sprites.dev charges per-VM.
- **No cross-stack intelligence**: Agent in stack A can't reference documents from stack B.
- **Slow stack creation**: New stack = new VM provisioning (seconds of latency).
- **No persistent assistant**: Each stack has its own agent with its own memory. No unified user experience.

---

## Solution

Move to **one Sprite VM per user**. The VM is the user's personal computer. "Stacks" become **desktops** — saved canvas layouts that the user switches between like virtual desktops in macOS. One agent, one filesystem, one database, one chat thread, multiple visual workspaces.

The user talks to their agent in one continuous conversation. The agent can create, update, and close cards on any desktop. When sending a message, the frontend includes compact context about the currently visible desktop and its cards, so the agent knows what the user is looking at.

---

## Requirements

- [ ] One Sprite VM provisioned per user (not per stack)
- [ ] One WebSocket connection per user session (URL: `/ws/`, user derived from JWT)
- [ ] "Stacks" renamed to "desktops" — lightweight canvas layouts with tab switching
- [ ] Agent works across all desktops (user-level, not desktop-scoped)
- [ ] Compact canvas context sent with every user message (active desktop, card IDs/titles/block types)
- [ ] Card state persisted on Sprite DB (source of truth) with localStorage cache (instant render)
- [ ] Chat history persisted on Sprite, loaded on WS connect
- [ ] Desktop metadata stored in Supabase (instant page load, billing enforcement)
- [ ] Desktop card content managed entirely on Sprite
- [ ] Sprite provisioned lazily on first WS connection
- [ ] Frontend uses single-page tab switching (no URL routing per desktop)
- [ ] Billing limits enforced via Supabase (free tier = N desktops)

---

## Non-Requirements

- Not building cross-desktop queries in MVP (agent CAN see all files, but no explicit "compare across desktops" UI)
- Not sending desktop-switch notifications to the agent (context comes with messages only)
- Not persisting card state in Supabase (Sprite DB + localStorage only)
- Not changing the Sprite runtime's single-tenant model (VM boundary IS the isolation)
- Not implementing real-time collaborative editing (single user per Sprite)
- Not migrating existing v1 data (fresh start for v2)

---

## Architecture

### System Overview

```
  Browser (one WS connection per user session)
    |
    | wss://ws.stackdocs.io/ws/  (no stackId in URL)
    | JWT contains user_id, validated on connect
    v
  Bridge (Fly.io)
    |
    | Routes by user_id -> sprite_name (from users table)
    | One TCP Proxy connection per user
    | Provisioning: create Sprite on first-ever user connection
    v
  Sprite VM (one per user, Sprites.dev)
    |
    | Single agent runtime, single SQLite DB
    | Agent manages filesystem freely
    | Cards table tracks all cards across all desktops
    | Chat transcript persisted in DB
    v
  Supabase (platform data)
    |
    | users: id, clerk_id, sprite_name, sprite_status, tier
    | desktops: id, user_id, name, position, created_at
```

### Supabase Schema Changes

```sql
-- BEFORE (stacks table has sprite mapping)
users:  id, clerk_id, email, tier
stacks: id, user_id, name, sprite_name, sprite_status

-- AFTER (sprite mapping on users, stacks -> desktops)
users:    id, clerk_id, email, tier, sprite_name, sprite_status
desktops: id, user_id, name, position, created_at
```

`desktops` is a lightweight metadata table for:
- Tab bar rendering (instant, no Sprite wake needed)
- Billing limit enforcement (free = N desktops)
- Desktop ordering (position column for tab order)

No card data in Supabase. Card content lives on Sprite.

### Sprite Filesystem

No change from current layout. Agent manages `/workspace/` freely. No per-desktop namespacing — the agent organizes files however it sees fit (folders by topic, date, project, etc.).

```
/workspace/
  .os/
    src/        # Agent runtime code
    memory/     # soul.md, user.md, os.md, journals, DBs
    .venv/      # Python virtual environment
  documents/    # Uploaded files (agent-organized)
  ocr/          # Cached OCR results
  artifacts/    # Agent-generated outputs
```

### Sprite SQLite Changes

Add `desktops` and `cards` tables. Remove any stack_id concepts.

```sql
-- Desktop layouts (mirrors Supabase desktops for agent access)
CREATE TABLE desktops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at REAL NOT NULL
);

-- Cards on desktops (source of truth for card content)
CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    desktop_id TEXT NOT NULL REFERENCES desktops(id),
    title TEXT NOT NULL,
    blocks TEXT NOT NULL DEFAULT '[]',  -- JSON array of Block objects
    size TEXT NOT NULL DEFAULT 'medium',
    position TEXT NOT NULL DEFAULT '{"x":0,"y":0}',  -- JSON {x, y}
    z_index INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

-- Chat messages (for history persistence)
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,  -- 'user' | 'assistant'
    content TEXT NOT NULL,
    timestamp REAL NOT NULL
);
```

Existing tables (`documents`, `ocr_results`, `extractions`) remain unchanged — no stack_id column needed since the agent works across all data.

### WebSocket Protocol Changes

**Modified: `mission` message payload**
```typescript
// BEFORE
payload: { text: string; attachments?: string[] }

// AFTER
payload: {
  text: string
  attachments?: string[]
  context?: {
    desktop_id: string
    desktop_name: string
    cards: Array<{
      id: string
      title: string
      size: CardSize
      block_types: string[]  // e.g., ['table', 'text', 'image']
    }>
  }
}
```

**Modified: `canvas_update` payload gains `desktop_id`**
```typescript
payload: {
  action: 'create' | 'update' | 'close'
  card_id: string
  desktop_id: string  // NEW: which desktop this card belongs to
  title?: string
  size?: CardSize
  blocks?: Block[]
}
```

**New: `state_sync` (Sprite -> Browser, on connect)**
```typescript
{
  type: 'state_sync'
  payload: {
    desktops: Array<{ id: string; name: string }>
    cards: Record<string, Array<{  // keyed by desktop_id
      id: string; title: string; blocks: Block[]
      size: CardSize; position: { x: number; y: number }; zIndex: number
    }>>
    recent_messages: Array<{
      id: string; role: string; content: string; timestamp: number
    }>
  }
}
```

**Removed: no `switch_stack` or `switch_desktop` message needed.** Desktop switching is purely frontend state. Agent learns about active desktop from `mission.payload.context`.

### Bridge Changes

| Current (keyed by stackId) | New (keyed by userId) |
|---|---|
| URL: `/ws/{stack_id}` | URL: `/ws/` |
| `spriteConnections.get(stackId)` | `spriteConnections.get(userId)` |
| `reconnectStates.get(stackId)` | `reconnectStates.get(userId)` |
| `keepaliveTimers.get(stackId)` | `keepaliveTimers.get(userId)` |
| Auth: lookup `stacks.sprite_name` | Auth: lookup `users.sprite_name` |
| Provisioning: per stack | Provisioning: per user |

### Frontend Changes

| Current | New |
|---|---|
| WebSocketProvider takes `stackId` | WebSocketProvider at app level (no stackId) |
| WS URL: `/ws/{stackId}` | WS URL: `/ws/` |
| Route: `/stacks/[id]/page.tsx` | Single page with tab switcher |
| Desktop store: global, not scoped | Desktop store: multi-desktop aware |
| Chat store: ephemeral | Chat store: loads history from Sprite |
| ChatBar sends `{ text }` | ChatBar sends `{ text, context }` |

### Connection Lifecycle

1. User opens app -> page loads
2. Supabase query: fetch user's desktops (instant, for tab bar)
3. localStorage: render cached cards for active desktop (instant)
4. WS connect to `/ws/` with JWT
5. Bridge validates JWT, extracts `user_id`
6. Bridge looks up `users.sprite_name`
7. If no sprite: provision new Sprite, update `users` row
8. Bridge connects TCP Proxy to Sprite (wake if sleeping, 1-12s)
9. Sprite sends `state_sync`: all desktops, all cards, recent chat messages
10. Frontend reconciles: merge Sprite state with localStorage cache
11. User is live — messages flow bidirectionally

---

## Constraints

- Sprites.dev: 30s auto-sleep, 1-12s cold wake, TCP connections die on sleep
- Bridge handles reconnection on wake (existing pattern, re-key by userId)
- Sprite processes survive sleep (checkpoint/CRIU) — server persists
- Protocol types must be mirrored in 3 places: `bridge/protocol.ts`, `frontend/ws-protocol.ts`, `sprite/protocol.py`
- `canvas_update` from agent needs `desktop_id` so frontend knows which desktop to update
- Card state must be available for instant render (localStorage cache) even before Sprite wakes
- Billing enforcement (desktop limits) must be server-side (Supabase), not client-side

---

## Success Criteria

- [ ] Single Sprite VM per user, provisioned on first WS connection
- [ ] One WebSocket connection per user session, routed by user_id
- [ ] Desktop tabs work as virtual desktop switcher (create, rename, delete, reorder)
- [ ] Agent receives canvas context (active desktop + card summaries) with every message
- [ ] Agent can create/update/close cards on any desktop via `canvas_update` with `desktop_id`
- [ ] Card state persists across page refreshes (localStorage cache + Sprite DB sync)
- [ ] Chat history loads from Sprite on connect
- [ ] `state_sync` message delivers full card + chat state on WS connect
- [ ] Desktop billing limits enforced (Supabase-side)
- [ ] Bridge routes by userId, manages one TCP Proxy per user
- [ ] All existing tests updated/passing

---

## Open Questions

1. **Desktop limits for free tier** — How many desktops? 2? 3? Unlimited? (Product decision, doesn't block implementation.)
2. **Chat history depth** — How many recent messages to load on connect? Last 50? Last 24 hours? Configurable?
3. **Card position sync** — When user drags a card, does the new position sync to Sprite immediately, or only on next message? (Latency vs consistency trade-off.)
4. **Desktop deletion** — When user deletes a desktop, do the cards and their data get permanently deleted from Sprite DB? Or soft-deleted/archived?
5. **Multiple browser tabs** — If user has the app open in two browser tabs, both connect as the same user. How does Bridge handle two WS connections for one user? (Likely: both get messages, both can send. Last-write-wins for card positions.)

---

## Next Steps

1. `/plan` to break this into ordered implementation tasks
2. Resolve open questions (none are blocking — all have reasonable defaults)
3. Implementation order: Bridge re-routing -> Supabase schema -> Sprite DB + state_sync -> Frontend single-page + tab switcher -> Context enrichment -> Chat persistence
