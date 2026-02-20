# Exploration: Connection Stability & Codebase Cleanup

**Date:** 2026-02-21
**Status:** Ready for planning

**Sources:** 12 internal investigation agents (3 round-1 connection-focused + 9 round-2 deep-dive), Gemini cross-review, external codebase-review.md, practical test/lint report. Four independent perspectives covering every file across frontend/, bridge/, and sprite/.

---

## Problem

The Stackdocs v2 platform has pervasive connection instability across all three codebases. Users experience:

- Messages silently disappearing (sent but never received by Sprite)
- Chat appearing to work but nothing happening on the backend
- Connection drops with no visible feedback (no status indicator, no error, no retry guidance)
- Cards "teleporting" back to old positions after reconnect
- Agent streaming state getting stuck permanently after reconnect
- First-time users authenticating successfully but never getting a working Sprite

The root causes are architectural, not superficial. Three critical bugs in the connection pipeline mean that **every single reconnection event** (which happens on every Sprite wake from sleep) silently breaks message delivery. On top of this, the codebase has accumulated dead code, failing tests, lint errors, missing error boundaries, and no user-facing connection feedback. The result is a product that feels broken and unreliable.

This is not a feature request. This is a reliability foundation that must be solid before any other v2 work can proceed.

---

## Solution

A comprehensive, multi-track cleanup that fixes every known connection bug, hardens error handling, cleans dead code, and adds the minimum UX needed for users to understand what is happening with their connection. The work is organized into 8 tracks that can partially parallelize:

1. **Critical connection fixes** (3 codebases) -- the bugs that cause silent message loss
2. **Auth & provisioning hardening** (bridge) -- the bugs that prevent first-time users from working
3. **Frontend connection UX** -- status indicator, message queue, error feedback
4. **Frontend state reconciliation** -- state_sync correctness after reconnect
5. **Protocol alignment** (bridge + sprite) -- undocumented types, ping/pong mismatch
6. **Sprite runtime fixes** (sprite) -- gateway scoping, task lifecycle, disconnect handling
7. **Database & performance** (sprite) -- indexes, migrations, transaction safety
8. **Dead code & cleanup** (all 3) -- remove unused files, fix tests/lint, remove spike code

---

## Requirements

### Track 1: Critical Connection Fixes

- [ ] **T1.1** Fix Bridge reconnect registration gap (`proxy.ts` + `reconnect.ts`). After a Sprite TCP reconnect, the new `SpriteConnection` must be written back to `spriteConnections` Map in `proxy.ts`. Currently it is stored only in `reconnect.ts` local state, so all post-reconnect `forwardToSprite` calls fall through to buffer, which fills at 50 and silently drops everything.
- [ ] **T1.2** Fix Bridge socket registration before verify (`proxy.ts:51`). `createAndRegister` adds the connection to `spriteConnections` immediately after TCP connect, before `verify(conn)` runs. If the server is hung, messages route to a dead socket. Register only after verify succeeds.
- [ ] **T1.3** Fix zombie socket leak on post-init error (`sprite-connection.ts:88`). After `initDone=true`, the `error` handler calls `onError` but does NOT call `this.close()`. The socket stays in `spriteConnections` but is dead. No `close` event fires, no reconnect triggers. Add `this.close()` in the error handler.
- [ ] **T1.4** Add partial-line buffering in `sprite-connection.ts:81`. TCP Proxy sends newline-delimited JSON. If a message is split across WS frames, `text.split('\n')` produces truncated JSON that fails to parse. Maintain a carry-over buffer across frames and only emit complete newline-delimited messages.
- [ ] **T1.5** Implement ping/pong response on Sprite (`gateway.py:146`). Bridge sends `ping`, Sprite silently drops it. Bridge's `defaultVerifyServer` sends a ping and waits for a pong. The Sprite never responds, so verification always fails, triggering unnecessary server restarts. Sprite must respond to `ping` with `pong`.
- [ ] **T1.6** Fix `startSpriteServer` timeout to reject, not resolve (`provisioning.ts:150`). The 3s timeout path calls `resolve()` even if the exec WS never opened. Caller thinks server started when it didn't. Timeout must reject.

### Track 2: Auth & Provisioning Hardening

- [ ] **T2.1** Wire `ensureSpriteProvisioned` into auth flow (`index.ts:148`). Currently `if (result.spriteName)` skips when null. New users with no Sprite authenticate but never get a runtime. Call `ensureSpriteProvisioned` when `spriteName` is null or status is failed/pending.
- [ ] **T2.2** Add startup-time env var validation (`index.ts`). Validate all required env vars (`CLERK_SECRET_KEY` or `CLERK_JWT_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SPRITES_TOKEN`) before `server.listen()`. Fail fast with clear error instead of passing health checks then failing on first connection.
- [ ] **T2.3** Fix SPRITES_TOKEN silent skip (`index.ts:149`, `provisioning.ts:92`). When undefined, Sprite connection is silently skipped. Browser gets `connected` but never `sprite_ready` with no error. Send explicit error to browser.
- [ ] **T2.4** Differentiate auth errors from infra errors (`auth.ts:109,116`). Currently catches swallow all exceptions -- "User not found" when Supabase is down, "Invalid JWT" when Clerk API is down. Log actual error, return appropriate error code (4xx for auth, 5xx for infra).
- [ ] **T2.5** Add auth timeout race protection (`index.ts:121` + `auth.ts`). If the 10s auth timeout fires while `authenticateConnection` is still in flight, the resolved value proceeds to `setConnection` on a dead socket, creating a zombie entry. Check socket state before proceeding after async auth.
- [ ] **T2.6** Add `process.on('unhandledRejection')` handler (`index.ts`). Currently no global handler. Async errors in WS message handler disappear into void.
- [ ] **T2.7** Wrap async WS message handler in try/catch (`index.ts:94`). The `async` callback on `ws.on('message')` can have unhandled rejections if `authenticateConnection` or downstream calls throw unexpectedly.
- [ ] **T2.8** Fix Dockerfile to include sprite source files or refactor to API-only deployment. `bootstrap.ts:25` reads from `../../sprite/` which doesn't exist in the container. Every version update attempt fails in production. Either COPY sprite/ into the image or refactor bootstrap/updater to use Sprites.dev FS API exclusively.
- [ ] **T2.9** Add `package-lock.json` to Dockerfile COPY. Currently `npm install` without lockfile produces non-deterministic builds. Change to `COPY package*.json ./` and `npm ci --omit=dev`.
- [ ] **T2.10** Add body size limit to `api-proxy.ts:37` `collectBody` (promoted from T8.19). No size limit allows OOM via unbounded payload. A single malicious Sprite can crash the entire global Bridge, taking down all users. Cap at 10MB or stream directly to upstream. **Critical -- platform-wide impact.**
- [ ] **T2.11** Fix `api-proxy.ts:72` header array crash (promoted from T8.20). Duplicate HTTP headers parse as `string[]`. `Buffer.byteLength(token)` throws synchronous TypeError, which inside the async handler triggers an unhandled rejection that crashes the Bridge process. Guard with `Array.isArray()` check. **Critical -- platform-wide impact.**

### Track 3: Frontend Connection UX

- [ ] **T3.1** Add user-visible connection status indicator. The `ConnectionStatus` type has 6 states (`disconnected`, `connecting`, `authenticating`, `sprite_waking`, `connected`, `error`) but no component displays them. Add a status pill/indicator. Silent on transient drops (<5s), visible on longer outages or permanent failures.
- [ ] **T3.2** Build outgoing message queue in `WebSocketManager`. In-memory buffer (not localStorage). Queue messages while disconnected, flush on reconnect. Return queue status from `send()` so callers know message is queued vs delivered.
- [ ] **T3.3** Fix chat-bar optimistic send (`chat-bar.tsx:54`). Message is added to local store BEFORE checking if `send()` succeeded. Check `send()` result first; if queued, show pending state; if failed, show error.
- [ ] **T3.4** Handle `reconnect_failed` system event (`websocket.ts:180`). Currently defined but unhandled. Transition to error status with user-visible retry guidance.
- [ ] **T3.5** Handle auth rejection (4001) as terminal (`websocket.ts:78-84`). Currently any close code triggers reconnect. Auth failures should NOT reconnect -- they should show an auth error.
- [ ] **T3.6** Add error boundary (`app/(desktop)/desktop/`). No `error.tsx` or `global-error.tsx` exists. React crash = white screen. Add error boundary with recovery button.
- [ ] **T3.7** Surface errors via Sonner toasts. Sonner is installed and configured but zero `toast()` calls exist in desktop components. Use for: file upload errors, connection errors, send failures.
- [ ] **T3.8** Fix system error message visibility (`chat-panel.tsx:23`). Agent errors render as `text-[11px] text-white/25` -- nearly invisible. Make error messages clearly visible.
- [ ] **T3.9** Add Sprite cold-start feedback. `sprite_waking` status exists but no UI renders it. Show a subtle "Connecting to your workspace..." indicator during the 1-12s cold start.
- [ ] **T3.10** Fix `authenticate()` fire-and-forget (`websocket.ts:70`). If `getToken()` throws, the rejection is unhandled and auth hangs until server timeout. Wrap in catch, set error status, close socket.

### Track 4: Frontend State Reconciliation

- [ ] **T4.1** Reset `isAgentStreaming` on `state_sync` (`ws-provider.tsx:177-237`). After reconnect, `isAgentStreaming` can be stuck `true` permanently. Add `chat.setAgentStreaming(false)` to the state_sync handler.
- [ ] **T4.2** Reconcile `archivedStackIds` on `state_sync` (`ws-provider.tsx:183`). Persisted archived IDs are not reset on sync, so stacks can remain hidden incorrectly after reconnect.
- [ ] **T4.3** Fix `mergeCards` to use server state as authoritative (`desktop-store.ts:162-167`). Two problems: (a) (0,0) used as magic "no position" sentinel -- cards placed at origin get overwritten. (b) `mergeCards` only iterates incoming cards, so local-only cards are silently deleted. Use server state as authoritative source, or add explicit "user has positioned" metadata flag.
- [ ] **T4.4** Fix `mergeCards` to preserve user messages during state_sync (`chat-store.ts:65`). `setMessages` wholesale replaces the array. Optimistic user messages sent before reconnect are wiped if not yet persisted by Sprite. Merge by preserving local messages newer than sync timestamp.
- [ ] **T4.5** Add `StatusUpdate` to `SpriteToBrowserMessage` union (`ws-protocol.ts:339`). Currently missing from the union type. Document status updates pass validation but are silently dropped by the switch statement in ws-provider. Add the type and a handler.
- [ ] **T4.6** Remove demo card seeding from production (`page.tsx:55-64`). `DEMO_CARDS` seeded in `useEffect` on every mount, overwrites real `state_sync` data. Remove entirely or gate behind explicit dev flag.
- [ ] **T4.7** Fix `clampCardPosition` width handling (`desktop-store.ts:30`). Defaults to medium width when `cardWidth` is omitted. Wider templates overflow near right edge. Pass actual template width from `TEMPLATE_WIDTHS`.
- [ ] **T4.8** Filter CardLayer by active stack (`page.tsx:24`). Currently renders ALL cards from every stack. `useCardsForActiveStack` selector exists but is unused. Use it.

### Track 5: Protocol Alignment

- [ ] **T5.1** Add `ping`, `pong`, `heartbeat`, `state_sync_request` to `MESSAGE_TYPES` in both `protocol.ts` and `protocol.py`. Currently undocumented but routed by gateway.
- [ ] **T5.2** Add keepalive `id` field (`keepalive.ts:14`). Ping messages are missing the mandatory `id` field required by `WebSocketMessageBase`.
- [ ] **T5.3** Validate `context` structure in Python `is_mission_message` (`protocol.py:491`). TypeScript is stricter. Python skips validation of the context dict, allowing malformed context through.
- [ ] **T5.4** Fix `AgentEventMeta` camelCase conversion fragility (`protocol.py:683-690`). Hand-rolled field mapping breaks silently if new fields are added. Add a test or use a systematic conversion.
- [ ] **T5.5** Align `preview_rows` type (`protocol.py` vs `protocol.ts`). TypeScript: `unknown[][]`. Python: `list[list[str]]`. Unify to same constraint.

### Track 6: Sprite Runtime Fixes

- [ ] **T6.1** Move `mission_lock` to server/runtime scope (`server.py:52`, `gateway.py:126`). Currently per-connection gateway. Overlapping connections during reconnect can concurrently hit the SDK client. Create lock in `main()`, pass to each Gateway.
- [ ] **T6.2** Add background task registry and lifecycle management (`gateway.py:233`). Store extraction task handles. Cancel on shutdown. Cancel on connection close if extraction's send_fn is dead.
- [ ] **T6.3** Guard `_send_event` against closed-connection exceptions (`runtime.py:252-258`). Mid-run disconnect causes cascade of send errors logged as "Unhandled error". Add `is_connected` flag, check before sending, handle gracefully.
- [ ] **T6.4** Guard `send_fn` swap during reconnect (`runtime.py:136`). `update_send_fn` swaps immediately. In-flight sends on old connection can go to closed writer. Add a generation counter or small async lock.
- [ ] **T6.5** Add `await server.wait_closed()` after `server.close()` (`server.py:114`). Currently active connection handlers hang indefinitely. Properly drain connections. **Also: explicitly cancel all active connection handler tasks in `main()` during SIGINT/SIGTERM before calling `wait_closed()`, otherwise it can hang indefinitely if a client holds the TCP socket open.**
- [ ] **T6.6** Add readline timeout (`server.py:58`). No timeout on `reader.readline()`. Half-open TCP connections hang forever. Use `asyncio.wait_for(reader.readline(), timeout=120)`.
- [ ] **T6.7** Add timeouts to SDK calls (`runtime.py:252`). No timeout on `_client.query()` or `receive_response()`. Unresponsive API hangs forever. Wrap in `asyncio.wait_for()` with configurable timeout.
- [ ] **T6.8** Wrap large file writes in `asyncio.to_thread()` (`gateway.py:224`). 25MB `file_path.write_bytes()` and `base64.b64decode()` block the event loop synchronously.
- [ ] **T6.9** Differentiate SDK error types (`runtime.py:230`). Rate limits, auth failures, network errors all treated identically. Handle `RateLimitError`, `APIConnectionError`, `AuthenticationError` specifically with appropriate user-facing messages.
- [ ] **T6.10** Guard extraction error path against dead send_fn (`gateway.py:295`). `_send_error` itself fails on closed connection, turning handled failure into unhandled task exception. Nest in try/catch.
- [ ] **T6.11** Fix double SIGTERM/SIGINT handling (`server.py:79`). Second signal call raises `asyncio.InvalidStateError`. Guard with `if not stop.done()`.
- [ ] **T6.12** Add upload path error handling (`gateway.py:223`). Base64 decode/write errors are uncaught and bubble to connection handler, terminating the connection.

### Track 7: Database & Performance

- [ ] **T7.1** Add index on `observations.processed` (`database.py`). Queried every agent turn in hooks and every batch in processor. Full table scan currently.
- [ ] **T7.2** Add composite index on `cards(stack_id, status)` (`database.py`). Queried on every state_sync and canvas interaction.
- [ ] **T7.3** Fix migration exception handling (`database.py:218,231`). Bare `except Exception: pass` hides real errors. Catch only `sqlite3.OperationalError` with "duplicate column" check.
- [ ] **T7.4** Expose transaction context manager on `_BaseDB` (`database.py`). Currently multi-statement operations must reach into `self._conn` directly. Add `async with db.transaction():` pattern.
- [ ] **T7.5** Fix processor cross-DB atomicity (`processor.py:193-218`). Inserts learnings row-by-row with auto-commit, then marks observations processed in a different DB. Crash mid-batch produces duplicate learnings. Batch insert learnings in one transaction.
- [ ] **T7.6** Add `_conn` guard to database methods (`database.py:100`). Queries after `close()` raise `AttributeError` instead of clean error. Check `_conn is not None`.
- [ ] **T7.7** Optimize `get_chat_history` (`database.py:419`). COUNT(*) subquery runs on every connection. Replace with cursor-based pagination or cache count.
- [ ] **T7.8** Add data retention policy. Observations, chat_messages, and learnings grow unbounded. Add configurable row limits or age-based pruning.

### Track 8: Dead Code & Cleanup

- [ ] **T8.1** Remove dead frontend files: `app/(app)/test-chat/page.tsx` (553-line v1 prototype), `components/wallpaper/wallpaper-picker.tsx`, `lib/supabase.ts`, `lib/supabase-server.ts`, `hooks/use-mobile.ts`.
- [ ] **T8.2** Remove dead frontend exports: `useCardsForActiveStack` (after T4.8 uses it), `isBlock()`/`isBlockArray()` from ws-protocol.ts, `handlers` Map + `on()` method from WebSocketManager, `SuggestionChip` type export.
- [ ] **T8.3** Remove spike fonts from layout.tsx: `DM_Sans`, `Plus_Jakarta_Sans`, General Sans external stylesheet. All marked SPIKE, loading on every page.
- [ ] **T8.4** Remove `_check_correction_threshold` dead code (`gateway.py:68-109`). Defined but never called.
- [ ] **T8.5** Remove dead `session_id`/sessions data paths. `session_id` always NULL in observations (`hooks.py:99`). Sessions table `ended_at`/`message_count`/`observation_count` never updated.
- [ ] **T8.6** Fix or remove `cards-demo/page.tsx`. Dev-only demo page referencing bead task IDs.
- [ ] **T8.7** Consolidate duplicate snake_case-to-camelCase mapping in ws-provider.tsx. `canvas_update` and `state_sync` handlers repeat ~60 lines of field mapping. Extract shared mapper.
- [ ] **T8.8** Consolidate duplicate `createSystemMessage` logic (`index.ts` + `reconnect.ts`). Two implementations of the same function.
- [ ] **T8.9** Fix TEMPLATE_WIDTHS duplication. Widths defined in both `desktop-card.tsx:23` and each template card's Tailwind class. Single source of truth.
- [ ] **T8.10** Fix Spinner import pattern (`spinner.tsx`). Uses `lucide-react` directly instead of the Tabler icons barrel used everywhere else.
- [ ] **T8.11** Fix backend pytest (`test_agent_extractor.py:25`). Stale import of removed `app.services.agent_extractor` aborts test collection. Remove or update the test file.
- [ ] **T8.12** Fix frontend lint errors. Hook purity/immutability errors in `ws-provider.tsx`, `persona.tsx`, `desktop-viewport.tsx`, `use-momentum.ts` blocking CI.
- [ ] **T8.13** Fix frontend voice/chat test failures. 10 failures in `chat-bar` visibility/linger + `use-stt` token/error paths. Fix or update expectations.
- [ ] **T8.14** Fix Bridge multi-tab E2E tests (`e2e-user-sprite.test.ts`). `authenticateBrowser` uses `ws.once` and misses back-to-back `connected` + `sprite_ready`. Rewrite to collect all messages within a window.
- [ ] **T8.15** Fix `reconnect.ts` private field access (`reconnect.ts:86-111`). `conn['opts'].onMessage` bracket-access is fragile. Add a public `replaceMessageHandler` method to SpriteConnection, or better: add a proper `verifyAlive()` method to SpriteConnection that handles pong internally.
- [ ] **T8.16** Break circular dependency `proxy.ts` <-> `keepalive.ts`. Have keepalive accept a connection-getter function parameter instead of importing from proxy.
- [ ] **T8.17** Fix `sprite-exec.ts` stderr filtering. Logic filters OUT legitimate warnings while logging only non-warning content. Invert: always log stderr, suppress only known noise patterns.
- [ ] **T8.18** Move `node:crypto` to static import in `api-proxy.ts:71`. Currently dynamically imported on every proxied request.
- ~~T8.19~~ Promoted to **T2.10** (api-proxy OOM -- platform-wide critical).
- ~~T8.20~~ Promoted to **T2.11** (api-proxy header crash -- platform-wide critical).
- [ ] **T8.21** Add SIGTERM cleanup for sprite connections, keepalive timers, and reconnect states (`index.ts:231-243`). Add forced exit timeout.
- [ ] **T8.22** Fix Bridge reconnect to abort when no browsers connected (`reconnect.ts`). Add `getConnectionsByUser(userId).length === 0` early-exit checks after each async step.
- [ ] **T8.23** Add `checkAndUpdate` test coverage (`updater.ts`). Only `compareSemver` is tested. The full update flow has zero coverage.
- [ ] **T8.24** Pin SDK version upper bound (`sprite/requirements.txt`). `claude-agent-sdk>=0.1.17` has no ceiling. Pin to `>=0.1.17,<0.2.0`.
- [ ] **T8.25** Add system prompt size bounding (`memory/loader.py`). Memory files loaded with no truncation. Cap total size to prevent context window overflow.
- [ ] **T8.26** Fix batch threshold documentation mismatch. Code says `DEFAULT_BATCH_THRESHOLD = 10` (`hooks.py:18`), docs say 25. Align.
- [ ] **T8.27** Add file upload chunking or size guard (`use-file-upload.ts`). 25MB file produces ~33MB base64 in one WS frame. Add chunking or validate against practical WS frame limits.
- [ ] **T8.28** Fix GlassCard SVG filter reference (`glass-card.tsx:22`). References `#glass-blur` filter that doesn't exist in the codebase. Remove or add the SVG definition.

---

## Non-Requirements

- **Not adding new features.** This is pure stability, cleanup, and reliability work.
- **Not redesigning the WebSocket protocol.** Fixes work within the existing message structure.
- **Not adding markdown rendering to chat.** Found as a gap but is a feature, not a stability fix. Track separately.
- **Not adding accessibility overhaul.** Chat textarea `aria-label` and button semantics are included as quick fixes, but a full a11y audit is separate work.
- **Not adding dark/light mode toggle.** The app is dark-themed by design.
- **Not adding data retention/archival automation.** T7.8 adds the policy/limits; automated pruning jobs are future work.
- **Not refactoring documents panel.** Noted as hardcoded mock data, but wiring to real Sprite filesystem is a feature (Phase 5 work).
- **Not adding responsive/mobile support.** Canvas metaphor is desktop-first by design.
- **Not adding custom scrollbar styling.** Cosmetic, not stability.

---

## Architecture

### Connection Flow (Current vs Fixed)

**Current (broken):**
```
Browser connects -> auth -> Sprite wakes -> TCP reconnect
  -> new SpriteConnection stored in reconnect.ts local state ONLY
  -> spriteConnections Map still has old/no entry
  -> forwardToSprite() -> bufferMessage() -> buffer fills -> messages DROPPED
  -> ping sent to Sprite -> Sprite ignores -> verify fails -> restart server (unnecessary)
  -> frame fragmentation -> truncated JSON -> parse error -> message LOST
```

**Fixed:**
```
Browser connects -> auth -> ensureSpriteProvisioned if needed -> Sprite wakes -> TCP reconnect
  -> new SpriteConnection registered in spriteConnections Map (AFTER verify)
  -> partial-line buffer prevents frame fragmentation
  -> Sprite responds to ping with pong -> verify succeeds -> no unnecessary restart
  -> forwardToSprite() -> direct send (or in-memory queue on frontend during brief disconnect)
  -> user sees status indicator during reconnection
  -> state_sync reconciles all state (streaming flag, archived stacks, cards, messages)
```

### Frontend Message Queue Design

```
WebSocketManager
  ├── _queue: Array<{message, timestamp, retries}>
  ├── _maxQueueSize: 100
  ├── _maxMessageAge: 60_000ms
  │
  ├── send(message) -> 'sent' | 'queued' | 'dropped'
  │   ├── if OPEN -> ws.send() -> 'sent'
  │   ├── if queue not full -> push to _queue -> 'queued'
  │   └── if queue full -> 'dropped'
  │
  ├── _flushQueue() -> called on reconnect (after sprite_ready)
  │   ├── filter expired messages
  │   ├── send each in order
  │   └── clear queue
  │
  └── queueSize -> number (for UI indicator)
```

### Sprite Gateway Scoping Fix

```
BEFORE:
  server.py creates new SpriteGateway per connection
    -> each gateway has its own mission_lock
    -> background extraction tasks hold stale gateway's lock
    -> new connection's missions bypass old lock

AFTER:
  server.py creates mission_lock ONCE in main()
    -> passes to each SpriteGateway constructor
    -> all gateways share same lock
    -> background tasks use same lock as new connections
    -> serial execution guaranteed
```

### Sprite Partial-Line Buffer

```
BEFORE (sprite-connection.ts):
  ws.on('message', (raw) => {
    const text = raw.toString()
    for (const line of text.split('\n')) {   // BUG: frame boundary can split mid-line
      if (line.trim()) onMessage(line)
    }
  })

AFTER:
  private _lineBuffer = ''

  ws.on('message', (raw) => {
    this._lineBuffer += raw.toString()
    const lines = this._lineBuffer.split('\n')
    this._lineBuffer = lines.pop() ?? ''     // keep incomplete last line
    for (const line of lines) {
      if (line.trim()) onMessage(line)
    }
  })
```

---

## Constraints

- **Bridge runs on 256MB shared-cpu Fly.io machine.** Memory-conscious changes only. Message queue must be bounded. No unbounded buffers.
- **Sprites.dev uses CRIU checkpointing.** Processes freeze/resume. TCP connections die on sleep/wake but process state (locks, variables, event loop) persists. Reconnection is a normal event, not an error.
- **Protocol types in `bridge/src/protocol.ts` are source of truth.** Changes must sync to `frontend/types/ws-protocol.ts` and `sprite/src/protocol.py`.
- **Claude Agent SDK is pre-1.0.** API may change. Cannot rely on internal SDK behavior.
- **Single-user per Sprite.** Concurrency bugs are real (reconnect overlap) but not multi-user contention.
- **`permission_mode="bypassPermissions"` is required.** Non-negotiable for headless agent operation.
- **aiosqlite serializes writes through a background thread.** Truly async, does not block event loop.
- **Bridge auto-stop/start on Fly.io.** First request after sleep hits cold-start path. Auth timeout must accommodate.
- **Existing test suite: 136 Bridge tests, frontend voice/chat tests, backend pytest.** All must pass after changes. Currently 3 Bridge E2E + 10 frontend + backend collection failure are broken.
- **Do not modify shadcn/ui managed components** (`button.tsx`, `collapsible.tsx`, `sonner.tsx`).

---

## Success Criteria

### Connection Reliability
- [ ] User can send a message, Sprite sleeps and wakes, user sends another message -- both messages arrive. No silent drops.
- [ ] Refreshing the browser during agent streaming reconnects cleanly. `isAgentStreaming` resets. No stuck UI.
- [ ] First-time user with no Sprite assigned logs in and gets a working agent within 15 seconds.
- [ ] Bridge reconnects after Sprite sleep/wake without restarting the Python server unnecessarily (ping/pong works).
- [ ] Large messages (>64KB JSON) survive TCP Proxy frame splitting without corruption.

### User Feedback
- [ ] User sees connection status during: connecting, authenticating, sprite waking, connected, error.
- [ ] Transient disconnects (<5s, e.g. Sprite wake) are invisible -- no flicker, messages queued and delivered.
- [ ] Longer outages (>5s) show visible reconnecting indicator.
- [ ] Permanent failures (auth rejection, no Sprite) show clear error with guidance.
- [ ] File upload errors, send failures, and agent errors are visible via toast or inline feedback.

### Code Quality
- [ ] Zero dead files/exports remaining from the cleanup list.
- [ ] `npm run lint` passes in frontend with zero errors.
- [ ] All Bridge tests pass (136 existing + fixed E2E multi-tab).
- [ ] Frontend voice/chat tests pass (10 currently failing).
- [ ] Backend pytest collection succeeds (stale import fixed).
- [ ] No `any` types added. Existing `any` count does not increase.
- [ ] No spike/prototype code in production paths.

### Database
- [ ] Indexes exist on `observations.processed` and `cards(stack_id, status)`.
- [ ] Migration errors surface real failures (not swallowed by bare except).
- [ ] Processor batch insert is transactional (no duplicate learnings on crash).

---

## Open Questions

All resolved (2026-02-21):

1. **Bridge cold-start auth timeout** -- **Decision: increase to 30s.** Covers worst-case Bridge wake (12s) + Clerk JWKS fetch + slow Supabase free tier with margin.

2. **File upload size limit** -- **Decision: 10MB practical limit, reject larger.** Simple frontend validation. Chunking is future work. Most business documents are well under 10MB.

3. **Data retention limits** -- **Decision: 10,000 observations, 5,000 chat messages, unlimited learnings.** Learnings are already curated by the ObservationProcessor. Prune oldest on insert when over limit.

4. **`cards-demo/page.tsx`** -- **Decision: remove entirely.** Dead code is dead code.

5. **`archive_stack`/`restore_stack` transactions** -- **Decision: add explicit BEGIN IMMEDIATE.** Clearer intent, safer against future refactors.

---

## Next Steps

1. **`/plan`** to create implementation tasks with dependencies and parallelization
2. Tracks 1-2 (critical connection + auth) are the highest priority and must go first
3. Tracks 3-4 (frontend UX + state) can parallel with Track 6 (Sprite runtime)
4. Track 5 (protocol) should align with Tracks 1 and 6 (touches both bridge and sprite)
5. Track 7 (database) can parallel with everything else
6. Track 8 (cleanup) can run last or in parallel where it doesn't conflict
7. After implementation: full E2E manual test of the connection lifecycle (connect, send, sleep, wake, reconnect, send again)
