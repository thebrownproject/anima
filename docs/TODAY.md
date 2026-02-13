# Today's Goal: Agent Renders Items to Screen

**Date:** 2026-02-13
**Route:** `/stacks/default` (desktop UI, not test-chat)

## The End-to-End Flow

```
User types in ChatBar → mission msg → Bridge → Sprite → agent calls create_card
→ canvas_update msg → Sprite → Bridge → Browser → ws-provider → desktop-store
→ DesktopCard renders Block[] as actual glass UI
```

## Task Order

### 1. m7b.4.11 — Fix Bridge → Sprite connection pipe
**Status:** open | **Risk:** high (debugging, unknown scope)

The blocker. Agent already tries to create cards (soul.md tells it to), but `canvas_update` messages fail in transit back to browser. Known bug from Session 136 — agent calls `create_card`, gets WebSocket error, falls back to text.

**Likely cause:** Bridge TCP Proxy not forwarding Sprite-originated messages back to browser WS. Or send_fn in canvas_tools.py pointing at stale connection.

**Debug chain:** canvas_tools → runtime → gateway → server → TCP connection → Bridge → browser WS

**Key files:**
- `sprite/src/agents/shared/canvas_tools.py` — send_fn
- `sprite/src/gateway.py` — message router
- `sprite/src/server.py` — WS server on port 8765
- `bridge/src/proxy.ts` — message forwarding
- `bridge/src/sprite-connection.ts` — TCP Proxy connection

### 2. m7b.4.12.9 — Block renderer (frontend)
**Status:** open | **Risk:** low (well-scoped, pure frontend)

Build `<BlockRenderer blocks={Block[]}/>` that renders all 8 block types with glass styling. Wire into `DesktopCard` replacing the "Block renderer coming in task 9" placeholder.

**Block types to render:**
- `heading` — text + optional subtitle
- `stat` — value + label + optional trend
- `key-value` — array of label:value pairs
- `table` — columns + rows
- `badge` — text + variant (default/success/warning/destructive)
- `progress` — 0-100 value + optional label
- `text` — markdown content
- `separator` — visual divider

**Key files:**
- `frontend/app/(desktop)/stacks/[id]/page.tsx:33-39` — placeholder to replace
- `frontend/components/desktop/desktop-card.tsx` — card container
- `frontend/types/ws-protocol.ts:36-119` — Block type definitions

### 3. m7b.4.9 — Agent system prompt + canvas tool API
**Status:** open | **Risk:** low (well-defined changes)

Update agent to create better cards. Swap `card_type` → `size` param. Update system prompt with Canvas section. Not strictly needed (agent already creates cards), but makes the demo much better.

**Changes across 3 codebases:**
- `sprite/src/runtime.py` — system prompt Canvas section
- `sprite/src/agents/shared/canvas_tools.py` — `card_type` → `size`
- `sprite/src/protocol.py` — add `size` field
- `bridge/src/protocol.ts` — add `size` field
- `frontend/types/ws-protocol.ts` — mirror bridge changes

## Housekeeping

Close these (code is built, uncommitted in working tree):
- **m7b.4.12.10** — Chat panel ✅ (`chat-panel.tsx`, 137 lines)
- **m7b.4.12.11** — Documents panel ✅ (`documents-panel.tsx`, 171 lines)

## Current Architecture Context

**What's working in `/stacks/default`:**
- WebSocketProvider → auto-connects, dispatches to Zustand stores
- DesktopCard with drag/drop, z-index, close, framer-motion animations
- ChatPanel with message bubbles, typing indicator, streaming glow
- ChatBar (bottom glass pill, idle/active states, send mission messages)
- DocumentsPanel (file tree, mock data)
- Desktop viewport with pan/zoom

**What's NOT working:**
- Cards show "Block renderer coming in task 9" instead of actual content
- canvas_update messages from Sprite don't reach browser (pipe broken)
- Agent uses `card_type` param (should be `size`)
