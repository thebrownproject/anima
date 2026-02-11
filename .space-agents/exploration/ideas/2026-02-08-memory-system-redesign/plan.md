# Feature: Memory System Redesign — Workspace Daemon + Hook-Driven Capture

**Goal:** Replace agent-driven memory (memory tools, MEMORY.md, journals) with a background Workspace Daemon that automatically captures observations via SDK hooks and extracts structured learnings via Haiku.

## Overview

The main agent has zero memory tools. A background TypeScript/Bun process (Workspace Daemon) watches everything via SDK hooks (PostToolUse, UserPromptSubmit), processes observations in real-time using Haiku 4.5, and persists structured learnings to SQLite. The system captures automatically, the daemon provides intelligence, and the agent is a pure worker.

**Key design patterns adopted from claude-mem (25k+ stars):**
- Event-driven processing (EventEmitter wake, not naive polling)
- Atomic claim-confirm (delete from queue only after DB transaction succeeds)
- Idle timeout (prevent orphaned daemon processes)
- XML-structured extraction prompts (typed observations with fallback)
- Always-save philosophy (even partial observations get stored)
- Observation ordering via sequence numbers

**Written from scratch** — claude-mem is 61k LOC and we'd keep ~3%. Patterns adopted, code original.

## Tasks

### Task: Add memory tables to SQLite schema

**Goal:** Add observations, learnings, pending_actions, and sessions tables to the existing Database class.
**Files:** Modify `sprite/src/database.py`, modify `bridge/src/bootstrap.ts`
**Depends on:** None

**Steps:**
1. Add `observations` table — raw hook captures with `sequence_num` for ordering and `processed` flag (0=pending, 1=done, -1=skipped)
2. Add `learnings` table — structured extractions (fact/pattern/correction/preference/action) with confidence score and FK to source observation
3. Add `pending_actions` table — daemon-to-agent queue with priority and status
4. Add `sessions` table — session metadata (start, end, message count, observation count)
5. Replace old unused `memory_fts` with `learnings_fts` FTS5 virtual table
6. Add same tables to `INIT_DB_SCRIPT` in bootstrap.ts for new Sprites
7. Set `PRAGMA busy_timeout=5000` in Database.connect() for cross-process safety

**Tests:**
- [ ] All 4 tables created on connect with correct columns
- [ ] WAL mode enabled, busy_timeout set to 5000
- [ ] Insert/query observations, learnings, pending_actions work correctly
- [ ] learnings FK references observations
- [ ] Old memory_fts replaced by learnings_fts
- [ ] Bootstrap INIT_DB_SCRIPT includes new tables

---

### Task: Implement SDK hook capture functions

**Goal:** Create hook callbacks that write observations to SQLite when the agent calls tools or receives user messages.
**Files:** Create `sprite/src/memory/hooks.py`
**Depends on:** Add memory tables to SQLite schema

**Steps:**
1. Create `hooks.py` with `create_hook_callbacks(db)` factory returning dict of async callbacks
2. `post_tool_use` callback — writes tool_call observation with truncated input/output (2000 char limit), safe JSON serialization with str() fallback for non-serializable responses
3. `user_prompt_submit` callback — writes user_message observation with truncated content
4. `stop` callback — marks session as ended in sessions table
5. All callbacks return empty dict (SyncHookJSONOutput passthrough — never block agent)
6. All callbacks wrap DB writes in try/except — log errors, never propagate
7. Track `sequence_num` per session (auto-increment within session for ordering)

**Hook signature (verified against SDK source):**
```python
async def callback(hook_input: dict, tool_use_id: str | None, context: dict) -> dict
```
- PostToolUseHookInput fields: session_id, tool_name, tool_input, tool_response (Any)
- UserPromptSubmitHookInput fields: session_id, prompt
- StopHookInput fields: session_id, stop_hook_active

**Tests:**
- [ ] capture_tool_use writes tool_call observation with correct fields
- [ ] capture_user_message writes user_message observation
- [ ] Long inputs/outputs truncated to 2000 chars
- [ ] Non-serializable tool_response handled gracefully (str() fallback)
- [ ] Stop hook marks session as ended
- [ ] Hook errors logged but never propagate (agent never blocked)
- [ ] Sequence numbers increment within session

---

### Task: Update memory loader for SQLite learnings and pending actions

**Goal:** Rewrite loader.py to assemble system prompt from soul.md + user.md + SQLite learnings + pending actions.
**Files:** Modify `sprite/src/memory/loader.py`, modify `sprite/src/memory/__init__.py`
**Depends on:** Add memory tables to SQLite schema

**Steps:**
1. Change `load()` signature to `async def load(db: Database | None = None) -> str`
2. Load soul.md and user.md from filesystem (unchanged)
3. Query last 48h of learnings from SQLite, grouped by type (facts, patterns, corrections, preferences)
4. Query pending actions (status='pending') ordered by priority
5. Format learnings with type headers and bullet points
6. Format pending actions with priority indicators ([URGENT], [HIGH], or plain)
7. Remove MEMORY.md and journal loading — these sources no longer exist
8. Update `__init__.py` — remove MEMORY_TEMPLATE, stop creating MEMORY.md in ensure_templates()

**Tests:**
- [ ] Loader returns soul.md + user.md content (file-based, same as before)
- [ ] Loader includes formatted learnings when they exist in DB
- [ ] Learnings grouped by type with readable headers
- [ ] Loader includes formatted pending actions when they exist
- [ ] Omits learnings/actions sections when none exist (clean prompt)
- [ ] MEMORY.md and journal content NOT loaded even if files exist
- [ ] ensure_templates() no longer creates MEMORY.md

---

### Task: Register hooks in AgentRuntime and remove memory tools

**Goal:** Wire hook callbacks into ClaudeAgentOptions, remove all memory tools, update soul.md template.
**Files:** Modify `sprite/src/runtime.py`, modify `sprite/memory/soul.md`, delete `sprite/src/agents/shared/memory_tools.py`, delete `sprite/src/memory/journal.py`
**Depends on:** Implement SDK hook capture functions, Update memory loader for SQLite learnings and pending actions

**Steps:**
1. Import `create_hook_callbacks` from memory.hooks, call in `__init__` with db
2. Build hooks dict for ClaudeAgentOptions with HookMatcher for PostToolUse, UserPromptSubmit, Stop
3. Remove `create_memory_tools()` import and all usage — MCP server gets canvas_tools only
4. Remove `append_journal()` import and call — replaced by session records
5. Update `load_memory()` call to `await load(self._db)` (now async with db param)
6. Insert session record in sessions table on `_start_session()`
7. Update deployed `soul.md` template with daemon description, autonomy rules, tool guidance sections
8. Delete `memory_tools.py` and `journal.py` (no longer imported anywhere)

**Tests:**
- [ ] ClaudeAgentOptions includes PostToolUse, UserPromptSubmit, Stop hooks
- [ ] MCP server only has canvas_tools (no memory tools)
- [ ] append_journal no longer called on session complete
- [ ] Session inserted into sessions table on start
- [ ] soul.md contains "Your Daemon", "Autonomy Rules", "Tool Guidance" sections
- [ ] Existing runtime tests pass with mock adjustments

---

### Task: Build Workspace Daemon

**Goal:** Create a standalone TypeScript/Bun background process that processes observations via Haiku and writes structured learnings.
**Files:** Create `sprite/daemon/` directory with package.json, tsconfig.json, and source files
**Depends on:** Add memory tables to SQLite schema

**Architecture (adapted from claude-mem patterns):**

```
sprite/daemon/
├── package.json           # bun project, @anthropic-ai/sdk dep
├── tsconfig.json
└── src/
    ├── index.ts           # entry point, signal handlers, main loop
    ├── db.ts              # bun:sqlite wrapper (claim-confirm pattern)
    ├── processor.ts       # observation processor (Haiku calls)
    ├── prompts.ts         # XML-structured extraction prompts
    ├── user-md.ts         # read/append/write user.md
    └── __tests__/
        ├── db.test.ts
        ├── processor.test.ts
        └── prompts.test.ts
```

**Steps:**

1. **db.ts** — DaemonDB class wrapping bun:sqlite
   - `claimUnprocessed(limit)` — atomically SELECT + UPDATE processed=1 in transaction (claim-confirm: mark claimed before processing, revert on failure)
   - `confirmProcessed(id)` — no-op if already marked (idempotent)
   - `revertClaim(id)` — set processed=0 on failure (retry on next cycle)
   - `markSkipped(id)` — set processed=-1 (stale observations)
   - `insertLearning(...)` — write to learnings + learnings_fts
   - `insertPendingAction(...)` — write to pending_actions
   - `getRecentObservations(n)` — last N observations for context window (any processed state)
   - Enable WAL mode + busy_timeout=5000 on open

2. **prompts.ts** — XML-structured extraction prompts (inspired by claude-mem)
   - `formatObservation(obs)` — format tool_call or user_message into readable block
   - `formatContext(observations)` — format sliding window of 10 recent observations
   - `buildExtractionPrompt(current, context)` — full prompt asking Haiku to extract FACT/PATTERN/CORRECTION/PREFERENCE/ACTION or NONE
   - Prompt includes XML output format examples for consistent parsing

3. **processor.ts** — ObservationProcessor class
   - `processOne(obs)` — core processing: check staleness (>6h → skip), build prompt with 10-event context window, call Haiku, parse response, store learnings
   - Parse response lines matching `^(FACT|PATTERN|CORRECTION|PREFERENCE|ACTION):\s*(.+)$`
   - "NONE" response → mark processed, no learnings stored
   - **Always-save**: even partial/malformed responses get best-effort parsing (never discard)
   - Preference learnings → append to user.md via user-md.ts
   - Action learnings → insert pending_action for main agent
   - Exponential backoff on API errors (1s → 2s → 4s → ... → 60s max), reset on success
   - Track `consecutiveErrors` to detect persistent failures

4. **user-md.ts** — user.md file management
   - `appendPreference(userMdPath, preference)` — read current, append `- {preference}\n`, write back
   - Synchronous file I/O (daemon is only writer, agent reads at session start only)

5. **index.ts** — entry point and main loop
   - Open SQLite with WAL + busy_timeout
   - Create Anthropic client (respects ANTHROPIC_BASE_URL env var for Bridge proxy)
   - **Event-driven loop** (inspired by claude-mem):
     - Claim batch of unprocessed observations (limit 5)
     - Process each sequentially (Haiku call per observation)
     - On empty batch: sleep 2s then retry (lightweight poll for new observations)
     - On error: backoff sleep, revert claimed observations
   - **Idle timeout**: if no observations processed for 10 minutes, log warning (but don't exit — daemon runs continuously on Sprite)
   - SIGTERM/SIGINT handlers for graceful shutdown
   - `PRAGMA busy_timeout=5000` for concurrent access with Python hooks

**Cost per observation:** ~500 input + ~100 output tokens = ~$0.0001 (Haiku 4.5)
**Cost per session (20 tool calls):** ~$0.002

**Tests:**
- [ ] claimUnprocessed returns unprocessed rows and marks them claimed
- [ ] revertClaim sets processed back to 0
- [ ] insertLearning writes to learnings table + FTS index
- [ ] insertPendingAction writes with correct priority and status
- [ ] processOne calls Haiku with formatted prompt and 10-event context
- [ ] FACT response → learning with type='fact'
- [ ] PREFERENCE response → learning + user.md append
- [ ] ACTION response → learning + pending_action row
- [ ] NONE response → mark processed, no learnings
- [ ] Stale observations (>6h) skipped without Haiku call
- [ ] API errors trigger exponential backoff
- [ ] Always-save: partial responses still parsed and stored

---

### Task: Update bootstrap for Bun and daemon deployment

**Goal:** Modify Bridge bootstrap to install Bun, deploy daemon code, and start daemon as persistent background process.
**Files:** Modify `bridge/src/bootstrap.ts`
**Depends on:** Register hooks in AgentRuntime and remove memory tools, Update memory loader for SQLite learnings and pending actions, Build Workspace Daemon

**Steps:**
1. Add Bun install step: `curl -fsSL https://bun.sh/install | bash` (verify install path on Sprite)
2. Create `/workspace/daemon/` directory structure
3. Deploy daemon source files via FS API (package.json, tsconfig.json, src/*.ts)
4. Run `bun install` in `/workspace/daemon/` for @anthropic-ai/sdk dependency
5. Update `srcFiles` array — remove `memory_tools.py` and `journal.py`, add `memory/hooks.py`
6. Update `INIT_DB_SCRIPT` to include memory tables (observations, learnings, pending_actions, sessions, learnings_fts)
7. Update `SOUL_MD` constant with new template (daemon section, autonomy rules, tool guidance)
8. Remove `MEMORY_MD` constant — no longer deployed
9. Start daemon process via Sprites exec API with `max_run_after_disconnect=0` (persists through sleep/wake)
10. Bump `CURRENT_VERSION` to 3 to trigger lazy update on existing Sprites

**Tests:**
- [ ] Bootstrap installs Bun (bun --version succeeds on Sprite)
- [ ] Daemon files deployed to /workspace/daemon/
- [ ] bun install runs successfully
- [ ] Daemon process starts and runs continuously
- [ ] Updated source files deployed (hooks.py present, memory_tools.py absent)
- [ ] New soul.md template deployed
- [ ] MEMORY.md no longer created on new Sprites
- [ ] VERSION bumped to 3

---

### Task: Adapt existing tests and add integration coverage

**Goal:** Update all tests for the new architecture — delete obsolete tests, adapt existing ones, verify new test files.
**Files:** Delete `sprite/tests/test_memory_tools.py`, modify `sprite/tests/test_memory_system.py`, modify `sprite/tests/test_runtime.py`
**Depends on:** Implement SDK hook capture functions, Register hooks in AgentRuntime and remove memory tools, Update memory loader for SQLite learnings and pending actions, Build Workspace Daemon

**Steps:**
1. Delete `test_memory_tools.py` — memory tools no longer exist
2. Update `test_memory_system.py`:
   - Template test: assert MEMORY.md is NOT created (was previously asserted as created)
   - Loader test: rewrite for async load(db), assert learnings from SQLite, remove MEMORY.md/journal assertions
   - Journal test: delete entirely (journals replaced by sessions table)
   - Transcript test: keep as-is (transcripts unchanged)
3. Update `test_runtime.py`:
   - Remove all `create_memory_tools` mock patches
   - Remove `append_journal` mock patches
   - Add assertions that hooks are registered in ClaudeAgentOptions
   - Update `_mock_sdk` capture to include hooks field
4. Verify all new test files pass:
   - `test_memory_schema.py` (from schema task)
   - `test_memory_hooks.py` (from hooks task)
   - `test_memory_loader.py` (from loader task)
   - `daemon/src/__tests__/*.test.ts` (from daemon task)
5. Run full suites: `python -m pytest tests/ -v` and `bun test`

**Tests:**
- [ ] All Python tests pass with no import errors from removed modules
- [ ] All daemon TypeScript tests pass
- [ ] test_memory_tools.py deleted
- [ ] No test references MEMORY.md or journal.py functionality
- [ ] Runtime tests validate hook registration

## Sequence

1. Add memory tables to SQLite schema (no dependencies)
2. Implement SDK hook capture functions (depends on 1)
3. Update memory loader for SQLite learnings and pending actions (depends on 1, parallel with 2)
4. Register hooks in AgentRuntime and remove memory tools (depends on 2, 3)
5. Build Workspace Daemon (depends on 1, parallel with 2-4)
6. Update bootstrap for Bun and daemon deployment (depends on 4, 5)
7. Adapt existing tests and add integration coverage (depends on 2, 3, 4, 5)

**Optimal single-developer order:** 1 → 2 → 3 → 4 → 5 → 6 → 7

**Critical path:** 1 → 2 → 3 → 4 → 6 → 7 (Task 5 is off critical path if faster than 2+3+4)

```
1 (schema) → 2 (hooks) → 4 (runtime wiring) → 6 (bootstrap) → 7 (tests)
           → 3 (loader) ↗                    ↗
           → 5 (daemon) ─────────────────────
```

## Success Criteria

- [ ] PostToolUse hook fires on every tool call and writes observation to SQLite
- [ ] UserPromptSubmit hook fires on every user message and writes observation to SQLite
- [ ] Daemon processes observations in real-time via Haiku API (10-event sliding window)
- [ ] Daemon extracts facts, patterns, corrections, preferences, and actions
- [ ] Daemon updates user.md when preferences detected
- [ ] Daemon queues pending_actions for main agent
- [ ] Session start injects soul.md + user.md + last 48h learnings + pending actions
- [ ] Main agent has zero memory tools
- [ ] soul.md describes daemon and its role
- [ ] Agent can see and act on pending_actions from daemon
- [ ] After context compaction, knowledge persists via daemon-persisted learnings
- [ ] Daemon cost per session under $0.01
- [ ] SQLite concurrent access works (WAL + busy_timeout)
- [ ] Daemon survives Sprite sleep/wake cycles
- [ ] All tests pass (Python + TypeScript)

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| SDK hook signatures differ from verified source | Medium | Verified against SDK types.py. Test hook wiring early in Task 2 before building on it. |
| SQLite cross-process contention (Python aiosqlite + Bun bun:sqlite) | Medium | WAL mode + busy_timeout=5000 on both sides. Claim-confirm pattern prevents data loss. |
| Bun install fails on Sprite Ubuntu 25.04 | Medium | Test early in Task 5. Fallback: use Node.js + better-sqlite3 instead of Bun + bun:sqlite. |
| Bridge API proxy untested for daemon Haiku calls | Medium | Verify proxy works before starting Task 5. Proxy already deployed (m7b.3.6). |
| Daemon doesn't survive CRIU checkpoint (Sprite sleep) | Medium | Test checkpoint/restore of Bun process. Fallback: start daemon as Python subprocess. |
| loader.py sync→async is breaking change | Low | All call sites in runtime.py updated in Task 4. Tests adapted in Task 7. |
