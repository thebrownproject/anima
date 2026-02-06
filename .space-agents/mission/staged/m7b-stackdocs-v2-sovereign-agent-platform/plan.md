# Feature: Stackdocs v2 — Sovereign Agent Platform

**Goal:** Rewrite Stackdocs from a multi-tenant SaaS into a personal AI computer where each stack runs on its own Sprite (microVM), connected via a Fly.io WebSocket Bridge, with a Canvas UI for visual output.

**Spec:** `spec.md` (same folder)

---

## Overview

Three new infrastructure components replace the current FastAPI + Supabase architecture:

1. **Fly.io Bridge** (Node.js) — Lightweight WebSocket proxy between browser and Sprites
2. **Sprites.dev VMs** (Python) — Per-stack persistent microVMs running Claude Agent SDK
3. **Canvas UI** (React Flow) — Visual window manager replacing tab-based stack views

The build is sequenced in 5 phases plus a mandatory pre-flight. Phases 2 (Sprite runtime) and 3 (Canvas UI) can run in parallel — the biggest time-saving opportunity.

**Code structure:** `bridge/` (new), `sprite/` (new), `frontend/` (modify Canvas + WS)

**Development approach:** Work with real Sprites.dev from day one. Phase 0 pre-flight validates the Sprites API, auto-restart behavior, and region latency before any code is written. No mock servers — develop against real infrastructure to catch integration issues early.

---

## Tasks

### Phase 0: Pre-flight

Must complete before writing any code. Validates Sprites.dev viability.

---

### Task: Pre-flight validation (Fly.io + Sprites.dev)

**Goal:** Validate Sprites.dev and Fly.io accounts, APIs, and critical assumptions before writing any code.
**Files:** Create `docs/ops/preflight-results.md` (findings and measurements)
**Depends on:** None

**Steps:**
1. Fly.io account setup + billing
2. Sprites.dev account + API token
3. Test Sprites APIs manually: create, exec, sleep, wake, services, TCP proxy
4. **Verify Service auto-restart on wake** (MEDIUM confidence — the spec's biggest risk)
5. Measure Sprites.dev region latency from Australia
6. If auto-restart fails: document fallback (Bridge sends exec command after every wake — adds to Phase 1 reconnection task)
7. Write up findings in `docs/ops/preflight-results.md`

**Tests:**
- [ ] `docs/ops/preflight-results.md` exists with all 5 checks documented
- [ ] Auto-restart result explicitly confirmed or denied with evidence
- [ ] Latency measurement from Australia recorded (target < 200ms)
- [ ] If auto-restart failed: fallback documented and Bridge reconnection task updated

**Gate:** All checks pass. If auto-restart fails, update Bridge reconnection task before proceeding.

---

### Phase 1: Infrastructure Scaffold

Everything depends on messages flowing Browser → Bridge → Sprite → Bridge → Browser. This phase builds that pipeline.

---

### Task: Define WebSocket message protocol

**Goal:** Establish the shared contract between Bridge, Sprite, and Frontend — all message types with TypeScript and Python definitions.
**Files:** Create `bridge/src/protocol.ts`, create `frontend/types/ws-protocol.ts`, create `sprite/src/protocol.py`
**Depends on:** None

**Steps:**
1. Define all message interfaces from spec: WebSocketMessage (base), MissionMessage, FileUploadMessage, CanvasInteraction, AuthConnect, AgentEvent, CanvasUpdate, StatusUpdate, SystemMessage
2. Include mandatory `id` (UUID), `timestamp`, optional `request_id` on every message
3. TypeScript types in `bridge/src/protocol.ts` (source of truth)
4. Copy types to `frontend/types/ws-protocol.ts`
5. Python dataclasses in `sprite/src/protocol.py` matching the same schema
6. Include message validation helpers (type guard functions)

**Tests:**
- [ ] `tsc --noEmit` passes for `bridge/src/protocol.ts` and `frontend/types/ws-protocol.ts`
- [ ] `python -c "from src.protocol import *"` succeeds in `sprite/`
- [ ] Type guard functions return `true` for valid messages, `false` for malformed
- [ ] Every message type includes `id` (UUID) and `timestamp` fields
- [ ] TypeScript and Python definitions cover identical message types

---

### Task: Create Bridge project scaffold and WS server

**Goal:** Fly.io Bridge service that accepts WebSocket connections from browsers with Clerk JWT auth.
**Files:** Create `bridge/` directory: `package.json`, `tsconfig.json`, `Dockerfile`, `fly.toml`, `src/index.ts`, `src/auth.ts`
**Depends on:** Define WebSocket message protocol

**Steps:**
1. Initialize `bridge/` with Node.js project: `ws`, `@clerk/backend`, `@supabase/supabase-js`, `uuid` deps
2. Create HTTP server that upgrades to WebSocket on `/ws/{stack_id}`
3. First message must be `type: 'auth'` with Clerk JWT — validate with `@clerk/backend` `verifyToken()`
4. Extract `user_id` from JWT, associate with connection
5. Invalid/missing token closes connection with code 4001
6. Look up stack from Supabase `stacks` table, verify user_id owns it
7. Store connection mapping: `Map<connectionId, { userId, stackId, spriteName }>`
8. Create Dockerfile and `fly.toml` for deployment (256MB RAM, shared CPU)

**Tests:**
- [ ] `npm test` passes in `bridge/`
- [ ] WS client connects to `/ws/{stack_id}` and receives upgrade
- [ ] Invalid JWT → connection closed with code 4001
- [ ] Valid JWT → connection stored in map with correct userId/stackId
- [ ] Unauthorized stack_id (wrong user) → connection closed with code 4003
- [ ] `docker build` succeeds for Bridge Dockerfile

---

### Task: Create Sprites API client and provisioning

**Goal:** Bridge can provision new Sprites from golden checkpoint and manage their lifecycle.
**Files:** Create `bridge/src/sprites-client.ts`, `bridge/src/provisioning.ts`
**Depends on:** Create Bridge project scaffold and WS server

**Steps:**
1. Create Sprites.dev REST API client: create sprite (from checkpoint), get status, start/stop service, TCP proxy, checkpoints
2. Implement lazy provisioning: when `sprite_status: 'pending'`, create Sprite from golden checkpoint
3. Update Supabase `stacks` row: `pending` → `provisioning` → `active` with `sprite_name`
4. Start Python WS service with API keys as env vars (`ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`)
5. Handle provisioning failures: mark as `failed`, allow retry on next connect
6. Handle already-active sprites: just connect

**Tests:**
- [ ] Unit tests for API client methods pass (mocked HTTP responses)
- [ ] Provisioning flow: `pending` → `provisioning` → `active` updates Supabase correctly
- [ ] Provisioning failure: status set to `failed`, retry on next connect works
- [ ] Already-active sprite: skips provisioning, connects directly
- [ ] API keys injected as env vars at Service start (verified in service config)

---

### Task: Create golden checkpoint on Sprites.dev

**Goal:** Template Sprite with Python environment, packages, and directory structure ready for cloning.
**Files:** Create `docs/ops/golden-checkpoint.md` (procedure), external Sprites.dev work
**Depends on:** None (but needs Sprites.dev account from Phase 0)

**Steps:**
1. Create base Sprite on Sprites.dev
2. Install Python packages: `websockets`, `aiosqlite`, `anthropic`, `claude-agent-sdk`, `mistralai`, `httpx`
3. Create `/workspace/` directory structure: `documents/`, `ocr/`, `artifacts/`, `memory/`, `transcripts/`
4. Initialize empty SQLite database at `/workspace/agent.db` with full schema from spec
5. Create memory file templates: `soul.md`, `user.md`, `MEMORY.md`
6. Save as golden checkpoint
7. Document the exact procedure in `docs/ops/golden-checkpoint.md`
8. Test: clone checkpoint, verify packages and dirs exist
9. **Code deployment strategy:** Document how `sprite/` source code reaches running Sprites. Sprites.dev doesn't use Docker — code is deployed via git pull or file sync. Define the update mechanism (e.g., git clone into checkpoint, or rsync on service start) and document in golden-checkpoint.md.

**Tests:**
- [ ] Clone checkpoint → `python -c "import websockets, aiosqlite, anthropic, mistralai, httpx"` succeeds
- [ ] `/workspace/` dirs exist: `documents/`, `ocr/`, `artifacts/`, `memory/`, `transcripts/`
- [ ] `/workspace/agent.db` has correct schema (all tables from spec)
- [ ] Memory templates exist: `soul.md`, `user.md`, `MEMORY.md`
- [ ] `docs/ops/golden-checkpoint.md` documents full procedure + code deployment strategy

---

### Task: Create Sprite Python WebSocket server

**Goal:** Minimal Python WebSocket server on Sprite that accepts Bridge TCP Proxy connections and routes messages.
**Files:** Create `sprite/` directory: `requirements.txt`, `src/__init__.py`, `src/server.py`, `src/gateway.py`
**Depends on:** Create golden checkpoint on Sprites.dev

**Steps:**
1. Initialize `sprite/` with Python project: `websockets`, `aiosqlite`, `anthropic`, `claude-agent-sdk`, `mistralai`, `httpx`
2. Create `src/server.py`: WebSocket server on port 8765 using `websockets` library
3. Create `src/gateway.py`: `SpriteGateway` class with `match/case` routing by message type
4. Route: `mission` (async lock), `file_upload` (concurrent), `canvas_interaction` (concurrent), `heartbeat` (async lock), `system`
5. Stub all handlers to log and echo acknowledgment
6. Wire server to gateway: incoming messages → `gateway.route(message)`

**Tests:**
- [ ] `python -m pytest sprite/tests/` passes
- [ ] WS client connects to `ws://localhost:8765` successfully
- [ ] Sending each message type (`mission`, `file_upload`, `canvas_interaction`, `heartbeat`, `system`) returns echo acknowledgment
- [ ] Unknown message type logs warning and does not crash
- [ ] Gateway routes `mission` and `heartbeat` through async lock (verified by concurrent test)

---

### Task: Bridge TCP Proxy and message forwarding

**Goal:** Bridge connects to Sprite via Sprites TCP Proxy API and forwards messages bidirectionally.
**Files:** Create `bridge/src/sprite-connection.ts`, create `bridge/src/proxy.ts`
**Depends on:** Create Sprites API client and provisioning, Create Sprite Python WebSocket server

**Steps:**
1. Establish WebSocket connection from Bridge to Sprite via `WSS /v1/sprites/{name}/proxy` with `ProxyInitMessage` targeting port 8765
2. Forward browser messages → Sprite (inject `request_id` if present)
3. Forward Sprite messages → browser
4. Handle connection lifecycle: open, close, error
5. Track active Sprite connections per stack

**Tests:**
- [ ] Message sent from browser WS arrives at Sprite WS (integration test with real Sprite)
- [ ] Message sent from Sprite WS arrives at browser WS
- [ ] `request_id` injected on forwarded messages when present
- [ ] Connection tracking correctly maps stack_id → active Sprite connection
- [ ] Connection close on either side propagates to the other

---

### Task: Bridge sleep/wake reconnection and keepalive

**Goal:** Bridge handles Sprite sleep/wake gracefully — reconnects, buffers messages, keeps Sprites awake during active sessions.
**Files:** Create `bridge/src/reconnect.ts`, create `bridge/src/keepalive.ts`, modify `bridge/src/proxy.ts`
**Depends on:** Bridge TCP Proxy and message forwarding

**Steps:**
1. Detect Sprite connection drop (WS close/error event)
2. Send `{ type: 'system', event: 'sprite_waking' }` to browser
3. Call Sprites API to trigger wake, poll status until running
4. If auto-restart doesn't work: send exec command to restart Python WS service
5. Re-establish TCP Proxy connection
6. Send `{ type: 'system', event: 'sprite_ready' }` to browser
7. Replay buffered messages (max 50 messages, 60s TTL)
8. Implement keepalive: ping Sprite every 15s during active browser sessions, stop on disconnect
9. Handle race conditions: multiple wake attempts, messages during reconnect

**Tests:**
- [ ] Simulated connection drop → `sprite_waking` system message sent to browser
- [ ] After wake → `sprite_ready` system message sent to browser
- [ ] Buffered messages (up to 50, within 60s TTL) replayed after reconnect
- [ ] Keepalive pings sent every 15s while browser connected (verified by timer mock)
- [ ] Keepalive stops when browser disconnects
- [ ] Concurrent wake attempts coalesce (no duplicate wake calls)

---

### Task: End-to-end smoke test and deployment

**Goal:** Validate the full message round-trip: Browser → Bridge → Sprite → response. Deploy Bridge to Fly.io.
**Files:** Create `bridge/tests/e2e-echo.ts` or `scripts/test-pipeline.sh`, DNS config
**Depends on:** Bridge sleep/wake reconnection and keepalive

**Steps:**
1. Write test script: connect WS to Bridge, send auth, send mission, verify echo response
2. Measure round-trip latency (target < 500ms excluding Sprite wake)
3. Test sleep/wake cycle: disconnect, wait 35s, reconnect, verify wake
4. Deploy Bridge to Fly.io
5. Configure `ws.stackdocs.io` DNS CNAME to Fly.io app
6. Test from browser against production Bridge
7. Fix any issues discovered during integration

**Tests:**
- [ ] Test script passes: connect → auth → send mission → receive echo response
- [ ] Round-trip latency < 500ms (excluding Sprite wake time)
- [ ] Sleep/wake cycle: wait 35s → reconnect → Sprite wakes → echo works
- [ ] Bridge accessible at `wss://ws.stackdocs.io` (DNS resolves, TLS works)
- [ ] Browser-based test against production Bridge succeeds

---

### Task: Supabase schema migration for v2

**Goal:** Add sprite columns to stacks table. Keep existing tables but stop writing to them.
**Files:** Create migration SQL, modify `docs/specs/SCHEMA.md`
**Depends on:** None (can run anytime in Phase 1)

**Steps:**
1. Add `sprite_name TEXT` and `sprite_status TEXT DEFAULT 'pending'` columns to `stacks` table
2. Keep all existing v1 tables (don't drop — data is there, just unused)
3. Update SCHEMA.md to document v2 platform tables (users + stacks)
4. Test that Clerk auth + existing frontend still work (v1 and v2 coexist)

**Tests:**
- [ ] `sprite_name` and `sprite_status` columns exist on `stacks` table
- [ ] `sprite_status` defaults to `'pending'` for new rows
- [ ] All v1 tables still exist (not dropped)
- [ ] Existing frontend loads without errors (v1 and v2 coexist)
- [ ] `SCHEMA.md` updated with v2 platform tables documentation

---

### Phase 2: Sprite Runtime

Adapt existing v1 agent code to run on Sprites with SQLite + WebSocket output.

**Can start after:** Phase 1 smoke test passes.
**Runs in parallel with:** Phase 3 (Canvas UI).

---

### Task: SQLite database layer

**Goal:** Async SQLite wrapper with full schema, WAL mode, and query helpers.
**Files:** Create `sprite/src/database.py`
**Depends on:** Create Sprite Python WebSocket server

**Steps:**
1. Create `Database` class wrapping `aiosqlite`
2. Initialize schema on first boot: `documents`, `ocr_results`, `extractions`, `memory_fts` tables
3. Enable WAL mode for concurrent reads
4. Provide `query()`, `execute()`, `fetchone()`, `fetchall()` async methods
5. Connection pooling (single connection for MVP, serialize writes)

**Tests:**
- [ ] `python -m pytest sprite/tests/test_database.py` passes
- [ ] Schema creates all tables on init: `documents`, `ocr_results`, `extractions`, `memory_fts`
- [ ] `PRAGMA journal_mode` returns `wal`
- [ ] CRUD operations work: insert, select, update, delete for each table
- [ ] Concurrent reads don't block (WAL mode verified)
- [ ] Database file created at expected path (`/workspace/agent.db` or test equivalent)

---

### Task: Port tool factories from Supabase to SQLite

**Goal:** All extraction agent tools work with SQLite instead of Supabase, preserving the scoped closure pattern.
**Files:** Create `sprite/src/agents/extraction_agent/` (port from `backend/app/agents/extraction_agent/`), create `sprite/src/agents/shared/`
**Depends on:** SQLite database layer

**Steps:**
1. Copy extraction agent structure: `agent.py`, `prompts.py`, `tools/` directory
2. Replace `from supabase import Client` with local `Database` import in every tool
3. Rewrite each tool's database calls: `db.table().select().eq()` → `db.query("SELECT ... WHERE ...")`
4. Port tools: `read_ocr`, `read_extraction`, `save_extraction`, `set_field`, `delete_field`, `complete`
5. Preserve `create_tools(extraction_id, document_id, user_id, db)` factory signature (change `db` type)
6. Port OCR service: `sprite/src/services/ocr.py` — Mistral OCR with env var API key, cache to `/workspace/ocr/`

**Tests:**
- [ ] Each tool (`read_ocr`, `read_extraction`, `save_extraction`, `set_field`, `delete_field`, `complete`) has unit test with SQLite
- [ ] `create_tools(extraction_id, document_id, user_id, db)` returns all tools with correct signatures
- [ ] Tools read/write SQLite correctly (verified by querying DB after tool call)
- [ ] `save_extraction` writes JSON to `extracted_fields` column
- [ ] OCR service caches text to `/workspace/ocr/{doc_id}.md` (file exists after call)
- [ ] Factory closure scoping: tools only access their scoped extraction_id/document_id

---

### Task: Agent runtime with WebSocket output

**Goal:** Claude Agent SDK runs on Sprite and streams events as WebSocket messages instead of SSE.
**Files:** Create `sprite/src/runtime.py`, modify `sprite/src/gateway.py`
**Depends on:** Port tool factories from Supabase to SQLite

**Steps:**
1. Create `AgentRuntime` class wrapping Claude Agent SDK (`ClaudeSDKClient`, `ClaudeAgentOptions`)
2. Map SDK event stream to `agent_event` WebSocket messages: `text`, `tool`, `complete`, `error`
3. Register extraction tools via MCP server with `allowed_tools` whitelist
4. Support session resume via `ClaudeAgentOptions(resume=session_id)`
5. Wire into `SpriteGateway.handle_mission()`: load memory → build system prompt → invoke agent → stream events
6. Serialize missions with async lock (one at a time)

**Tests:**
- [ ] Agent invocation streams `agent_event` messages over WS (mock WS captures text, tool, complete events)
- [ ] Event type mapping: SDK events → correct `event_type` values (`text`, `tool`, `complete`, `error`)
- [ ] `mission_lock` prevents concurrent missions (second mission waits until first completes)
- [ ] Session resume: `ClaudeAgentOptions(resume=session_id)` restores previous conversation
- [ ] Extraction tools registered and callable by agent via MCP server
- [ ] Error in agent → `agent_event` with `event_type: 'error'` sent to browser

**Note:** Pre-compaction memory flush requires the raw `anthropic` SDK — `claude-agent-sdk` does not expose compaction controls. This is explicitly post-MVP. Do not attempt to build flush in this task.

---

### Task: Canvas tools for agent

**Goal:** Agent can create/update/close windows on the user's Canvas via custom tools.
**Files:** Create `sprite/src/agents/shared/canvas_tools.py`
**Depends on:** Agent runtime with WebSocket output

**Steps:**
1. Create tool factory: `create_canvas_tools(ws_send_fn)` — scoped with WebSocket send function
2. `create_window(window_type, title, data)` → sends `canvas_update` message with `command: 'create_window'`
3. `update_window(window_id, data)` → sends `canvas_update` with `command: 'update_window'`
4. `close_window(window_id)` → sends `canvas_update` with `command: 'close_window'`
5. Register as Claude Agent SDK tools alongside extraction tools
6. Window types: `table` (columns + rows), `document` (doc_id), `notes` (markdown content)

**Tests:**
- [ ] `create_window("table", "Test", {columns, rows})` sends `canvas_update` with `command: 'create_window'` over WS
- [ ] `update_window(window_id, new_data)` sends `canvas_update` with `command: 'update_window'`
- [ ] `close_window(window_id)` sends `canvas_update` with `command: 'close_window'`
- [ ] All three tools registered alongside extraction tools in agent's tool list
- [ ] Message payloads match protocol schema (window_id, window_type, title, data fields present)

---

### Task: Basic memory system (file loading + journals)

**Goal:** Memory files load into agent system prompt at session start. Daily journals capture activity.
**Files:** Create `sprite/src/memory/` directory: `init.py`, `loader.py`, `journal.py`, `transcript.py`
**Depends on:** Agent runtime with WebSocket output

**Steps:**
1. `init.py`: On first boot, create memory templates: `soul.md`, `user.md`, `MEMORY.md` in `/workspace/memory/`
2. `loader.py`: Load soul.md + user.md + MEMORY.md + today's journal + yesterday's journal → structured system prompt section
3. `journal.py`: After each mission, append summary to `/workspace/memory/YYYY-MM-DD.md`
4. `transcript.py`: Log every tool call + agent response to `/workspace/transcripts/YYYY-MM-DDTHH-MM-SS.jsonl`
5. Create agent tools: `write_memory(file, content)`, `update_soul(content)`, `update_user_prefs(content)` in `sprite/src/agents/shared/memory_tools.py`

**Tests:**
- [ ] First boot creates `soul.md`, `user.md`, `MEMORY.md` in `/workspace/memory/` if missing
- [ ] Second boot skips creation (files already exist, not overwritten)
- [ ] Loader returns structured string containing content from all 5 sources (soul + user + MEMORY + today + yesterday)
- [ ] Journal appends to `/workspace/memory/YYYY-MM-DD.md` (correct date, append not overwrite)
- [ ] Transcript logs to `/workspace/transcripts/YYYY-MM-DDTHH-MM-SS.jsonl` with valid JSON lines
- [ ] Memory tools (`write_memory`, `update_soul`, `update_user_prefs`) write to correct files

---

### Phase 3: Canvas UI

The visual output surface. React Flow infinite canvas with agent-controlled windows.

**Can start after:** Phase 1 protocol types are defined.
**Runs in parallel with:** Phase 2 (Sprite runtime).
**Does NOT need a live Sprite** — build against mock data until integration.

---

### Task: WebSocket connection manager and store

**Goal:** Frontend connects to Bridge via WebSocket with Clerk auth, dispatches messages, and tracks connection state.
**Files:** Create `frontend/lib/websocket.ts`, create `frontend/lib/stores/ws-store.ts`
**Depends on:** Define WebSocket message protocol, Create Bridge project scaffold and WS server

**Steps:**
1. `websocket.ts`: WebSocket client connecting to `wss://ws.stackdocs.io/{stack_id}`
2. Send Clerk JWT as first message, handle auth response
3. Exponential backoff reconnection (1s, 2s, 4s, max 30s)
4. Message dispatch to registered handlers by type
5. `ws-store.ts`: Zustand store exposing `connectionStatus` (connecting, connected, sprite_waking, sprite_ready, disconnected, error), `sendMessage()`, `lastError`
6. Listen for `system` messages to update connection status
7. Integrate with Clerk `useAuth()` for JWT

**Tests:**
- [ ] `websocket.ts` connects to WS URL and sends auth message as first frame
- [ ] Reconnects with exponential backoff (1s, 2s, 4s, max 30s) on disconnect
- [ ] Message handlers dispatched by `type` field (register handler → send matching message → handler called)
- [ ] Zustand store `connectionStatus` updates on system messages (`sprite_waking` → `sprite_ready` etc.)
- [ ] `sendMessage()` serializes and sends over WS connection
- [ ] `npm run build` passes with no TypeScript errors in new files

---

### Task: React Flow canvas and base window component

**Goal:** Infinite canvas with pan/zoom/grid that renders draggable, resizable window nodes.
**Files:** Create `frontend/components/canvas/stack-canvas.tsx`, create `frontend/components/canvas/canvas-window.tsx`
**Depends on:** None (can use mock data)

**Steps:**
1. Install `@xyflow/react`
2. `stack-canvas.tsx`: React Flow wrapper with pan, zoom, grid background, snap-to-grid
3. `canvas-window.tsx`: Custom React Flow node — title bar (drag handle, title text, close button), resizable body
4. Use shadcn/ui Card for styling consistency
5. Register as custom node type in React Flow
6. Accept `window_type` prop to render different child content

**Tests:**
- [ ] `StackCanvas` renders without crash (smoke test)
- [ ] Pan, zoom, and grid background visible in rendered output
- [ ] `CanvasWindow` renders with title bar (title text, close button)
- [ ] Window is draggable (React Flow node drag)
- [ ] Window is resizable (resize handle works)
- [ ] `window_type` prop accepted — different children rendered per type
- [ ] `npm run build` passes with no TypeScript errors

---

### Task: Table window component

**Goal:** Critical-path window type for displaying extraction results on Canvas.
**Files:** Create `frontend/components/canvas/windows/table-window.tsx`
**Depends on:** React Flow canvas and base window component

**Steps:**
1. `table-window.tsx`: TanStack Table (already in project) inside canvas window. Columns and rows as props.
2. Editable cells that send `canvas_interaction` messages.
3. Reuse patterns from `stacks/stack-table-view.tsx`.

**Tests:**
- [ ] Renders columns and rows from props (column headers visible, row data in cells)
- [ ] Cell edit triggers `canvas_interaction` message with correct `window_id` and `action: 'edit_cell'`
- [ ] Empty table (no rows) renders gracefully without crash
- [ ] Large dataset (100+ rows) renders without noticeable lag
- [ ] `npm run build` passes with no TypeScript errors

---

### Task: Document and notes window components

**Goal:** Supporting window types for PDF preview and markdown notes on Canvas.
**Files:** Create `frontend/components/canvas/windows/document-window.tsx`, `notes-window.tsx`
**Depends on:** React Flow canvas and base window component

**Steps:**
1. `document-window.tsx`: PDF preview via `react-pdf` (already in project) or image via `<img>`. Page navigation for multi-page PDFs. Receives document data as props.
2. `notes-window.tsx`: Markdown display using `react-markdown` (already in project). Agent writes content, user views. Simple and lightweight.

**Tests:**
- [ ] `document-window.tsx` renders a PDF page (given test PDF data or mock)
- [ ] Document window shows page navigation for multi-page PDFs
- [ ] `notes-window.tsx` renders markdown string (headings, lists, bold render correctly)
- [ ] Both components accept props and render inside `CanvasWindow` wrapper
- [ ] `npm run build` passes with no TypeScript errors

---

### Task: Canvas Zustand store with WS integration

**Goal:** Centralized state for all canvas windows with localStorage persistence and WebSocket message handling.
**Files:** Create `frontend/lib/stores/canvas-store.ts`
**Depends on:** React Flow canvas and base window component, WebSocket connection manager and store

**Steps:**
1. Zustand store: `windows` Map (window_id → { type, title, data, position, size }), `activeWindowId`
2. Actions: `addWindow()`, `updateWindow()`, `removeWindow()`, `updatePosition()`, `updateSize()`
3. Persist to localStorage via Zustand persist middleware
4. Subscribe to `canvas_update` WebSocket messages → `create_window` calls `addWindow()`, `update_window` calls `updateWindow()`, `close_window` calls `removeWindow()`
5. User interactions (close, resize, move) update store locally + send `canvas_interaction` messages

**Tests:**
- [ ] `addWindow()` adds window to store, `removeWindow()` removes it, `updateWindow()` updates data
- [ ] Store persists to localStorage (reload → windows restored from storage)
- [ ] `canvas_update` WS message with `create_window` → `addWindow()` called, window appears in store
- [ ] `canvas_update` WS message with `update_window` → window data updated in store
- [ ] `canvas_update` WS message with `close_window` → window removed from store
- [ ] User close/resize/move → `canvas_interaction` message sent over WS

---

### Task: Subbar, chat bar, and status indicator

**Goal:** Window manager taskbar, chat input for missions, and connection status display.
**Files:** Modify `frontend/app/(app)/stacks/[id]/@subbar/page.tsx`, create `frontend/components/canvas/chat-bar.tsx`, create `frontend/components/canvas/connection-status.tsx`
**Depends on:** Canvas Zustand store with WS integration

**Steps:**
1. Subbar: Replace current tab navigation with dynamic window tabs from canvas store. Click to focus/pan, X to close. Window type icon + title.
2. Chat bar: Text input + send button at bottom of Canvas. Sends `mission` messages over WebSocket. File upload button (paperclip icon) for alternative to drag-and-drop. Adapt patterns from existing `agent-container.tsx`.
3. Connection status: "Connecting...", "Sprite waking..." (spinner), "Connected" (green dot), "Disconnected" (red dot). Read from WS store `connectionStatus`. Display in header or Canvas top-right.
4. Agent event rendering: Display `agent_event` messages in chat panel — streaming text, tool indicators, errors. Reuse existing agent card/content components.

**Tests:**
- [ ] Subbar renders one tab per open window (matches canvas store state)
- [ ] Click tab → canvas pans to focus on that window
- [ ] X on tab → window closes (removed from store)
- [ ] Chat bar sends `mission` message on submit (message captured by mock WS)
- [ ] Connection status shows correct indicator: green dot (connected), red dot (disconnected), spinner (sprite_waking)
- [ ] Agent events render in chat panel (text streams, tool calls shown, errors displayed)
- [ ] `npm run build` passes with no TypeScript errors

---

### Task: Stack page rewrite for Canvas layout

**Goal:** Replace tab-based stack detail view with Canvas + chat layout.
**Files:** Modify `frontend/app/(app)/stacks/[id]/page.tsx`, modify `frontend/components/stacks/stack-detail-client.tsx`
**Depends on:** Subbar, chat bar, and status indicator

**Steps:**
1. Replace `StackDetailClient` tabs UI with `StackCanvas` component
2. Initialize WS connection when stack page loads (via WS store)
3. Chat bar at bottom, subbar shows window tabs
4. Canvas takes full viewport minus header/subbar/chat
5. Disconnect WS when navigating away from stack page
6. Preserve existing stack list page (unchanged)

**Tests:**
- [ ] Stack detail page renders `StackCanvas` (not the old tabs UI)
- [ ] WS connection established on page load (connection status shows connecting → connected)
- [ ] WS disconnected on navigate away (verified by store status)
- [ ] Canvas fills viewport minus header/subbar/chat (no overflow, no scroll)
- [ ] Stack list page (`/stacks`) unchanged and still functional
- [ ] `npm run build` passes with no TypeScript errors

---

### Phase 4: Upload + Extraction (End-to-End)

Wire everything together into the MVP demo flow.

**Can start after:** Phase 2 and Phase 3 integration gate passes.
**Integration gate:** Can a mission message reach the Sprite agent and stream a response back to the chat UI?

---

### Task: File upload pipeline (frontend + Sprite)

**Goal:** Drag-and-drop file onto Canvas → base64 encode → WebSocket → Sprite → save to disk → SQLite record.
**Files:** Modify `frontend/components/canvas/stack-canvas.tsx` (drop handler), create `sprite/src/handlers/upload.py`
**Depends on:** Canvas Zustand store with WS integration, SpriteGateway (from Phase 2)

**Steps:**
1. Frontend: Enable drag-and-drop on Canvas. Read file as base64, send `file_upload` message. Show optimistic "processing" document window.
2. Frontend: Upload button (paperclip) in chat bar as alternative. Support PDF, PNG, JPG, JPEG. 25MB max.
3. Sprite: `handle_upload()` decodes base64, writes to `/workspace/documents/{uuid}_{filename}`
4. Sprite: Create `documents` row in SQLite with `status: 'processing'`
5. Sprite: Send `status` message back to browser
6. Sprite: Trigger OCR as background asyncio task

**Tests:**
- [ ] Drag file onto Canvas → `file_upload` message sent over WS (captured by mock)
- [ ] Paperclip button click → file picker opens, selected file sent as `file_upload`
- [ ] Files > 25MB rejected on frontend with error message
- [ ] Sprite receives upload → file written to `/workspace/documents/{uuid}_{filename}`
- [ ] SQLite `documents` row created with `status: 'processing'`
- [ ] `status` message sent back to browser with `status: 'processing'`
- [ ] Unsupported file types rejected (only PDF, PNG, JPG, JPEG accepted)

---

### Task: OCR and extraction agent integration

**Goal:** Uploaded documents get OCR'd and extracted, with results streaming to Canvas as table windows.
**Files:** Modify `sprite/src/services/ocr.py`, modify `sprite/src/handlers/upload.py`, wire `sprite/src/agents/extraction_agent/`
**Depends on:** File upload pipeline, Agent runtime with WebSocket output

**Steps:**
1. OCR: Mistral OCR API call (env var key) → cache text to `/workspace/ocr/{doc_id}.md`. Also support Claude native PDF (pass base64 directly in extraction prompt). Agent decides which method per document.
2. After OCR: Send `canvas_update` to create document window on Canvas
3. Run extraction agent: pass OCR text, agent calls tools to extract structured data
4. Agent calls `create_window` tool → table window appears on Canvas with extracted fields
5. Update SQLite: extraction record with fields, document status to `completed`
6. Update daily journal with extraction summary

**Tests:**
- [ ] OCR produces cached text at `/workspace/ocr/{doc_id}.md` (file exists, non-empty)
- [ ] Document window created on Canvas after OCR completes (canvas_update message sent)
- [ ] Extraction agent runs and creates table window with extracted fields
- [ ] SQLite `extractions` row created with `extracted_fields` JSON
- [ ] Document `status` updated to `completed` in SQLite
- [ ] Daily journal updated with extraction summary line
- [ ] Both Mistral OCR and Claude native PDF paths work (tested separately)

---

### Task: Correction flow and Canvas state awareness

**Goal:** User can correct extractions via chat. Agent receives Canvas state to know what the user sees.
**Files:** Modify `sprite/src/gateway.py`, modify `frontend/lib/stores/canvas-store.ts`
**Depends on:** OCR and extraction agent integration

**Steps:**
1. Canvas state injection: When mission is sent, include current Canvas state (open windows, active table data) in context
2. Frontend serializes Canvas state from store, sends as part of mission or at session start
3. Agent receives corrections via chat: "the vendor should be Acme Corp"
4. Agent calls `set_field` to update SQLite + `update_window` to refresh table on Canvas
5. Agent updates `soul.md` if correction reveals a pattern (prompt engineering)

**Tests:**
- [ ] Mission message includes serialized Canvas state (open windows, active table data)
- [ ] Chat "change vendor to Acme Corp" → `set_field` updates SQLite extraction record
- [ ] `update_window` message sent → table window refreshes on Canvas with corrected data
- [ ] After 3+ corrections on same field pattern → `soul.md` updated with learned rule
- [ ] Canvas state serialization includes window_id, type, title, and data for each open window

---

### Task: CSV and JSON export from table windows

**Goal:** Download extraction data as CSV or JSON directly from Canvas table windows.
**Files:** Modify `frontend/components/canvas/windows/table-window.tsx`
**Depends on:** Table window component

**Steps:**
1. Add "Export" dropdown in table window header: CSV, JSON options
2. CSV: Serialize table data (headers as first row, values as subsequent rows), trigger browser download
3. JSON: Serialize as array of objects, trigger browser download
4. No server round-trip — data is already in Canvas store

**Tests:**
- [ ] Export dropdown visible in table window header with CSV and JSON options
- [ ] CSV download contains headers as first row, values as subsequent rows
- [ ] JSON download contains array of objects (keys = column names)
- [ ] Downloaded file has correct filename (e.g., `{table_title}.csv`)
- [ ] No network request made during export (client-side only, verified by network mock)

---

### Phase 5: Memory + Polish

Complete the memory system and polish the MVP demo.

---

### Task: FTS5 memory search

**Goal:** Agent can search past memories using hybrid BM25 text search.
**Files:** Create `sprite/src/memory/index.py`, modify `sprite/src/agents/shared/memory_tools.py`
**Depends on:** Basic memory system (file loading + journals)

**Steps:**
1. Implement `memory_fts` virtual table indexing: on startup and after memory writes, chunk memory files (sliding window, ~512 tokens per chunk) and insert into FTS5
2. Provide `search_memory(query)` function returning ranked BM25 results
3. Create agent tool: `search_memories(query)` → returns relevant past context
4. BM25 only for MVP (skip vector embeddings — add post-MVP)

**Tests:**
- [ ] `memory_fts` table populated on startup (row count > 0 after indexing existing memory files)
- [ ] `search_memory("invoice")` returns relevant chunks ranked by BM25 score
- [ ] Agent tool `search_memories(query)` is callable and returns formatted results
- [ ] Re-indexes after memory writes (write to journal → new content searchable)
- [ ] Empty memory files → graceful handling (no crash, empty results)

---

### Task: Session persistence and reconnection verification

**Goal:** Verify the full persistence story: upload → extract → close browser → Sprite sleeps → reopen → everything intact.
**Files:** Integration test + `frontend/` reconnection improvements
**Depends on:** OCR and extraction agent integration

**Steps:**
1. Test full cycle: upload docs, extract data, close browser, wait for Sprite sleep (35s), reopen browser
2. Verify: Canvas loads from localStorage, agent loads memory, SQLite has all data
3. Frontend: On reconnect, load Canvas state from localStorage + request Sprite state sync if needed
4. Fix any gaps discovered during testing

**Tests:**
- [ ] Full cycle passes: upload → extract → close browser → wait 35s → reopen → Canvas loads
- [ ] Canvas state restored from localStorage (same windows, positions, data)
- [ ] Agent memory intact: `soul.md`, journals, MEMORY.md all present on Sprite after wake
- [ ] SQLite data intact: documents, extractions, OCR results all queryable after wake
- [ ] No data loss or corruption after sleep/wake cycle

---

### Task: Demo polish and error handling

**Goal:** Polish loading states, error handling, and prepare the MVP demo script.
**Files:** Various Canvas components, Bridge error handling, create `docs/demo/mvp-demo-script.md`
**Depends on:** Session persistence and reconnection verification

**Steps:**
1. Loading states: Sprite waking animation (skeleton canvas), file upload progress, extraction in-progress (shimmer rows), agent thinking (typing dots)
2. Error handling: WS disconnect mid-extraction (buffer + resume), upload failure (retry), agent error (show in chat + retry), provisioning failure (error state + retry)
3. Clerk webhook for session revocation (deferred from Phase 1): Bridge receives webhook, force-disconnects revoked sessions
4. Write demo script: login → Sprite wakes → upload 3 invoices → "extract all vendor data" → correct a field → close/reopen → CSV export

**Tests:**
- [ ] Loading states visible: skeleton canvas (Sprite waking), shimmer rows (extraction in-progress), typing dots (agent thinking)
- [ ] Upload failure → error message + retry button shown
- [ ] WS disconnect mid-session → error indicator + automatic reconnection attempt
- [ ] Agent error → error shown in chat + retry option
- [ ] Clerk webhook → Bridge force-disconnects revoked session
- [ ] `docs/demo/mvp-demo-script.md` exists with complete demo flow
- [ ] Full demo flow completes end-to-end without manual intervention (except user chat inputs)

---

## Sequence

```
Phase 0: Pre-flight (1 task)
  Pre-flight validation
  ↓ gate: all checks pass
Phase 1: Infrastructure (sequential, ~8 tasks)
  Protocol → Bridge → Sprites API → Golden checkpoint → Sprite WS → TCP Proxy → Reconnection → Smoke test
  Supabase migration (parallel, anytime)
  ↓ gate: echo test passes end-to-end
Phase 2: Sprite Runtime (sequential, ~5 tasks)     ← PARALLEL
  SQLite → Tool factories → Agent runtime → Canvas tools → Memory
Phase 3: Canvas UI (sequential, ~8 tasks)           ← PARALLEL
  WS manager → React Flow → Table window → Doc/Notes windows → Store → Subbar/Chat → Page rewrite
  ↓ gate: mission message reaches agent, response streams to chat
Phase 4: Upload + Extraction (~4 tasks)
  Upload → OCR + Extraction → Corrections → Export
Phase 5: Memory + Polish (~3 tasks)
  FTS5 search → Persistence verification → Demo polish
```

**Critical path:** Protocol → Bridge → Sprites API → Golden checkpoint → Sprite WS → TCP Proxy → SQLite → Tool factories → Agent runtime → Canvas WS integration → Upload → Extraction → Demo

**Parallel opportunity:** Phase 3 Canvas UI runs fully independent of Phase 2 Sprite runtime until integration. Saves ~1 week.

**De-risked:** Table window split from document/notes windows — table is critical path (extraction results), document/notes can follow independently.

---

## Success Criteria

- [ ] Login → Sprite wakes → Canvas loads with persisted state
- [ ] Upload 3 invoices → documents appear as Canvas windows
- [ ] Chat "extract vendor data" → table window populates live with streaming
- [ ] Chat correction → table updates in real-time
- [ ] Close browser → reopen → everything persists (Sprite memory demo)
- [ ] Export CSV from table window → download file
- [ ] soul.md contains learned extraction patterns after multiple corrections
- [ ] Daily journal captures session activity

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Sprites.dev Service auto-restart fails on wake | **HIGH** | Test in Phase 0. Fallback: Bridge exec restart after every wake. |
| Sprites.dev reliability (early 2026 community issues) | **HIGH** | Robust retry in Bridge. Manual fallback for demo. |
| Golden checkpoint creation (first time using Sprites) | **HIGH** | Spike first. Budget 1-2 sessions for experimentation. |
| Sleep/wake reconnection race conditions | **MEDIUM** | Extensive logging. Test with artificial delays. Message buffer with TTL. |
| Claude Agent SDK streaming → WebSocket mapping | **MEDIUM** | Read SDK source. Build minimal test: run agent, capture events, forward to WS. |
| Region latency from Australia | **MEDIUM** | Measure in Phase 0. If >200ms, optimistic-update on frontend. |
| React Flow performance with many windows | **LOW** | MVP uses 3-5 windows. Virtualize off-screen if needed post-MVP. |

---

## Task Count

- **Phase 0:** 1 task (pre-flight validation)
- **Phase 1:** 8 tasks (infrastructure scaffold)
- **Phase 2:** 5 tasks (Sprite runtime)
- **Phase 3:** 8 tasks (Canvas UI — table split from doc/notes)
- **Phase 4:** 4 tasks (upload + extraction)
- **Phase 5:** 3 tasks (memory + polish)
- **Total:** 29 tasks
