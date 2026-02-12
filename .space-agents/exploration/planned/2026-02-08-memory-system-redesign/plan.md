# Feature: Sprite VM Structure + Memory System Redesign

**Goal:** `.os/` directory structure. Two databases (transcript + memory). 6 daemon-curated memory files. Batch processing via hooks. Agent has zero memory responsibility.

## Overview

Restructure the Sprite VM into `.os/` (system) and user space. Replace the flat `/workspace/` layout with a clean separation. Introduce two SQLite databases: `transcript.db` (immutable conversation log) and `memory.db` (searchable learnings). Six memory files loaded on boot solve the memory passover problem. Batch processing every ~25 turns via SDK hooks (Stop, PreCompact). Stateless Haiku calls — no inception problem.

## Tasks

### Task 1: Restructure Sprite VM to .os/ layout

**Goal:** Move all system files into `.os/`, establish user space directories.
**Files:** Modify `bridge/src/bootstrap.ts`, modify `sprite/src/memory/__init__.py`, modify `sprite/src/database.py`, modify `sprite/src/server.py`
**Depends on:** None

**Steps:**
1. Update bootstrap directory creation: `.os/src/`, `.os/src/tools/`, `.os/src/memory/`, `.os/memory/`, `.os/.venv/` + user space dirs `documents/`, `ocr/`, `extractions/`, `artifacts/`
2. Update bootstrap to deploy source files into `.os/src/` (not `/workspace/src/`)
3. Update all Python path references: database path → `.os/memory/`, memory files → `.os/memory/`, venv → `.os/.venv/`
4. Update `__init__.py` file paths to `.os/memory/` prefix
5. Move VERSION to `.os/VERSION`
6. Update venv creation path in bootstrap
7. Update `chown` to cover `.os/` and user space dirs

**Tests:**
- [ ] Bootstrap creates correct `.os/` directory structure
- [ ] Source files deployed to `.os/src/`
- [ ] Memory files created at `.os/memory/`
- [ ] VERSION at `.os/VERSION`
- [ ] User space dirs created (documents, ocr, extractions, artifacts)

---

### Task 2: Split database into transcript.db + memory.db

**Goal:** Two separate databases with distinct schemas and access patterns.
**Files:** Modify `sprite/src/database.py`, modify `bridge/src/bootstrap.ts`
**Depends on:** Task 1 (Restructure Sprite VM)

**Steps:**
1. Create `TranscriptDB` class wrapping `transcript.db` — append-only access pattern
   - `observations` table (id, timestamp, session_id, sequence_num, user_message, tool_calls_json, agent_response, processed)
   - `sessions` table (id, started_at, ended_at, message_count, observation_count)
2. Create `MemoryDB` class wrapping `memory.db` — read/write for daemon, read-only for agent
   - `learnings` table (id, created_at, session_id, type, content, source_observation_id, confidence)
   - `pending_actions` table (id, created_at, content, priority, status, source_learning_id)
   - `learnings_fts` FTS5 virtual table (content, type)
3. Both databases: WAL mode, `busy_timeout=5000`, `foreign_keys=ON`
4. Remove old single-db `Database` class (or keep for documents if still needed during transition)
5. Update bootstrap `INIT_DB_SCRIPT` to create both databases at `.os/memory/`

**Tests:**
- [ ] transcript.db created with correct tables
- [ ] memory.db created with correct tables + FTS5
- [ ] WAL mode + busy_timeout on both
- [ ] Insert/query operations work on both
- [ ] Bootstrap schema matches Python schema

---

### Task 3: Create 6 memory file templates

**Goal:** soul.md, os.md, tools.md, files.md, user.md, context.md templates.
**Files:** Create `sprite/memory/soul.md`, create `sprite/memory/os.md`, create `sprite/memory/tools.md`, create `sprite/memory/files.md`, create `sprite/memory/user.md`, create `sprite/memory/context.md`
**Depends on:** None

**Steps:**
1. `soul.md` (≤200 lines) — AI personality, voice, character. Stackdocs agent identity.
2. `os.md` (≤200 lines) — System rules, constraints, app identity. Canvas guidance, tool usage rules, autonomy boundaries.
3. `tools.md` (≤150 lines) — Base capabilities: canvas tools, bash, read, write, search_memory. Placeholder for learned procedures.
4. `files.md` (≤200 lines) — Initial empty state with section headers (Documents, Extractions, Recent Activity).
5. `user.md` (≤200 lines) — Structured sections: Key Facts, Preferences, Work History. Initial empty state.
6. `context.md` (≤200 lines) — Structured sections: Currently Working On, Remember, Follow Up. Initial empty state.
7. Update bootstrap to deploy all 6 files to `.os/memory/`
8. Remove old `sprite/memory/soul.md` (replaced by new soul.md + os.md)

**Tests:**
- [ ] All 6 templates exist with correct structure
- [ ] All within line limits
- [ ] Bootstrap deploys all 6 to `.os/memory/`

---

### Task 4: Update memory loader for 6-file boot sequence

**Goal:** Load all 6 md files + pending_actions into system prompt at session start.
**Files:** Modify `sprite/src/memory/loader.py`, modify `sprite/src/memory/__init__.py`
**Depends on:** Task 2 (Split database), Task 3 (Memory templates)

**Steps:**
1. `async def load(memory_db) -> str` — load all 6 md files from `.os/memory/` filesystem
2. Query `pending_actions` (status=pending) from memory.db, append to prompt
3. Format each file with clear headers: `## Soul`, `## System`, `## Tools`, `## Files`, `## User`, `## Context`, `## Pending Actions`
4. Omit empty sections cleanly
5. Remove old loader logic (MEMORY.md, journals, 48h learnings window)
6. Update `__init__.py` paths: SOUL_MD, OS_MD, TOOLS_MD, FILES_MD, USER_MD, CONTEXT_MD

**Tests:**
- [ ] Loader returns all 7 sections when populated (6 files + pending actions)
- [ ] Omits empty sections cleanly
- [ ] Reads from `.os/memory/` paths
- [ ] No references to MEMORY.md or journals

---

### Task 5: Implement hook capture and turn-level observations

**Goal:** Buffer tool calls during agent turn, write one observation to transcript.db on Stop hook. Track turn count for batch threshold.
**Files:** Create `sprite/src/memory/hooks.py`, modify `sprite/src/runtime.py`
**Depends on:** Task 2 (Split database)

**Steps:**
1. `TurnBuffer` class — accumulates user_message + tool_call summaries in memory during a turn
2. `create_hook_callbacks(transcript_db, processor, buffer)` factory:
   - `user_prompt_submit` → set buffer.user_message
   - `post_tool_use` → append tool summary to buffer (truncate to 2000 chars)
   - `stop` → write ONE observation to transcript.db from buffer, clear buffer, increment turn count, trigger batch if count >= 25
   - `pre_compact` → if trigger == "auto", call processor.flush_all() (emergency flush)
3. All hooks return `{}` (passthrough), wrap in try/except (never block agent)
4. In `runtime.py`: create buffer + register hooks in ClaudeAgentOptions

**Tests:**
- [ ] UserPromptSubmit buffers user message
- [ ] PostToolUse buffers tool calls (doesn't write to DB)
- [ ] Stop writes one observation with all buffered data
- [ ] Buffer cleared after observation written
- [ ] Turn count increments and triggers batch at threshold
- [ ] PreCompact triggers emergency flush on auto
- [ ] Hook errors never propagate

---

### Task 6: Build observation batch processor

**Goal:** Stateless module that processes observation batches via Haiku, extracts learnings, updates md files.
**Files:** Create `sprite/src/memory/processor.py`
**Depends on:** Task 2 (Split database), Task 3 (Memory templates)

**Steps:**
1. `ObservationProcessor(transcript_db, memory_db, anthropic_client)` class
2. `process_batch()` — read all unprocessed observations from transcript.db, build single Haiku prompt with current md file state + observation batch, call Haiku, parse response
3. Parse response format: FACT/PATTERN/CORRECTION/PREFERENCE/TOOL_INSTALL → learnings table. ACTION → pending_actions table. *_MD_UPDATE → rewrite corresponding md file. NONE → skip.
4. `flush_all()` — process ALL remaining unprocessed observations (called by PreCompact and session end)
5. Mark observations as processed in transcript.db after successful processing
6. Error handling: exponential backoff on API errors, skip observations >6h old
7. Read current md files fresh each batch (stateless — no memory of previous runs)

**Tests:**
- [ ] Haiku called with correct prompt including all 6 md files + observation batch
- [ ] Each learning type correctly parsed and stored in memory.db
- [ ] MD file updates rewrite the full file (not append)
- [ ] NONE produces no learnings
- [ ] Stale observations (>6h) skipped
- [ ] Failed processing doesn't mark observations as processed
- [ ] flush_all processes everything remaining

---

### Task 7: Add search_memory tool

**Goal:** Read-only FTS5 search across all historical learnings in memory.db.
**Files:** Repurpose `sprite/src/agents/shared/memory_tools.py` → move to `sprite/src/tools/memory.py`
**Depends on:** Task 2 (Split database)

**Steps:**
1. `create_memory_tools(memory_db)` returns single tool: `search_memory(query, limit=10)`
2. FTS5 query on `learnings_fts` table, returns matching learnings with type, content, and date
3. Read-only — no write tools
4. Move file from `agents/shared/memory_tools.py` to `tools/memory.py` (matches new src structure)
5. Delete old `memory_tools.py`

**Tests:**
- [ ] search_memory returns matching learnings ranked by relevance
- [ ] Results include type, content, and date
- [ ] No write tools exposed
- [ ] Empty query returns recent learnings

---

### Task 8: Wire everything into AgentRuntime

**Goal:** Connect hooks, processor, loader, search_memory. Remove old memory system.
**Files:** Modify `sprite/src/runtime.py`, modify `sprite/src/server.py`
**Depends on:** Task 4 (Loader), Task 5 (Hooks), Task 6 (Processor), Task 7 (search_memory)

**Steps:**
1. Create TranscriptDB + MemoryDB connections in server.py
2. Create ObservationProcessor + TurnBuffer in runtime init
3. Register all 4 hooks in ClaudeAgentOptions (UserPromptSubmit, PostToolUse, Stop, PreCompact)
4. MCP server tools: canvas_tools + search_memory (no write memory tools)
5. System prompt: `await loader.load(memory_db)`
6. Insert session record on start
7. Delete `sprite/src/memory/journal.py` (no longer used)
8. Delete `sprite/src/memory/transcript.py` (replaced by transcript.db)
9. Move `sprite/src/agents/shared/canvas_tools.py` → `sprite/src/tools/canvas.py`
10. Remove `sprite/src/agents/` directory

**Tests:**
- [ ] All 4 hooks registered in ClaudeAgentOptions
- [ ] MCP server has canvas + search_memory tools only
- [ ] System prompt includes all 6 memory file sections
- [ ] Session record created on start
- [ ] No references to old memory tools, journal.py, or transcript.py

---

### Task 9: Update bootstrap and run full test suite

**Goal:** Deploy updated file structure, clean up tests, verify everything works.
**Files:** Modify `bridge/src/bootstrap.ts`, modify/delete test files
**Depends on:** Task 8 (Wire everything)

**Steps:**
1. Bootstrap: deploy to `.os/src/` structure (tools/, memory/ subdirs), deploy 6 memory templates to `.os/memory/`, create both databases, bump VERSION to 3
2. Update srcFiles list: add hooks.py, processor.py, tools/canvas.py, tools/memory.py; remove journal.py, transcript.py, agents/shared/*
3. Delete `sprite/tests/test_memory_tools.py` (old write tools gone)
4. Update `sprite/tests/test_memory_system.py` (new loader, 6 files, no MEMORY.md/journals)
5. Update `sprite/tests/test_runtime.py` (hook assertions, new tool list)
6. Add test for `.os/` directory structure verification
7. Run full test suite

**Tests:**
- [ ] Bootstrap creates correct `.os/` layout
- [ ] Bootstrap deploys all source files to correct paths
- [ ] All Python tests pass
- [ ] No references to old paths, MEMORY.md, journal.py, or old memory tools

## Sequence

```
1 (.os/ layout) → 2 (two databases) → 5 (hooks) → 6 (processor) → 8 (wire up) → 9 (bootstrap + tests)
                                     → 4 (loader) ↗              ↗
3 (templates) ──────────────────────→ → 7 (search_memory) ──────
```

**Parallelizable:** Tasks 3 + 1 can start together. After Task 2, tasks 4, 5, 6, 7 can partially overlap.

**Critical path:** 1 → 2 → 5 → 6 → 8 → 9

**Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

## Success Criteria

- [ ] `.os/` structure cleanly separates system from user space
- [ ] Two databases: transcript.db immutable, memory.db searchable
- [ ] 6 memory files loaded on boot — memory passover works across sessions
- [ ] Batch processing every ~25 turns via Stop hook
- [ ] PreCompact hook flushes before context compaction
- [ ] Daemon is stateless — no inception problem
- [ ] search_memory gives agent deep FTS5 recall
- [ ] Agent has zero memory write tools
- [ ] User corrections propagate within one batch cycle
- [ ] Cost per session under $0.01
- [ ] All tests pass

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| SDK hook signatures differ from docs | Medium | Test early in Task 5. PreCompact is newer — verify first. |
| Bridge API proxy untested for Haiku batches | Medium | Verify before Task 6. Larger payloads than single-turn. |
| PreCompact flush blocks compaction | Low | Haiku call ~1-2s. Acceptable delay. Add timeout if needed. |
| Haiku file rewrites lose information | Low | Everything backed up in memory.db learnings table. search_memory for recall. |
| .os/ path migration breaks existing Sprites | Medium | VERSION bump to 3 triggers full re-bootstrap. Old Sprites get wiped cleanly. |
