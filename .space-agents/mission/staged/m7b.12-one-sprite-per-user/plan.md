# Feature: One Sprite Per User (Stack Architecture Refactor)

**Goal:** Migrate from one Sprite VM per stack to one Sprite VM per user. Stacks become lightweight canvas layouts (like macOS Spaces) — all on one Sprite.

## Overview

The current architecture provisions one Sprite VM per stack. This was designed when stacks were heavyweight workspaces, but the product vision has evolved: stacks are lightweight — like browser tabs, not VMs. Users create and delete them frequently.

This refactor changes the fundamental mapping: **one Sprite per user**. The user's Sprite is their personal computer. Stacks are saved canvas layouts the user switches between. One agent, one filesystem, one database, one continuous conversation, multiple visual workspaces.

**The Sprite is the source of truth for everything.** Every stack (active + archived), every card, every document, every chat message, every extraction — it all accumulates over time. Nothing is ever destroyed. The longer you use it, the more valuable the agent becomes.

**Naming convention (use consistently everywhere):**

| Term | Meaning | Used in |
|------|---------|---------|
| **Stack** | A canvas layout containing cards. Lightweight, tab-switchable. Many per user. | UI, DB (`stacks` table), protocol (`stack_id`), stores, docs |
| **userId** | Which user → which Sprite VM. One Sprite per user. | Bridge routing, Sprite connections, auth |
| **stackId** | Which canvas layout. NOT a Sprite connection key. | Protocol messages, DB FK, frontend store |
| **Card** | A visual container on a stack (table, document, notes). | UI, DB (`cards` table), protocol, stores |
| **Canvas** | The React Flow rendering surface (technical layer). | Frontend code only — never user-facing |

**Rule:** `stackId` identifies a layout. `userId` identifies a Sprite. They never cross. Bridge routes by `userId`, protocol references `stack_id` for card placement.

**What changes:**
- Bridge re-keyed from stackId to userId for Sprite routing (Maps, auth, connections)
- Supabase: `stacks` table keeps its name, sprite columns move to `users` table, archive columns added
- Sprite: new WorkspaceDB (stacks, cards, chat_messages), state_sync on connect
- Frontend: single-page with tab switcher (no URL routing per stack), multi-stack store
- Protocol: `mission` gains `context`, `canvas_update` gains `stack_id`, new `state_sync` type

**Design decisions (defaults for open questions):**
- Free tier: 3 stacks
- Chat history: last 50 messages loaded on connect
- Card position sync: debounced on drag-end (not real-time)
- Stack + card archiving: **archive model** — nothing is ever destroyed. Closing a stack sets `status = 'archived'` with `archived_at` timestamp and cascades to all its cards. Closing an individual card archives it too. Agent can search/reference all archived stacks and cards. User can restore archived stacks (with their cards) to active. The Sprite is a persistent knowledge base that accumulates over time.
- Multiple browser tabs: both receive messages, last-write-wins for card positions

**User-initiated vs agent-initiated actions:**
- User UI actions (close tab, close card, create stack, rename) → sent as `canvas_interaction` WS messages → Sprite **gateway** handles directly as system operations (no agent involvement)
- Agent actions (create card, close card, restore old stack) → agent tools call same DB methods → sends `canvas_update` to UI
- Agent learns of user-initiated changes passively via updated `context.cards` in the next message

## Tasks

### Task: Protocol types — add stack_id, context, state_sync

**Goal:** Update shared WebSocket protocol types across all 3 codebases.
**Files:** Modify `bridge/src/protocol.ts`, `sprite/src/protocol.py`, `frontend/types/ws-protocol.ts`
**Depends on:** None

**Steps:**
1. Add `stack_id?: string` to `CanvasUpdate.payload`
2. Add `context?: { stack_id: string }` to `MissionMessage.payload`
3. Add new `StateSyncMessage` type: `{ stacks: StackInfo[], active_stack_id: string, cards: CardInfo[], chat_history: ChatMessage[] }`
4. Add `state_sync` to `MESSAGE_TYPES` and `SpriteToBrowserMessage` union
5. Add `isStateSyncMessage` type guard
6. Add `archive_card`, `archive_stack`, `create_stack`, `restore_stack` to `canvas_interaction` commands
7. Mirror all changes to Python dataclasses in `sprite/src/protocol.py`
8. Mirror all changes to frontend types in `frontend/types/ws-protocol.ts`

**Tests:**
- [ ] `isCanvasUpdate` validates messages with optional `stack_id`
- [ ] `isMissionMessage` validates messages with optional `context`
- [ ] `isStateSyncMessage` validates well-formed state_sync messages
- [ ] `isProtocolMessage` dispatches to state_sync validator
- [ ] `canvas_interaction` commands include archive/create/restore actions
- [ ] Python `is_state_sync` validates equivalent structure
- [ ] Frontend `parseMessage` handles state_sync type

### Task: Supabase schema migration (additive)

**Goal:** Move sprite_name/sprite_status to users table, add archive columns to stacks.
**Files:** Create SQL migration file
**Depends on:** None

**Steps:**
1. Add `sprite_name TEXT` and `sprite_status TEXT DEFAULT 'pending'` columns to `users` table
2. Copy sprite_name/sprite_status from existing stacks to their user rows
3. Add `status TEXT DEFAULT 'active'` and `archived_at TIMESTAMPTZ` columns to `stacks` table
4. Add `color TEXT` and `sort_order INTEGER DEFAULT 0` columns to `stacks` table
5. Remove `sprite_name` and `sprite_status` columns from `stacks` table (sprite mapping now on users)

**Tests:**
- [ ] `users` table has sprite_name and sprite_status columns
- [ ] `stacks` table has status, archived_at, color, sort_order columns
- [ ] `stacks` table no longer has sprite_name or sprite_status
- [ ] Existing user data preserved with correct sprite mapping
- [ ] Existing stacks preserved with status='active'

### Task: Bridge core re-key (auth + index + connection store)

**Goal:** Replace stackId with userId in auth, WebSocket route, and connection store. stackId no longer used for Sprite routing.
**Files:** Modify `bridge/src/auth.ts`, `bridge/src/index.ts`, `bridge/src/connection-store.ts` + their tests
**Depends on:** Protocol types, Supabase schema

**Steps:**
1. `auth.ts`: Remove `stackId` from `authenticateConnection` params, query `users` table for `sprite_name`/`sprite_status`, rename `lookupStack` to `lookupUser`, update `AuthResult` type (userId, spriteName, spriteStatus — no stackId)
2. `index.ts`: Change WS route from `/ws/{stack_id}` to `/ws`, remove stackId extraction from URL, `handleConnection` no longer receives stackId, auth flow uses single-arg `authenticateConnection(token)`
3. `connection-store.ts`: Remove `stackId` from `Connection` interface, rename `getConnectionsByStack` to `getConnectionsByUser`, simplify pending auth entries (no stackId)
4. Update tests in `auth.test.ts` and `server.test.ts` alongside source changes

**Tests:**
- [ ] `authenticateConnection(token)` returns `AuthResult` with userId, no stackId
- [ ] Auth queries `users` table (not stacks) for sprite mapping
- [ ] WS upgrade on `/ws` succeeds
- [ ] WS upgrade on `/ws/{anything}` returns 400
- [ ] `getConnectionsByUser(userId)` returns correct connections
- [ ] Health endpoint still works

### Task: Bridge proxy re-key

**Goal:** Re-key spriteConnections Map and all proxy functions from stackId to userId.
**Files:** Modify `bridge/src/proxy.ts` + `bridge/tests/proxy.test.ts`
**Depends on:** Bridge core re-key

**Steps:**
1. Re-key `spriteConnections` Map from stackId to userId
2. Rename all function params: `ensureSpriteConnection(userId, ...)`, `forwardToSprite(userId, ...)`, `disconnectSprite(userId)`, `broadcastToBrowsers(userId, ...)`
3. Update `import { getConnectionsByStack }` to `import { getConnectionsByUser }`
4. Update `createAndRegister` internal function and `onClose` callback
5. Update proxy tests

**Tests:**
- [ ] `ensureSpriteConnection(userId, ...)` creates and caches connection
- [ ] `forwardToSprite(userId, msg)` routes to correct Sprite
- [ ] `disconnectSprite(userId)` cleans up connection + keepalive
- [ ] `broadcastToBrowsers(userId, data)` sends to all browser connections for that user

### Task: Bridge reconnect + keepalive re-key

**Goal:** Mechanical rename of stackId to userId in reconnect and keepalive modules.
**Files:** Modify `bridge/src/reconnect.ts`, `bridge/src/keepalive.ts` + their tests
**Depends on:** Bridge proxy re-key

**Steps:**
1. `reconnect.ts`: Rename all `stackId` params to `userId`, re-key `reconnectStates` Map
2. `keepalive.ts`: Rename all `stackId` params to `userId`, re-key `timers` Map
3. Update import of `getConnectionsByStack` to `getConnectionsByUser`
4. Update tests (mechanical rename of test data strings)

**Tests:**
- [ ] `handleDisconnect(userId, deps)` tracks reconnect state by userId
- [ ] `isReconnecting(userId)` returns correct state
- [ ] `bufferMessage(userId, data)` buffers during reconnect
- [ ] `startKeepalive(userId)` / `stopKeepalive(userId)` manage timers

### Task: Bridge provisioning per-user

**Goal:** Sprite provisioning creates/manages Sprites per user, status updates go to users table.
**Files:** Modify `bridge/src/provisioning.ts` + `bridge/tests/provisioning.test.ts`
**Depends on:** Supabase schema, Bridge core re-key

**Steps:**
1. `provisionSprite(userId)` takes userId instead of stackId
2. `generateSpriteName(userId)` generates name from user ID
3. `updateSpriteStatus` writes to `users` table (not stacks): `.from('users').update({...}).eq('id', userId)`
4. `ensureSpriteProvisioned(userId, ...)` works with userId
5. Update provisioning tests

**Tests:**
- [ ] `provisionSprite(userId)` creates Sprite with user-derived name
- [ ] `updateSpriteStatus` writes to `users` table
- [ ] `ensureSpriteProvisioned` re-provisions if Sprite not found
- [ ] Status transitions: pending -> provisioning -> active

### Task: Bridge test verification pass

**Goal:** Ensure all existing Bridge tests pass with the refactored architecture.
**Files:** All 11 files in `bridge/tests/`
**Depends on:** All Bridge tasks above

**Steps:**
1. Run `npx vitest run` — fix any remaining failures
2. Check `e2e-echo.test.ts` (likely has `/ws/{stack_id}` in URL)
3. Check `bootstrap.test.ts`, `sprites-client.test.ts`, `updater.test.ts`, `api-proxy.test.ts` for any stackId-as-routing-key references
4. Verify no stackId-as-routing-key references remain (stackId in protocol payloads is fine — it means "which stack layout")

**Tests:**
- [ ] `npx vitest run` — 0 failures
- [ ] No stackId used as Sprite connection key in source files
- [ ] No `getConnectionsByStack` imports remain
- [ ] stackId only appears in protocol message payload context (not routing)

### Task: Sprite WorkspaceDB

**Goal:** Create SQLite database layer with stacks, cards, and chat_messages tables.
**Files:** Create/modify `sprite/src/database.py`, create `sprite/tests/test_database.py`
**Depends on:** Protocol types

**Steps:**
1. Create `WorkspaceDB` class with `init()`, `close()` methods
2. Schema: `stacks (id, name, color, sort_order, status DEFAULT 'active', archived_at, created_at)`, `cards (card_id, stack_id, title, blocks JSON, size, status DEFAULT 'active', archived_at, updated_at)`, `chat_messages (id autoincrement, role, content, timestamp)`
3. Implement CRUD: `create_stack`, `list_stacks` (active only), `list_all_stacks` (includes archived), `archive_stack` (cascade to cards), `restore_stack` (cascade restore cards), `rename_stack`, `upsert_card`, `archive_card`, `restore_card`, `get_cards_by_stack` (active only), `get_all_cards` (includes archived), `add_chat_message`, `get_chat_history`
4. Use `aiosqlite` for async access, JSON serialization for blocks column
5. Default path: `/workspace/.os/workspace.db`

**Tests:**
- [ ] `init()` creates all 3 tables with status/archived_at columns
- [ ] `create_stack` returns stack with status='active'
- [ ] `list_stacks` returns only active stacks, ordered by sort_order
- [ ] `list_all_stacks` returns active + archived
- [ ] `archive_stack` sets status='archived' and cascades to all its cards
- [ ] `restore_stack` sets status='active' and restores its cards
- [ ] `upsert_card` creates and updates cards with status='active'
- [ ] `archive_card` sets status='archived' with archived_at timestamp
- [ ] `get_cards_by_stack` returns only active cards
- [ ] `get_all_cards` returns active + archived (for agent search)
- [ ] `add_chat_message` persists with timestamp
- [ ] `get_chat_history(limit)` returns recent messages in order

### Task: Sprite state sync

**Goal:** Send state_sync message to browser on new WebSocket connection.
**Files:** Create `sprite/src/state_sync.py`, modify `sprite/src/gateway.py` or `sprite/src/server.py`
**Depends on:** Protocol types, Sprite WorkspaceDB

**Steps:**
1. Create `build_state_sync_message(db, active_stack_id)` function
2. Query all active stacks, all active cards, last 50 chat messages from WorkspaceDB
3. Build state_sync message matching protocol type
4. If no stacks exist (first connection), create a default stack ("My Stack")
5. Send state_sync as first message after TCP connection established
6. `active_stack_id` defaults to first stack (no last-used tracking in MVP)

**Tests:**
- [ ] New connection receives state_sync as first message
- [ ] state_sync contains all active stacks from DB
- [ ] state_sync contains all active cards grouped by stack_id
- [ ] state_sync contains up to 50 recent chat messages
- [ ] Empty DB creates default stack and sends it in state_sync
- [ ] Message validates against `is_state_sync` type guard

### Task: Sprite canvas tools + DB persistence

**Goal:** Add stack_id to canvas tool output, persist card changes to WorkspaceDB.
**Files:** Modify `sprite/src/agents/shared/canvas_tools.py`, `sprite/src/runtime.py`
**Depends on:** Protocol types, Sprite WorkspaceDB

**Steps:**
1. `create_canvas_tools` factory accepts `workspace_db` and `stack_id` (from mission context) as closure params
2. `create_card` tool includes `stack_id` in canvas_update payload
3. `create_card` persists to `db.upsert_card(stack_id, card_id, title, blocks, size)`
4. `update_card` persists block/title changes to DB
5. `close_card` tool calls `db.archive_card(card_id)` (archives, not deletes) — for agent-initiated closes
6. `runtime.py` passes workspace_db and current stack_id when creating canvas tools
7. Note: user-initiated card/stack archives are handled by the gateway directly (system operation, no agent involvement). Agent learns of changes via updated `context.cards` in the next message.

**Tests:**
- [ ] `create_card` sends canvas_update with `stack_id`
- [ ] `create_card` persists card to WorkspaceDB
- [ ] `update_card` persists changes to WorkspaceDB
- [ ] `close_card` archives card (status='archived', not deleted)
- [ ] stack_id comes from mission context closure
- [ ] Gateway handles user-initiated `canvas_interaction` archive commands directly (no agent): `archive_card`, `archive_stack`, `create_stack`, `restore_stack`
- [ ] Agent-initiated vs user-initiated archives both call same DB methods

### Task: Sprite chat persistence

**Goal:** Store user messages and agent responses in chat_messages table.
**Files:** Modify `sprite/src/gateway.py`, `sprite/src/runtime.py`
**Depends on:** Sprite WorkspaceDB

**Steps:**
1. On `mission` message received: `await db.add_chat_message("user", payload.text)`
2. During agent response: accumulate text from streaming `agent_event` chunks
3. On `complete` event: `await db.add_chat_message("agent", accumulated_text)`
4. WorkspaceDB instance flows from server → gateway → runtime

**Tests:**
- [ ] User messages saved with role='user'
- [ ] Agent responses saved with role='agent' (full accumulated text)
- [ ] Messages queryable by timestamp for state_sync
- [ ] Streaming chunks are accumulated, not stored individually

### Task: Frontend WS + routing (remove stackId from routing)

**Goal:** Remove stackId from WebSocket connection URL and page routing. Single page, no stack in URL.
**Files:** Modify `frontend/lib/websocket.ts`, `frontend/components/desktop/ws-provider.tsx`, create `frontend/app/(desktop)/page.tsx`, remove/archive `frontend/app/(desktop)/stacks/[id]/page.tsx`
**Depends on:** Protocol types, Bridge core re-key

**Steps:**
1. `websocket.ts`: Remove `stackId` from options, connect URL becomes `/ws` (no path param)
2. `ws-provider.tsx`: Remove `stackId` prop, wrap at app layout level
3. Create `(desktop)/page.tsx` — same content as `stacks/[id]/page.tsx` but without `use(params)` for stackId, uses `useCardsForActiveStack()` selector
4. `WebSocketProvider` renders without stackId prop
5. Update landing page redirect to new route
6. Update Clerk middleware to protect new route

**Tests:**
- [ ] WebSocketManager connects to `/ws` (no stack ID in URL)
- [ ] WebSocketProvider has no stackId prop
- [ ] New route renders the glass desktop
- [ ] Cards render from store filtered by activeStackId

### Task: Frontend stack store (multi-stack)

**Goal:** Refactor store to manage multiple stacks with card filtering.
**Files:** Modify `frontend/lib/stores/desktop-store.ts`
**Depends on:** Protocol types

**Steps:**
1. Add `StackInfo` type: `{ id: string, name: string, color?: string }`
2. Add `stacks: StackInfo[]` to state
3. Add `stackId: string` to card interface
4. Rename `activeWorkspace` to `activeStackId`
5. Add actions: `setStacks`, `addStack`, `archiveStack` (hides from tab bar + archives cards), `restoreStack`, `renameStack`
6. Create `useCardsForActiveStack()` selector that filters cards by `activeStackId`
7. Bump persist version, add migration for stale localStorage (default `stackId` to 'default')

**Tests:**
- [ ] `setStacks` replaces stacks array
- [ ] `addStack` adds to array
- [ ] `archiveStack` hides stack from tab bar and archives its cards
- [ ] Card interface has `stackId` field
- [ ] `useCardsForActiveStack` filters correctly
- [ ] Persist migration handles old data without stackId

### Task: Frontend state sync handler

**Goal:** Process state_sync message on WS connect, populate stack and chat stores.
**Files:** Modify `frontend/components/desktop/ws-provider.tsx`
**Depends on:** Protocol types, Frontend WS + routing, Frontend stack store

**Steps:**
1. Add `state_sync` case to `handleMessage` switch
2. Populate stack store: `setStacks(stacks)`, `setActiveStackId(active_stack_id)`
3. Populate cards: iterate cards array, call `addCard` with `stackId` from each card
4. Populate chat store: clear existing, add each message from `chat_history`
5. Persist to localStorage via Zustand persist (automatic)

**Tests:**
- [ ] state_sync populates stacks in store
- [ ] state_sync populates cards with correct stackIds
- [ ] state_sync populates chat history
- [ ] Subsequent state_sync (reconnect) replaces stale state
- [ ] Empty state_sync (no cards/messages) doesn't crash

### Task: Frontend message context (ChatBar + canvas_update handler)

**Goal:** ChatBar sends stack context with every mission; canvas_update handler routes by stack_id.
**Files:** Modify `frontend/components/desktop/chat-bar.tsx`, `frontend/components/desktop/ws-provider.tsx`
**Depends on:** Protocol types, Frontend WS + routing, Frontend stack store

**Steps:**
1. ChatBar: Read `activeStackId` from store, include `context: { stack_id: activeStackId }` in mission payload
2. ws-provider canvas_update handler: Read `stack_id` from `canvas_update.payload`, set `stackId` on card. Default to `activeStackId` if missing
3. `create_card` with `stack_id` stores card with correct stackId
4. `update_card` preserves existing stackId
5. `close_card` removes card regardless of stack

**Tests:**
- [ ] Mission messages include `context.stack_id`
- [ ] Context reflects current active stack
- [ ] `create_card` with `stack_id` sets correct `stackId` on card
- [ ] `create_card` without `stack_id` defaults to activeStackId
- [ ] Cards on inactive stacks are created but not visible

### Task: Frontend top bar wiring

**Goal:** Wire tab switcher to real stacks from store with CRUD actions.
**Files:** Modify `frontend/components/desktop/desktop-top-bar.tsx`
**Depends on:** Frontend stack store

**Steps:**
1. Read `stacks` array from store (replace hardcoded tabs)
2. Build tabs from `stacks.map(s => ({ value: s.id, label: s.name, dot: s.color }))`
3. `onValueChange` calls `setActiveStackId`
4. Plus button sends `canvas_interaction: create_stack` to Sprite via WS
5. Close button sends `canvas_interaction: archive_stack` to Sprite via WS (cascades to cards)
6. Handle empty stacks state (loading before state_sync)

**Tests:**
- [ ] Tabs render from stacks in store (not hardcoded)
- [ ] Active tab follows activeStackId
- [ ] Tab click switches activeStackId
- [ ] Plus button creates new stack (via WS → Sprite gateway)
- [ ] Close button archives stack (via WS → Sprite gateway, not delete)
- [ ] Empty state shows loading indicator

### Task: Integration E2E test

**Goal:** Validate the complete refactored flow across all layers.
**Files:** Create `bridge/tests/e2e-user-sprite.test.ts`
**Depends on:** All previous tasks

**Steps:**
1. Browser connects to `/ws` (no stack ID in URL)
2. Authenticates with Clerk JWT
3. Bridge looks up user in `users` table (not stacks) for sprite mapping
4. Bridge connects to user's Sprite via userId
5. Sprite sends `state_sync` with stacks/cards/chat
6. User sends mission with `context.stack_id`
7. Agent creates card with `stack_id`
8. `canvas_update` with `stack_id` reaches browser
9. Test multiple browser tabs sharing one Sprite connection

**Tests:**
- [ ] WS connection to `/ws` succeeds and authenticates
- [ ] state_sync received after Sprite connects
- [ ] Mission with context.stack_id reaches Sprite gateway
- [ ] canvas_update with stack_id broadcasts to all browser connections
- [ ] Multiple tabs share one Sprite TCP connection
- [ ] Card lands on correct stack

## Sequence

1. Protocol types (no dependencies)
2. Supabase schema (no dependencies, parallel with 1)
3. Bridge core re-key (depends on 1, 2)
4. Bridge proxy re-key (depends on 3)
5. Bridge reconnect + keepalive re-key (depends on 4)
6. Bridge provisioning per-user (depends on 2, 3)
7. Bridge test verification pass (depends on 3, 4, 5, 6)
8. Sprite WorkspaceDB (depends on 1)
9. Sprite state sync (depends on 1, 8)
10. Sprite canvas tools + DB persistence (depends on 1, 8 — parallel with 9)
11. Sprite chat persistence (depends on 8 — parallel with 9, 10)
12. Frontend WS + routing (depends on 1, 3)
13. Frontend stack store (depends on 1 — parallel with 12)
14. Frontend state sync handler (depends on 12, 13)
15. Frontend message context (depends on 12, 13)
16. Frontend top bar wiring (depends on 13)
17. Integration E2E test (depends on all)

**Parallelization:** Phase 3 (Sprite) can start after task 1. Phase 4 (Frontend) can start after tasks 1+3. In practice, execute linearly per phase to avoid context-switching.

**Critical path:** 1 → 3 → 4 → 5 → 7 → 8 → 9 → 12 → 13 → 14 → 17 (11 tasks)

## Success Criteria

- [ ] Single Sprite VM per user, provisioned on first WS connection
- [ ] One WebSocket connection per user session, routed by userId
- [ ] Stack tabs work as tab switcher (create, rename, archive/restore)
- [ ] Agent receives stack context (active stack + card summaries) with every message
- [ ] Agent can create/update/archive cards on any stack via canvas_update with stack_id
- [ ] Archived stacks and cards preserved forever, searchable by agent
- [ ] Card state persists across page refreshes (localStorage cache + Sprite DB sync)
- [ ] Chat history loads from Sprite on connect via state_sync
- [ ] state_sync delivers full stack + card + chat state on WS connect
- [ ] User UI actions (close tab, close card, create stack) handled by gateway directly
- [ ] Bridge routes by userId, manages one TCP Proxy per user
- [ ] All Bridge tests pass (0 failures)
- [ ] No stackId-as-routing-key in Bridge source (stackId only in protocol payloads)
- [ ] Consistent naming: "stack" everywhere (not desktop/workspace/canvas)
