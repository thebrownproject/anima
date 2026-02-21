# Feature: Connection Stability and Codebase Cleanup

**Goal:** Fix every known connection bug, harden error handling, clean dead code, and add minimum UX for users to understand connection state, making the platform reliable before any further v2 feature work.

## Overview

Session 191 audited all three codebases (frontend, bridge, sprite) with 12 internal agents and 3 external reviews. The result: 86 requirements across 8 tracks documented in `spec.md`.

The core problem: **every single reconnection event silently breaks message delivery.** Three critical bugs in the Bridge reconnect pipeline (registration gap, register-before-verify, zombie socket leak) mean that after any Sprite sleep/wake cycle, all messages are silently dropped. On top of this: no user-facing connection feedback, failing tests, dead code, and missing error handling.

This plan organizes the 86 requirements into 15 executable tasks across 5 waves. Tasks within each wave can run in parallel. An integration checkpoint after Wave 2 validates the critical connection pipeline before building on top of it.

**Estimated effort:** ~35-42h solo, ~20h with parallel orchestrated agents.

**Spec traceability:** T8.19 and T8.20 from the spec are promoted to T2.10 and T2.11 respectively (platform-critical, moved from Track 8 to Track 2). All other spec IDs map 1:1. T8.2 explicitly keeps `useCardsForActiveStack` because T4.8 wires it up (not dead code).

## Tasks

### Task: Bridge Critical Connection Pipeline

**Goal:** Fix the three bugs that cause silent message loss on every reconnection, plus partial-line buffering and timeout fix.
**Priority:** P1
**Size:** L
**Files:** Modify `bridge/src/proxy.ts`, `bridge/src/reconnect.ts`, `bridge/src/sprite-connection.ts`, `bridge/src/provisioning.ts`. Test `bridge/tests/proxy.test.ts`, `bridge/tests/reconnect.test.ts`, create `bridge/tests/sprite-connection.test.ts`, test `bridge/tests/provisioning.test.ts`.
**Depends on:** None

**Steps:**
1. T1.1: Fix reconnect registration gap. After Sprite TCP reconnect, `reconnect.ts` stores the new `SpriteConnection` in local state but never writes it back to the `spriteConnections` Map in `proxy.ts`. Add a `registerConnection` callback to `ReconnectDeps` and call it after verify succeeds. Update `proxy.ts` to pass the callback when calling `handleDisconnect`.
2. T1.2: Fix socket registration before verify. `createAndRegister` in `proxy.ts` adds connection to Map immediately after TCP connect, before `verify()` runs. Move registration out of `createAndRegister` and into the caller, after connect succeeds.
3. T1.3: Fix zombie socket leak. In `sprite-connection.ts`, the `error` handler after `initDone=true` calls `onError` but never calls `this.close()`. Socket stays in Map but is dead, no close event fires, no reconnect triggers. Add `this.close()` in the post-init error path.
4. T1.4: Add partial-line buffering. TCP Proxy sends newline-delimited JSON. Frame splitting can produce truncated JSON. Add a `_lineBuffer` field to `SpriteConnection`. Accumulate data, split on newline, keep incomplete last segment as carry-over.
5. T1.6: Fix `startSpriteServer` timeout to reject. In `provisioning.ts`, the 3s timeout path calls `resolve()` even if the exec WS never opened. Change to `reject(new Error(...))`.

**Tests:**
- [ ] After Sprite TCP reconnect, `getSpriteConnection(userId)` returns the new connection
- [ ] Messages sent after reconnect go through the new connection, not the buffer
- [ ] Connection is NOT added to `spriteConnections` until after `connect()` succeeds; verify both verify-success and verify-failure transitions
- [ ] Post-init error handler calls `close()` so zombie sockets are cleaned up and reconnect triggers
- [ ] Partial JSON split across TCP frames is reassembled correctly (tested with split payloads)
- [ ] Multiple complete messages in one frame are all delivered
- [ ] `startSpriteServer` timeout path rejects (not resolves)
- [ ] All existing Bridge tests pass

### Task: Sprite Ping/Pong, Protocol Types, and Validation

**Goal:** Make Sprite respond to ping with pong (fixes Bridge verification loop), register all undocumented message types, align protocol types, and add Python context validation.
**Priority:** P1
**Size:** M
**Files:** Modify `sprite/src/gateway.py`, `sprite/src/protocol.py`, `bridge/src/protocol.ts`, `bridge/src/keepalive.ts`, `frontend/types/ws-protocol.ts`. Test `sprite/tests/test_gateway_ping.py` (create), test `sprite/tests/test_protocol.py`, test `bridge/tests/keepalive.test.ts`.
**Depends on:** Bridge Critical Connection Pipeline

**Steps:**
1. T1.5: Add ping/pong response to Sprite gateway. When `type == "ping"`, construct a pong response with matching `id` and current `timestamp`, send it back. Currently the ping is silently dropped, causing Bridge's `defaultVerifyServer` to always fail.
2. T5.1: Add `ping`, `pong`, `heartbeat`, `state_sync_request` to `MESSAGE_TYPES` in `bridge/src/protocol.ts`, `sprite/src/protocol.py`, and `frontend/types/ws-protocol.ts`. Also update the `MessageType` Literal in Python.
3. T5.2: Add mandatory `id` field (UUID) to keepalive ping messages in `keepalive.ts`. Currently missing the required field from `WebSocketMessageBase`.
4. T5.4: Replace hand-rolled `AgentEventMeta` camelCase conversion in `protocol.py` with systematic snake_case-to-camelCase conversion. The current approach silently breaks if new fields are added.
5. T5.5: Align `preview_rows` type between TypeScript (`unknown[][]`) and Python (`list[list[str]]`). Unify to `list[list[Any]]` in Python.
6. T5.3: Add `context` structure validation in Python `is_mission_message` to match TypeScript strictness. Validate that `context.stack_id` is present and is a string.

**Tests:**
- [ ] Sprite receives `ping` and responds with `pong` containing matching id and timestamp
- [ ] Bridge `defaultVerifyServer` succeeds without triggering unnecessary server restart
- [ ] `ping`, `pong`, `heartbeat`, `state_sync_request` are in `MESSAGE_TYPES` in both TS and Python
- [ ] Keepalive ping includes mandatory `id` field (UUID)
- [ ] `AgentEventMeta` systematic camelCase conversion handles all fields (not just hardcoded two)
- [ ] `preview_rows` type matches between TS and Python
- [ ] Malformed `context` dict in mission messages is rejected (matches TypeScript validation)

### Task: Bridge Platform Crash Fixes (API Proxy)

**Goal:** Fix two critical bugs that can crash the entire Bridge process, affecting all users.
**Priority:** P1
**Size:** M
**Files:** Modify `bridge/src/api-proxy.ts`. Test `bridge/tests/api-proxy.test.ts`.
**Depends on:** None

**Steps:**
1. T2.10: Add streaming body size limit to `collectBody`. Count bytes during `req.on('data')`, abort request if over 10MB. Return 413 to caller. Do NOT collect-then-check (defeats the purpose on 256MB machine).
2. T2.11: Guard against `string[]` header values. `req.headers['x-api-key']` can be an array if duplicate headers exist. `Buffer.byteLength()` on an array throws synchronous TypeError inside async handler, causing unhandled rejection that crashes the process. Use `Array.isArray()` check, take first element.
3. T8.18: Move `node:crypto` from dynamic `await import()` (runs on every request) to static import at file top.

**Tests:**
- [ ] Body collection rejects payloads over 10MB with 413 status
- [ ] Duplicate HTTP headers (`string[]` values) handled gracefully without TypeError
- [ ] `node:crypto` is a static import (not dynamic per-request)
- [ ] All existing API proxy tests pass

### Task: Bridge Auth and Provisioning Hardening

**Goal:** Fix auth flow so first-time users get a working Sprite, add defensive error handling.
**Priority:** P1
**Size:** L
**Files:** Modify `bridge/src/index.ts`, `bridge/src/auth.ts`, `bridge/src/provisioning.ts`. Test `bridge/tests/server.test.ts`, `bridge/tests/auth.test.ts`.
**Depends on:** Bridge Critical Connection Pipeline

**Steps:**
1. T2.1: Wire `ensureSpriteProvisioned` into auth flow. When `spriteName` is null or `spriteStatus` is failed/pending, call provisioning. Currently new users authenticate but get no Sprite (skipped silently).
2. T2.2: Add `validateEnv()` function. Check all required env vars (`CLERK_SECRET_KEY` or `CLERK_JWT_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SPRITES_TOKEN`) before `server.listen()`. Fail fast with clear error. Also increase auth timeout from 10s to 30s per spec decision.
3. T2.3: Send explicit error to browser when `SPRITES_TOKEN` is undefined. Currently silently skipped, browser gets `connected` but never `sprite_ready`.
4. T2.4: Differentiate auth errors from infra errors in `auth.ts`. Catch blocks currently swallow all exceptions identically. Return WS close code `4001` for auth failures, `1011` (standard "unexpected condition") for infrastructure failures. Log actual error with context.
5. T2.5: Check `ws.readyState !== WebSocket.OPEN` after async `authenticateConnection` returns. Prevents zombie entry when auth timeout fires during in-flight auth. Auth timeout is 30s (spec decision).
6. T2.6: Add `process.on('unhandledRejection')` handler to `index.ts`. Currently async errors in WS handlers disappear.
7. T2.7: Wrap entire `ws.on('message')` async callback body in try/catch. Send error message to browser on unexpected failures.

**Tests:**
- [ ] New user with no Sprite assigned triggers provisioning and gets a working connection
- [ ] User with `spriteStatus` of `failed` or `pending` triggers re-provisioning
- [ ] Missing required env vars cause fast failure at startup with clear error message
- [ ] Missing SPRITES_TOKEN sends explicit error to browser (not silent skip)
- [ ] Auth errors return WS close code `4001`; infra errors return `1011`
- [ ] Auth timeout is 30s (not 10s)
- [ ] Auth timeout race does not register connection on dead socket
- [ ] `process.on('unhandledRejection')` handler is registered
- [ ] Async WS message handler errors are caught (not unhandled rejections)

### Task: Bridge Build and Dockerfile Fixes

**Goal:** Fix Dockerfile determinism and sprite file access for production builds.
**Priority:** P1
**Size:** S
**Files:** Modify `bridge/Dockerfile`. Possibly modify `bridge/src/bootstrap.ts`.
**Depends on:** None

**Steps:**
1. T2.8: Fix Dockerfile sprite file access. Investigate whether `bootstrap.ts` reads from `../../sprite/` (local filesystem) or uses FS API. If local reads, refactor to FS API exclusively.
2. T2.9: Add `package-lock.json` to Dockerfile COPY, change `npm install` to `npm ci --omit=dev` for deterministic builds.

**Tests:**
- [ ] `docker build` succeeds from clean state
- [ ] `docker run` passes health check
- [ ] Dockerfile uses `npm ci --omit=dev` with lockfile
- [ ] Sprite source file access from container works (FS API or COPY)

### Task: Frontend Connection Status and Message Queue

**Goal:** Add visible connection status indicator, build outgoing message queue, fix optimistic send, handle terminal errors.
**Priority:** P2
**Size:** L
**Files:** Modify `frontend/lib/websocket.ts`, `frontend/components/desktop/chat-bar.tsx`, create status indicator component. Test unit tests for WebSocketManager queue.
**Depends on:** Bridge Critical Connection Pipeline, Sprite Ping/Pong and Protocol Types

**Steps:**
1. T3.1: Add connection status indicator component. Subscribe to `WebSocketManager.status` (6 states exist). Suppress transient disconnects <5s with delayed transition. Show pill/indicator for longer outages.
2. T3.2: Build in-memory message queue in `WebSocketManager`. Bounded at 100 messages, 60s TTL. `send()` returns `'sent' | 'queued' | 'dropped'`. Queue flushes on `sprite_ready` (not `connected`). Two separate buffers exist (frontend queue for browser-to-Bridge, Bridge buffer for Bridge-to-Sprite). Document this in code comments.
3. T3.3: Fix chat-bar optimistic send. Check `send()` return value before adding message to local store. Show pending state if queued, error if dropped.
4. T3.4: Handle `reconnect_failed` system event. Transition to error status with retry guidance.
5. T3.5: Handle auth rejection (close code 4001) as terminal. Do NOT reconnect. Show auth error.
6. T3.9: Add Sprite cold-start feedback. `sprite_waking` status exists but no UI renders it. Show "Connecting to your workspace..." during 1-12s cold start.
7. T3.10: Fix `authenticate()` fire-and-forget. Wrap `getToken()` in catch, set error status, close socket on failure.
8. T3.7 (partial): Wire up send-failure Sonner toasts using `send()` return value. Show toast when message is dropped.

**Tests:**
- [ ] Connection status indicator visible during connecting, authenticating, sprite_waking, error states
- [ ] Transient disconnects under 5 seconds show no indicator flicker
- [ ] Longer outages (>5s) show visible reconnecting indicator
- [ ] Messages sent while disconnected are queued (up to 100, max 60s age)
- [ ] Messages sent during `sprite_waking` state are queued until `sprite_ready`
- [ ] `send()` returns `'sent'`, `'queued'`, or `'dropped'`
- [ ] Queue flushes on `sprite_ready` event
- [ ] Rapid reconnect churn does not cause duplicate message delivery or queue corruption
- [ ] Queue TTL expiration evicts old messages; max-queue eviction drops oldest first
- [ ] Chat-bar checks `send()` result before adding optimistic message
- [ ] Send-failure toast shown when message is dropped
- [ ] Auth rejection (4001) transitions to terminal error state, no reconnect loop
- [ ] `reconnect_failed` transitions to error state with retry guidance
- [ ] Sprite cold-start shows "Connecting to your workspace..." indicator
- [ ] `getToken()` failure is caught and sets error status

### Task: Frontend Error Feedback and Boundaries

**Goal:** Add error boundary, wire up Sonner toasts for connection and upload errors, fix invisible error messages.
**Priority:** P2
**Size:** S
**Files:** Create `frontend/app/(desktop)/desktop/error.tsx`. Modify `frontend/components/desktop/chat-panel.tsx`.
**Depends on:** None

**Steps:**
1. T3.6: Create `error.tsx` in desktop route (Next.js App Router convention). Export default component receiving `{ error, reset }` props. Show recovery UI instead of white screen on React crash.
2. T3.7 (partial): Wire up Sonner toasts for connection errors and file upload errors. Import `toast` from sonner (already installed). NOTE: send-failure toasts depend on queue `send()` return value from Task 5 (T3.2); those toasts are deferred to that task.
3. T3.8: Fix system error message visibility in `chat-panel.tsx`. Change `text-[11px] text-white/25` to clearly visible styling (e.g., `text-sm text-red-400`).

**Tests:**
- [ ] `error.tsx` exists in desktop route; React crash shows recovery UI instead of white screen
- [ ] Connection errors and file upload errors trigger visible Sonner toasts
- [ ] System error messages in chat panel are clearly visible (not 11px white/25%)

### Task: Frontend State Reconciliation

**Goal:** Fix all state_sync correctness issues after reconnect.
**Priority:** P2
**Size:** L
**Files:** Modify `frontend/components/desktop/ws-provider.tsx`, `frontend/lib/stores/desktop-store.ts`, `frontend/lib/stores/chat-store.ts`, `frontend/app/(desktop)/desktop/page.tsx`.
**Depends on:** Bridge Critical Connection Pipeline (for reconnect to work). NOTE: T4.1, T4.2, T4.5, T4.6, T4.7, T4.8 are independent of the message queue and can start as soon as Bridge Connection is done. Only T4.3 (mergeCards) and T4.4 (message preservation) benefit from Frontend Connection Status being done first.

**Steps:**
1. T4.1: Reset `isAgentStreaming` on `state_sync`. Add `chat.setAgentStreaming(false)` at the top of the state_sync handler in ws-provider.tsx. Prevents stuck streaming indicator after reconnect.
2. T4.2: Reconcile `archivedStackIds` against server state on state_sync. Currently persisted archived IDs are not reset, so stacks can remain incorrectly hidden.
3. T4.3: Fix `mergeCards` to use server state as authoritative. Two bugs: (a) `(0,0)` used as magic "no position" sentinel -- cards at origin get overwritten. Add a `userPositioned` boolean flag (local to frontend store, not protocol). (b) `mergeCards` only iterates incoming cards, silently deleting local-only cards. Use server cards as base, overlay user-positioned cards that exist in both sets.
4. T4.4: Preserve user messages during state_sync. `setMessages` does wholesale replace. Merge by keeping local messages with timestamps newer than sync timestamp, dedup by message id.
5. T4.5: Add `status` message handler to ws-provider.tsx switch statement. `StatusUpdate` IS in the `SpriteToBrowserMessage` union but has no `case 'status':` branch. Messages pass validation but are silently dropped.
6. T4.6: Remove demo card seeding from production. Remove `DEMO_CARDS` from `page.tsx` lines 55-64 entirely (or gate behind `process.env.NODE_ENV === 'development'`).
7. T4.7: Fix `clampCardPosition` width handling. Pass actual template width from `TEMPLATE_WIDTHS` instead of defaulting to medium.
8. T4.8: Filter CardLayer by active stack. `useCardsForActiveStack` selector exists but is unused. Wire it up in `page.tsx`.

**Tests:**
- [ ] `isAgentStreaming` resets to false on `state_sync` receipt
- [ ] `archivedStackIds` reconciled against server state on sync
- [ ] `mergeCards` uses server state as authoritative source (no (0,0) sentinel bug)
- [ ] Local-only cards not silently deleted during merge
- [ ] Optimistic chat messages preserved if newer than sync timestamp; deduplication by message id handles conflicts
- [ ] `status` message type handled in ws-provider switch statement
- [ ] Demo cards not seeded in production (removed or dev-gated)
- [ ] `clampCardPosition` uses actual template width from `TEMPLATE_WIDTHS`
- [ ] CardLayer renders only cards for the active stack

### Task: Sprite Gateway and Runtime Hardening

**Goal:** Fix gateway scoping, background task lifecycle, send_fn safety, timeouts, and proper shutdown.
**Priority:** P2
**Size:** L
**Files:** Modify `sprite/src/server.py`, `sprite/src/gateway.py`, `sprite/src/runtime.py`.
**Depends on:** Sprite Ping/Pong and Protocol Types

**Steps:**
1. T6.1: Move `mission_lock` to server scope. Create in `main()`, pass to each `SpriteGateway` constructor. All gateways share same lock, preventing concurrent SDK access during reconnect overlap.
2. T6.2: Add background task registry. Store extraction task handles in a set. Cancel on shutdown. Cancel on connection close if extraction's send_fn is dead. Use `task.add_done_callback(active_tasks.discard)` pattern.
3. T6.3: Add `_is_connected` flag to `AgentRuntime`. Set True in `update_send_fn()`, False when connection handler exits. Check before every `_send_event()` call.
4. T6.4: Guard `send_fn` swap during reconnect. `update_send_fn` swaps immediately but in-flight sends on old connection can go to closed writer. Add a generation counter or small async lock.
5. T6.5: Add `await server.wait_closed()` after `server.close()`. Store active connection handler tasks, cancel all on SIGINT/SIGTERM before calling `wait_closed()`.
6. T6.6: Add 120s readline timeout. Wrap `reader.readline()` in `asyncio.wait_for()`. Half-open TCP connections cleaned up.
7. T6.7: Add timeouts to SDK calls. Wrap both `_client.query()` and `receive_response()` in `asyncio.wait_for()` with configurable timeout. Both can hang independently (query waits for API, receive_response waits for streaming chunks).
8. T6.11: Fix double SIGTERM handling. Guard `stop.set_result()` with `if not stop.done()`.

**Tests:**
- [ ] `mission_lock` created once in `main()` and shared across all gateway instances
- [ ] Background extraction tasks are tracked and cancelled on shutdown/disconnect
- [ ] `_send_event` checks `is_connected` flag before sending; handles disconnect gracefully
- [ ] `send_fn` swap uses generation counter; in-flight sends during reconnect do not crash the runtime
- [ ] `server.wait_closed()` called after `server.close()`; active handlers cancelled on shutdown
- [ ] `reader.readline()` has 120s timeout
- [ ] Both `_client.query()` and `receive_response()` wrapped in `asyncio.wait_for()` with timeout
- [ ] Double SIGTERM does not raise `InvalidStateError`

### Task: Sprite Error Handling and I/O Safety

**Goal:** Differentiate SDK error types, guard error paths, offload blocking I/O.
**Priority:** P2
**Size:** M
**Files:** Modify `sprite/src/runtime.py`, `sprite/src/gateway.py`.
**Depends on:** Sprite Gateway and Runtime Hardening (for T6.9 and T6.10 which use `_is_connected` flag and task registry). T6.8 and T6.12 are independent and can start in Wave 3.

**Steps:**
1. T6.9: Differentiate SDK error types. Catch `RateLimitError`, `APIConnectionError`, `AuthenticationError` specifically. Send appropriate user-facing messages for each.
2. T6.10: Guard extraction error path. Wrap `_send_error` in try/catch for closed-connection case. Currently a handled failure turns into an unhandled task exception.
3. T6.8: Offload large file writes to thread. Wrap `base64.b64decode()` and `file_path.write_bytes()` in `asyncio.to_thread()` for files >1MB. Do NOT wrap `mkdir` (fast, keep synchronous).
4. T6.12: Add upload path error handling. Base64 decode/write errors at `gateway.py:223` are uncaught. Wrap in try/except, send friendly error to user.

**Tests:**
- [ ] Rate limit errors show "rate limited, please wait" message
- [ ] Auth errors show clear "API key issue" message
- [ ] `_send_error` on dead connection does not cause unhandled task exception
- [ ] Large file writes (>1MB) run in `asyncio.to_thread()`
- [ ] Base64 decode and file write errors are caught and reported

### Task: Sprite Database Indexes, Migrations, and Transactions

**Goal:** Add missing indexes, fix error handling, add transaction context manager, fix atomicity, add retention limits.
**Priority:** P2
**Size:** M
**Files:** Modify `sprite/src/database.py`, `sprite/src/memory/processor.py`.
**Depends on:** None

**Steps:**
1. T7.1: Add index on `observations.processed`. Queried every agent turn and every processor batch.
2. T7.2: Add composite index on `cards(stack_id, status)`. Queried on every state_sync and canvas interaction.
3. T7.3: Fix migration error handling. Replace bare `except Exception: pass` with `except sqlite3.OperationalError as e: if "duplicate column" not in str(e): raise`.
4. T7.4: Add transaction context manager to `_BaseDB`. `async with db.transaction():` pattern using `BEGIN IMMEDIATE / COMMIT / ROLLBACK`. Per spec decision, explicitly use BEGIN IMMEDIATE for `archive_stack` and `restore_stack` operations.
5. T7.5: Fix processor cross-DB atomicity. Batch insert learnings in one transaction using `executemany()`. Currently inserts row-by-row with auto-commit, then marks observations processed in a different DB. Crash mid-batch produces duplicates.
6. T7.6: Add `_conn` guard. Check `_conn is not None` at start of every public method. Raise clean `RuntimeError` instead of `AttributeError`.
7. T7.7: Optimize `get_chat_history`. Replace COUNT(*) subquery with cursor-based pagination or cached count.
8. T7.8: Add data retention limits. Prune on insert: 10,000 observations, 5,000 chat_messages, unlimited learnings.

**Tests:**
- [ ] Index exists on `observations.processed` (query `sqlite_master`)
- [ ] Composite index exists on `cards(stack_id, status)`
- [ ] Migration errors catch only `sqlite3.OperationalError` with "duplicate column" check
- [ ] Transaction context manager commits on success, rolls back on exception
- [ ] Processor batch inserts learnings in one transaction; simulated crash mid-batch does not produce duplicates on restart
- [ ] Database methods after `close()` raise clean `RuntimeError`
- [ ] `get_chat_history` uses cursor-based pagination
- [ ] Observations pruned to 10,000, chat_messages to 5,000 on insert; newest rows preserved, oldest pruned first

### Task: Bridge Cleanup and Test Fixes

**Goal:** Fix E2E tests, remove fragile patterns, consolidate duplicate code, add missing cleanup and coverage.
**Priority:** P3
**Size:** L
**Files:** Modify `bridge/src/reconnect.ts`, `bridge/src/proxy.ts`, `bridge/src/keepalive.ts`, `bridge/src/sprite-exec.ts`, `bridge/src/index.ts`. Test `bridge/tests/e2e-user-sprite.test.ts`, create `bridge/tests/updater.test.ts`.
**Depends on:** Bridge Critical Connection Pipeline. NOTE: T8.14 (E2E tests), T8.15 (private field access), T8.16 (circular dep), T8.23 (updater tests) only need Task 1, not Auth Hardening. T8.21 (SIGTERM cleanup) and T8.8 (consolidate createSystemMessage) touch `index.ts` which Auth Hardening modifies, so those items should wait for Task 4.

**Steps:**
1. T8.14: Fix multi-tab E2E tests. Replace `ws.once('message')` with message collector that waits for multiple messages within a window. `authenticateBrowser` misses back-to-back `connected` + `sprite_ready`.
2. T8.15: Fix `reconnect.ts` private field access. Replace `conn['opts'].onMessage` bracket-access with a proper `replaceMessageHandler()` public method on `SpriteConnection`, or better: add `verifyAlive()` method that handles pong internally.
3. T8.16: Break circular dependency `proxy.ts` <-> `keepalive.ts`. Have keepalive accept a connection-getter function parameter instead of importing from proxy.
4. T8.17: Fix `sprite-exec.ts` stderr filtering. Invert logic: always log stderr, suppress only known noise patterns (e.g., ZlibError).
5. T8.8: Consolidate duplicate `createSystemMessage` from `index.ts` and `reconnect.ts` into shared utility.
6. T8.22: Fix Bridge reconnect to abort when no browsers connected. Add early-exit checks after each async step.
7. T8.21: Add SIGTERM cleanup for sprite connections, keepalive timers, reconnect states. Add forced exit timeout.
8. T8.23: Add `checkAndUpdate` test coverage for `updater.ts`. Only `compareSemver` is currently tested.

**Tests:**
- [ ] Multi-tab E2E tests pass (collect all messages within a window)
- [ ] `reconnect.ts` uses public method on SpriteConnection (not bracket-access)
- [ ] `keepalive.ts` accepts connection-getter function (no circular import)
- [ ] `sprite-exec.ts` logs all stderr, suppresses only known noise
- [ ] `createSystemMessage` consolidated into one shared function
- [ ] Reconnect aborts when no browsers connected for the user
- [ ] SIGTERM handler cleans up all resources with forced exit timeout
- [ ] `checkAndUpdate` has test coverage

### Task: Frontend Dead Code and File Removal

**Goal:** Remove dead files, dead exports, spike fonts, and demo page.
**Priority:** P3
**Size:** M
**Files:** Delete `frontend/app/(app)/test-chat/page.tsx`, `frontend/components/wallpaper/wallpaper-picker.tsx`, `frontend/lib/supabase.ts`, `frontend/lib/supabase-server.ts`, `frontend/hooks/use-mobile.ts`, `frontend/app/(desktop)/cards-demo/page.tsx`. Modify `frontend/types/ws-protocol.ts`, `frontend/lib/websocket.ts`, `frontend/app/layout.tsx`.
**Depends on:** Frontend State Reconciliation

**Steps:**
1. T8.1: Remove dead files. For each file: verify zero import references with `rg` search, then delete. Confirm build passes after each removal. Files: `test-chat/page.tsx`, `wallpaper-picker.tsx`, `lib/supabase.ts`, `lib/supabase-server.ts`, `hooks/use-mobile.ts`.
2. T8.2: Remove dead exports from live files. Verify zero consumers first. Exports: `isBlock()`/`isBlockArray()` from ws-protocol.ts, `handlers` Map + `on()` method from WebSocketManager, `SuggestionChip` type. NOTE: `useCardsForActiveStack` is NOT dead (T4.8 wires it up).
3. T8.3: Remove spike fonts from `layout.tsx`. Delete `DM_Sans`, `Plus_Jakarta_Sans` imports and General Sans external stylesheet. Verify no CSS references these font families first.
4. T8.6: Remove `cards-demo/page.tsx` entirely.

**Tests:**
- [ ] All listed dead files removed (zero import references confirmed before each deletion)
- [ ] Dead exports removed from live files (zero consumers confirmed)
- [ ] Spike fonts removed from layout.tsx
- [ ] `cards-demo/page.tsx` removed
- [ ] Build passes after all removals

### Task: Frontend Lint, Test Fixes, and Minor Cleanup

**Goal:** Fix lint errors blocking CI, fix test failures, consolidate duplicate code, fix minor component issues.
**Priority:** P3
**Size:** M
**Files:** Modify `frontend/components/desktop/ws-provider.tsx`, `frontend/components/desktop/desktop-card.tsx`, `frontend/components/ui/spinner.tsx`, `frontend/components/ui/glass-card.tsx`, `frontend/hooks/use-file-upload.ts`. Fix test files.
**Depends on:** Frontend Connection Status and Message Queue, Frontend State Reconciliation

**Steps:**
1. T8.12: Fix frontend lint errors. Hook purity/immutability errors in `ws-provider.tsx`, `persona.tsx`, `desktop-viewport.tsx`, `use-momentum.ts`. Be careful: adding deps to `useEffect` can change behavior.
2. T8.13: Fix 10 voice/chat test failures. `chat-bar` visibility/linger tests + `use-stt` token/error path tests. Use `vi.useFakeTimers()` consistently for timing-sensitive tests.
3. T8.7: Consolidate duplicate snake_case-to-camelCase mapping in ws-provider.tsx. Extract ~60 duplicated lines from `canvas_update` and `state_sync` handlers into shared mapper.
4. T8.9: Fix TEMPLATE_WIDTHS duplication. Single source of truth in JS object, use `style` prop for width (Tailwind purges dynamic class names).
5. T8.10: Fix Spinner import pattern. Replace `lucide-react` with Tabler icons barrel (consistent with codebase).
6. T8.28: Fix GlassCard SVG filter reference. Remove dead `#glass-blur` filter reference (filter definition doesn't exist in codebase).
7. T8.27: Add file upload size validation. Validate against 10MB limit before sending (matches Bridge limit from T2.10).

**Tests:**
- [ ] `npm run lint` passes with zero errors in frontend
- [ ] All voice/chat test failures fixed (10 currently failing)
- [ ] Snake-to-camelCase mapping extracted to shared mapper
- [ ] `TEMPLATE_WIDTHS` defined in single source of truth
- [ ] Spinner uses Tabler icons
- [ ] GlassCard SVG filter reference fixed
- [ ] File upload validates against 10MB limit before sending

### Task: Sprite Dead Code, Version Pinning, and Docs

**Goal:** Remove dead Sprite code, pin SDK version, add system prompt size bound, fix docs mismatch, fix backend pytest.
**Priority:** P3
**Size:** S
**Files:** Modify `sprite/src/gateway.py`, `sprite/src/hooks.py`, `sprite/requirements.txt`, `sprite/src/memory/loader.py`. Fix `backend/tests/test_agent_extractor.py`.
**Depends on:** Sprite Gateway and Runtime Hardening (for T8.4 which removes code from gateway.py that Task 8 modifies). NOTE: T8.11 (backend pytest), T8.24 (SDK pinning), T8.25 (prompt size), T8.26 (docs mismatch) are independent and can start anytime.

**Steps:**
1. T8.4: Remove `_check_correction_threshold` from `gateway.py` (lines 68-109). Defined but never called. Verify no test references first.
2. T8.5: Clean up dead `session_id` paths. `session_id` is always NULL in observations. Remove code that creates/queries dead session fields. Leave columns in SQLite schema (DROP COLUMN is complex pre-3.35.0).
3. T8.11: Fix backend `test_agent_extractor.py:25`. Stale import of removed `app.services.agent_extractor`. Delete the test file (v1 backend is deprecated) or update the import.
4. T8.24: Pin SDK version. Change `claude-agent-sdk>=0.1.17` to `>=0.1.17,<0.2.0` in `requirements.txt`.
5. T8.25: Add system prompt size bounding in `memory/loader.py`. Cap total size to 50KB across all 6 memory files. Preserve `soul.md` and `os.md` in full, truncate largest daemon-managed files first.
6. T8.26: Fix batch threshold docs mismatch. Code says `DEFAULT_BATCH_THRESHOLD = 10`, docs say 25. Update documentation to match code (code is source of truth).

**Tests:**
- [ ] `_check_correction_threshold` removed (no references in tests)
- [ ] Dead `session_id` code paths cleaned up
- [ ] Backend pytest collection succeeds
- [ ] SDK pinned to `>=0.1.17,<0.2.0`
- [ ] Memory loader caps total system prompt size (50KB)
- [ ] Batch threshold documentation matches code (10)

## Sequence

This section describes task-level dependencies. When using orchestrated agents, tasks start as soon as their specific dependencies are met (not wave barriers). Wave groupings are a guide, not strict gates.

### Wave 1: Foundation (parallel)
- **Bridge Critical Connection Pipeline** (L)
- **Bridge Platform Crash Fixes** (M)
- **Bridge Build and Dockerfile Fixes** (S) -- independent, can start immediately
- **Sprite Database Indexes, Migrations, and Transactions** (M) -- independent, can start immediately

### Wave 2: Protocol + Auth + Error Boundaries (parallel, after Wave 1)
- **Sprite Ping/Pong, Protocol Types, and Validation** (M) -- needs Bridge Connection done
- **Bridge Auth and Provisioning Hardening** (L) -- needs Bridge Connection done
- **Frontend Error Feedback and Boundaries** (S) -- no hard dependency, start early

### Integration Checkpoint (after Wave 2)
Manual E2E test of the **message delivery pipeline**: connect, send message, Sprite sleeps, Sprite wakes, Bridge reconnects (ping/pong succeeds, new connection registered), send another message, both messages arrive. This validates Waves 1-2 as a unit. NOTE: This tests the delivery pipeline, not concurrent SDK access (T6.1, Wave 3). The mission_lock race requires very specific timing and is validated separately in Wave 3.

### Wave 3: UX + Runtime + State (parallel, after Wave 2)
- **Frontend Connection Status and Message Queue** (L) -- needs Bridge Connection + Protocol done
- **Sprite Gateway and Runtime Hardening** (L) -- needs Protocol done
- **Frontend State Reconciliation** (L) -- independent items (T4.1, T4.2, T4.5, T4.6, T4.7, T4.8) can start as soon as Bridge Connection is done; T4.3 and T4.4 benefit from Queue being done first

### Wave 4: Errors + Early Cleanup (parallel, after Wave 3)
- **Sprite Error Handling and I/O Safety** (M) -- T6.9/T6.10 need Gateway Hardening; T6.8/T6.12 can start in Wave 3
- **Bridge Cleanup and Test Fixes** (L) -- independent items (T8.14-T8.16, T8.23) only need Bridge Connection; T8.21/T8.8 need Auth Hardening

### Wave 5: Final Cleanup (parallel, after Wave 4)
- **Frontend Dead Code and File Removal** (M) -- needs State Reconciliation done
- **Frontend Lint, Test Fixes, and Minor Cleanup** (M) -- ws-provider.tsx items need State Reconciliation; other items (T8.9, T8.10, T8.13, T8.27, T8.28) are independent
- **Sprite Dead Code, Version Pinning, and Docs** (S) -- T8.4 needs Gateway Hardening (gateway.py contention); T8.11, T8.24, T8.25, T8.26 are independent

### Critical Path

With task-level dependencies (orchestrated agents):
```
Bridge Connection (L) -> Protocol+Ping/Pong (M) -> Frontend Connection Status (L) -> Frontend State Reconciliation (L) -> Frontend Lint/Tests (M)
     ~4h                      ~2.5h                         ~4h                              ~4h                            ~2.5h
                                                                                                                     Total: ~17h
```

With strict wave barriers (manual execution):
```
Wave 1 (~4h) -> Wave 2 (~3.5h) -> Checkpoint (~0.5h) -> Wave 3 (~4.5h) -> Wave 4 (~3h) -> Wave 5 (~3.5h)
                                                                                                Total: ~19h
```

The frontend dependency chain is the bottleneck in both models.

## Risks and Mitigations

**1. `ws-provider.tsx` contention (HIGH):** Frontend Connection Status, State Reconciliation, and Lint/Tests all modify this file across Waves 3-5. Strictly enforce wave ordering for these tasks. Consider single agent handling all three sequentially.

**2. `gateway.py` contention (HIGH):** Touched by Ping/Pong (Wave 2), Gateway Hardening (Wave 3), Error Handling (Wave 4), and Dead Code (Wave 5). Four tasks across four waves. Each wave must complete its gateway.py changes before the next begins. Agents must read the file fresh after prior wave completes.

**3. `index.ts` and `proxy.ts` contention (MEDIUM):** `index.ts` touched by Auth Hardening (Wave 2) and Bridge Cleanup (Wave 4). `proxy.ts` touched by Bridge Connection (Wave 1) and Bridge Cleanup (Wave 4). Wave ordering handles this, but agents modifying these files should verify against latest state.

**4. `runtime.py` contention (MEDIUM):** Touched by Gateway Hardening (Wave 3) and Error Handling (Wave 4). Both tasks add error handling to the same module. Wave ordering is sufficient.

**5. Protocol file merge conflicts (MEDIUM):** `protocol.py` touched by Tasks 2, 8, and 15. `protocol.ts` touched by Tasks 2 and 5. Each wave must complete protocol changes before the next begins.

**6. Testing gap between waves (MEDIUM):** Individual task testing may show false confidence because connection bugs are interconnected. Mitigated by the integration checkpoint after Wave 2.

**7. Bridge 256MB memory constraint (LOW):** T2.10 body size limit uses streaming check (count bytes during `req.on('data')`, abort early). Do NOT collect-then-check.

**8. Deployment ordering (LOW):** Protocol changes (T5.1) span bridge, frontend, and sprite. All three must deploy together or in bridge-first order to avoid message type mismatches. No staged rollout needed for dev, but production deploy should be coordinated.

**9. Demo card removal ordering (LOW):** Task 7 removes DEMO_CARDS seeding, Task 13 removes cards-demo page. Verify demo page is independent before Task 7. Or gate behind dev flag first, remove completely in Task 13.

**10. Retention pruning data safety (LOW):** T7.8 prune-on-insert must preserve newest rows and prune oldest first. Test covers this explicitly. No backup/rollback needed since pruning is gradual (on-insert), not batch.

## Success Criteria

### Connection Reliability
- [ ] Messages survive Sprite sleep/wake cycle without silent drops
- [ ] Browser refresh during agent streaming reconnects cleanly, no stuck UI
- [ ] First-time user with no Sprite gets working agent within 15 seconds
- [ ] Bridge reconnects after sleep/wake without unnecessary server restart
- [ ] Large messages (>64KB) survive TCP frame splitting

### User Feedback
- [ ] Connection status visible during all states (connecting, waking, connected, error)
- [ ] Transient disconnects (<5s) invisible to user
- [ ] Longer outages show reconnecting indicator
- [ ] Permanent failures show clear error with guidance
- [ ] Errors visible via toast or inline feedback

### Code Quality
- [ ] Zero dead files/exports from cleanup list
- [ ] `npm run lint` passes with zero errors
- [ ] All Bridge tests pass (current suite + fixed E2E)
- [ ] Frontend voice/chat tests pass
- [ ] Backend pytest collection succeeds
- [ ] No spike/prototype code in production paths

### Database
- [ ] Indexes on `observations.processed` and `cards(stack_id, status)`
- [ ] Migration errors not swallowed
- [ ] Processor batch insert is transactional
