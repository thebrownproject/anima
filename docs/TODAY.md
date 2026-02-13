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
**Status:** DONE (Session 155)

**Root cause:** Bridge had no logic to start the Sprite's Python server on initial connect. TCP Proxy got 1011 (nothing listening on port 8765) and gave up.

**Fixes applied:**
- `bridge/src/provisioning.ts` — Added `startSpriteServer()` shared utility with env vars. Called after `bootstrapSprite()`.
- `bridge/src/proxy.ts` — Added 1011 retry in `ensureSpriteConnection`: detect error → start server → retry once.
- `bridge/src/reconnect.ts` — Replaced inline exec with shared `startSpriteServer` (fixed missing env vars bug).
- Deployed to Fly.io. Created venv symlink + VERSION on `sd-e2e-test` Sprite.
- **E2E verified:** Agent creates Tool discography card → canvas_update flows through Bridge → card appears in browser.

**Bug found:** `spriteExec` uses `sprite` CLI not available on Fly.io (stackdocs-sm2, P1).

### 2. m7b.4.12.9 — Block renderer (frontend)
**Status:** DONE (Session 153/154)

`frontend/components/desktop/block-renderer.tsx` (146 lines) — all 8 block types with glass styling. Wired into `page.tsx`. Inspector passed 10/10.

**Outstanding:** Agent sends `blocks` as a JSON string, not parsed array. Need a small fix in ws-provider or desktop-store to `JSON.parse(blocks)` if it arrives as a string. The test-chat page renders raw JSON because it doesn't use BlockRenderer — desktop route (`/stacks/default`) should work once the string parsing is added.

### 3. m7b.4.9 — Agent system prompt + canvas tool API
**Status:** open | **Risk:** low (well-defined changes)

Update agent to create better cards. Swap `card_type` → `size` param. Update system prompt with Canvas section. Not strictly needed (agent already creates cards), but makes the demo much better.

**Changes across 3 codebases:**
- `sprite/src/runtime.py` — system prompt Canvas section
- `sprite/src/agents/shared/canvas_tools.py` — `card_type` → `size`
- `sprite/src/protocol.py` — add `size` field
- `bridge/src/protocol.ts` — add `size` field
- `frontend/types/ws-protocol.ts` — mirror bridge changes

## Current Architecture Context

**What's working:**
- Full E2E pipe: browser → Bridge → Sprite → agent → canvas_update → browser
- WebSocketProvider → auto-connects, dispatches to Zustand stores
- DesktopCard with drag/drop, z-index, close, framer-motion animations
- ChatPanel with message bubbles, typing indicator, streaming glow
- ChatBar (bottom glass pill, idle/active states, send mission messages)
- DocumentsPanel (file tree, mock data)
- Desktop viewport with pan/zoom
- Agent creates cards proactively (soul.md working)

**What's NOT working:**
- Cards show raw JSON instead of rendered blocks (m7b.4.12.9)
- Agent uses `card_type` param (should be `size`) (m7b.4.9)
