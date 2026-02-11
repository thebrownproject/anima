# Feature: Memory System Redesign

**Goal:** Automatic memory capture via daemon + hooks. Agent has zero memory responsibility.

## Overview

Pure Python. Single process. Turn-level observations. Haiku curates memory files (rewrite, not append). Size limits force prioritization. FTS5 for deep recall.

## Tasks

### Task: Add memory tables to SQLite schema

**Goal:** Add observations, learnings, pending_actions, and sessions tables.
**Files:** Modify `sprite/src/database.py`, modify `bridge/src/bootstrap.ts`
**Depends on:** None

**Steps:**
1. Add `observations` table (turn-level: user_message, tool_calls_json, agent_response, processed flag, sequence_num)
2. Add `learnings` table (type, content, source_observation_id, confidence)
3. Add `pending_actions` table (content, priority, status)
4. Add `sessions` table (started_at, ended_at, message_count)
5. Replace `memory_fts` with `learnings_fts` FTS5 virtual table
6. Set `PRAGMA busy_timeout=5000`
7. Add same tables to bootstrap INIT_DB_SCRIPT

**Tests:**
- [ ] All tables created with correct columns
- [ ] WAL mode + busy_timeout enabled
- [ ] Insert/query operations work
- [ ] Bootstrap schema matches

---

### Task: Build observation processor

**Goal:** Shared module for extracting learnings from observations via Haiku.
**Files:** Create `sprite/src/memory/processor.py`
**Depends on:** Add memory tables to SQLite schema

**Steps:**
1. `ObservationProcessor(db, anthropic_client)` class
2. `process_one(obs)` — build prompt (os.md + tools.md + user.md + recent learnings + observation), call Haiku, parse response
3. Parse response: FACT/PATTERN/CORRECTION/PREFERENCE/ACTION/TOOL_INSTALL → learnings table. USER_MD_UPDATE → rewrite user.md. TOOLS_MD_UPDATE → rewrite tools.md. NONE → skip.
4. `process_batch(limit)` — claim unprocessed, process each, revert on failure
5. `flush_remaining()` — process all remaining (called by Stop hook)
6. Exponential backoff on API errors. Skip observations >6h old.

**Tests:**
- [ ] Haiku called with correct prompt including memory file context
- [ ] Each learning type correctly parsed and stored
- [ ] USER_MD_UPDATE rewrites user.md file
- [ ] TOOLS_MD_UPDATE rewrites tools.md file
- [ ] NONE produces no learnings
- [ ] Stale observations skipped
- [ ] Failed processing reverts claim
- [ ] flush_remaining processes all unprocessed

---

### Task: Implement hook capture and turn-level observations

**Goal:** Buffer tool calls during agent loop, write one observation per turn on ResultMessage.
**Files:** Create `sprite/src/memory/hooks.py`, modify `sprite/src/runtime.py`
**Depends on:** Add memory tables to SQLite schema, Build observation processor

**Steps:**
1. `TurnBuffer` class — accumulates user_message + tool_call summaries in memory during a turn
2. `create_hook_callbacks(db, processor, buffer)` factory:
   - `post_tool_use` → append tool summary to buffer (truncate to 2000 chars, safe JSON)
   - `user_prompt_submit` → set buffer.user_message
   - `stop` → call processor.flush_remaining(), mark session ended
3. All hooks return empty dict (passthrough), wrap in try/except (never block agent)
4. In `runtime.py` `_handle_sdk_message`: when ResultMessage received, write ONE observation from buffer (user_message + tool_calls + agent_response), then clear buffer

**Tests:**
- [ ] PostToolUse buffers tool calls (doesn't write to SQLite)
- [ ] UserPromptSubmit buffers user message
- [ ] ResultMessage triggers observation write with all buffered data
- [ ] Buffer cleared after observation written
- [ ] Stop hook calls flush_remaining
- [ ] Hook errors never propagate

---

### Task: Update memory loader and file templates

**Goal:** Load os.md + tools.md + user.md + learnings + pending_actions. Create templates.
**Files:** Modify `sprite/src/memory/loader.py`, modify `sprite/src/memory/__init__.py`, create `sprite/memory/os.md`, create `sprite/memory/tools.md`, modify `sprite/memory/user.md`
**Depends on:** Add memory tables to SQLite schema

**Steps:**
1. `async def load(db) -> str` — load os.md + tools.md + user.md from filesystem, learnings(48h) + pending_actions from SQLite
2. Format learnings grouped by type, pending actions with priority indicators
3. Remove MEMORY.md and journal loading
4. Update `__init__.py` — new file paths (OS_MD, TOOLS_MD, USER_MD), remove MEMORY_TEMPLATE
5. Create os.md template (app identity, rules, canvas guidance, autonomy rules)
6. Create tools.md template (base tools: canvas, bash, read, write, search_memory)
7. Create user.md template (structured sections: Key Facts, Preferences, Work Context)

**Tests:**
- [ ] Loader returns all 5 sources when populated
- [ ] Omits empty sections cleanly
- [ ] MEMORY.md and journals not loaded
- [ ] Templates created with correct structure

---

### Task: Add search_memory tool

**Goal:** Give the agent read-only FTS5 search across all historical learnings.
**Files:** Create search tool in `sprite/src/agents/shared/memory_tools.py` (repurpose existing file)
**Depends on:** Add memory tables to SQLite schema

**Steps:**
1. `create_memory_tools(db)` returns single tool: `search_memory(query, limit=10)`
2. FTS5 query on learnings_fts table, returns matching learnings with type and date
3. Read-only — no write tools

**Tests:**
- [ ] search_memory returns matching learnings
- [ ] Results include type, content, and date
- [ ] No write tools exposed

---

### Task: Wire everything into AgentRuntime and start daemon

**Goal:** Register hooks, start daemon loop, remove old memory tools, deploy new templates.
**Files:** Modify `sprite/src/runtime.py`, modify `sprite/src/server.py`, delete `sprite/src/memory/journal.py`
**Depends on:** Implement hook capture and turn-level observations, Update memory loader and file templates, Add search_memory tool

**Steps:**
1. Create ObservationProcessor + TurnBuffer + hook callbacks in runtime init
2. Register hooks in ClaudeAgentOptions (PostToolUse, UserPromptSubmit, Stop)
3. MCP server: canvas_tools + [search_memory] (no write memory tools)
4. `await load(self._db)` for system prompt assembly
5. Write turn observation in `_handle_sdk_message` on ResultMessage
6. Start daemon loop as `asyncio.Task` in server.py (~15 lines)
7. Cancel daemon task on shutdown
8. Remove journal.py import and usage
9. Insert session record on `_start_session`

**Tests:**
- [ ] Hooks registered in ClaudeAgentOptions
- [ ] MCP server has canvas_tools + search_memory only
- [ ] Daemon task starts and runs
- [ ] Turn observations written on ResultMessage
- [ ] Session record created on start

---

### Task: Update bootstrap and adapt tests

**Goal:** Deploy updated files, update schema, clean up tests.
**Files:** Modify `bridge/src/bootstrap.ts`, delete `sprite/tests/test_memory_tools.py`, modify `sprite/tests/test_memory_system.py`, modify `sprite/tests/test_runtime.py`
**Depends on:** Wire everything into AgentRuntime and start daemon

**Steps:**
1. Bootstrap: update srcFiles (add hooks.py, processor.py; remove journal.py), update INIT_DB_SCRIPT, deploy os.md + tools.md + user.md templates, bump VERSION to 3
2. Delete test_memory_tools.py (old write tools gone)
3. Update test_memory_system.py for new loader (async, SQLite, no MEMORY.md/journals)
4. Update test_runtime.py (remove memory_tools mocks, add hook assertions)
5. Run full suite

**Tests:**
- [ ] Bootstrap deploys correct files
- [ ] All Python tests pass
- [ ] No references to MEMORY.md, journal.py, or old memory tools

## Sequence

```
1 (schema) → 2 (processor) → 3 (hooks + turn obs) → 6 (runtime + daemon) → 7 (bootstrap + tests)
           → 4 (loader + templates) ↗               ↗
           → 5 (search_memory) ─────────────────────
```

**Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7

## Success Criteria

- [ ] Turn-level observations captured and processed via Haiku
- [ ] Daemon runs real-time, Stop hook guarantees flush
- [ ] Haiku rewrites user.md/tools.md (not appends) within size limits
- [ ] Haiku receives memory context to prevent duplication
- [ ] os.md + tools.md + user.md + learnings(48h) + pending_actions loaded at session start
- [ ] search_memory gives agent deep recall via FTS5
- [ ] Agent has zero memory write tools
- [ ] Cost per session under $0.01
- [ ] All tests pass

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| SDK hook signatures differ | Medium | Verified against SDK source. Test early in Task 3. |
| Bridge API proxy untested for Haiku | Medium | Verify before Task 2. Already deployed (m7b.3.6). |
| Stop hook flush blocks teardown | Low | ~500ms per observation. 10 turns = ~5s. Add timeout if needed. |
| Haiku file rewrites lose information | Low | Size limits are guidelines. Everything backed up in learnings table. search_memory for recall. |
