# Sprite VM Structure + Memory System Redesign

**Date:** 2026-02-12 (revised, session 144)
**Status:** Ready for planning

---

## Problem

Two interrelated problems:

1. **Flat VM structure.** Everything on the Sprite lives at `/workspace/` — runtime code, user data, memory files, databases, venv all mixed together. No separation between "the operating system" and "user space." The agent is the OS, but the filesystem doesn't reflect that.

2. **Agents don't reliably save memory.** The main agent can't be trusted to call memory tools consistently — smaller models ignore instructions under load, context compaction loses unsaved learnings. The **memory passover problem**: when one context window ends and a new one starts, the new agent has no memory of what happened.

---

## Solution

### `.os/` Folder — Agent as Operating System

Introduce a `.os/` directory that separates system infrastructure from user space. The dot-prefix signals "don't touch" — like `.git/`. Everything the agent needs to function lives inside `.os/`. Everything the agent works WITH lives outside it.

### Daemon-Managed Memory — Zero Agent Responsibility

Remove all memory responsibility from the main agent. A background daemon (asyncio task, stateless Haiku calls) observes the conversation via SDK hooks, extracts learnings, and curates persistent memory files. The agent never writes to memory. The daemon solves the passover problem invisibly.

**The agent is a pure worker. Memory is infrastructure.**

---

## Architecture

### Sprite VM File Structure

```
/workspace/
├── .os/                              # THE OPERATING SYSTEM
│   ├── src/                          # Runtime code (deployed by Bridge)
│   │   ├── server.py                 # TCP server entry point
│   │   ├── gateway.py                # Message routing
│   │   ├── runtime.py                # Agent SDK wrapper
│   │   ├── protocol.py               # WS message types
│   │   ├── database.py               # SQLite wrapper
│   │   ├── tools/
│   │   │   └── canvas.py             # Canvas card CRUD
│   │   └── memory/
│   │       ├── loader.py             # System prompt assembly (boot sequence)
│   │       ├── processor.py          # Observation batch processor (Haiku calls)
│   │       └── hooks.py              # SDK hook callbacks
│   ├── memory/                       # All memory (daemon-managed)
│   │   ├── transcript.db             # Raw dialog (append-only, immutable)
│   │   ├── memory.db                 # Learnings archive (FTS5, searchable)
│   │   ├── soul.md                   # Personality, voice, character
│   │   ├── os.md                     # System rules, constraints, app identity
│   │   ├── tools.md                  # Learned capabilities, procedures
│   │   ├── files.md                  # Filesystem working set index
│   │   ├── user.md                   # User profile, preferences, history
│   │   └── context.md                # Active tasks, decisions, reminders
│   ├── .venv/                        # Python virtual environment
│   └── VERSION                       # Deploy version (for lazy updates)
│
├── documents/                        # USER SPACE — raw uploads
├── ocr/                              # Cached OCR text (by filename)
├── extractions/                      # Structured JSON per document
└── artifacts/                        # Agent exports, scripts, generated files
```

**Key principle:** `.os/` is the operating system, everything outside is user space. The agent works in user space; the OS runs underneath.

### No Documents Database

The filesystem IS the source of truth for user data. The agent has full filesystem access (Bash, Glob, Grep, Read, Write) — it doesn't need SQL to find files. The `files.md` memory file maintains a daemon-curated index of what's on disk.

### Two Databases (Separated Concerns)

| Database | Purpose | Access Pattern |
|----------|---------|----------------|
| `transcript.db` | Raw conversation turns (append-only, immutable) | Hooks write, daemon reads |
| `memory.db` | Extracted learnings + FTS5 search index | Daemon writes, agent reads via `search_memory()` |

**`transcript.db`** is the black box recorder — source of truth, never modified. You could wipe `memory.db` and rebuild it by reprocessing all observations from `transcript.db`.

**`memory.db`** is the knowledge base — structured learnings with confidence scores, searchable via FTS5.

### Memory Files (6 Files, Loaded on Boot)

| File | Owner | Turnover | Content |
|------|-------|----------|---------|
| `soul.md` | Deploy | Never | Who the AI is — personality, voice, character |
| `os.md` | Deploy | Never | What the AI does — system rules, constraints |
| `tools.md` | Daemon | Slow | What the AI can do — learned procedures, capabilities |
| `files.md` | Daemon | Medium | What the AI has — filesystem working set |
| `user.md` | Daemon | Medium | Who it's talking to — preferences, history |
| `context.md` | Daemon | High | What it's doing — active tasks, decisions, reminders |

All six files are loaded at session start as the boot sequence — like `/launch` loading context for a new Claude Code session. During the session, the conversation itself is the working memory. The daemon updates the files in the background so the next session boots with current state.

**Size limits force prioritization:**
- `soul.md` ≤200 lines (deploy-managed)
- `os.md` ≤200 lines (deploy-managed)
- `tools.md` ≤150 lines (daemon-curated)
- `files.md` ≤200 lines (daemon-curated)
- `user.md` ≤200 lines (daemon-curated)
- `context.md` ≤200 lines (daemon-curated)

When the daemon removes content from md files (no longer relevant), it still exists in `memory.db` as a learning. Nothing is truly lost — working context stays lean.

### SQLite Schemas

**transcript.db:**
```sql
observations (
    id INTEGER PRIMARY KEY,
    timestamp REAL,
    session_id TEXT,
    sequence_num INTEGER,
    user_message TEXT,
    tool_calls_json TEXT,
    agent_response TEXT,
    processed INTEGER DEFAULT 0
)

sessions (
    id TEXT PRIMARY KEY,
    started_at REAL,
    ended_at REAL,
    message_count INTEGER,
    observation_count INTEGER
)
```

**memory.db:**
```sql
learnings (
    id INTEGER PRIMARY KEY,
    created_at REAL,
    session_id TEXT,
    type TEXT,            -- FACT, PATTERN, CORRECTION, PREFERENCE, ACTION, TOOL_INSTALL
    content TEXT,
    source_observation_id INTEGER,
    confidence REAL
)

pending_actions (
    id INTEGER PRIMARY KEY,
    created_at REAL,
    content TEXT,
    priority INTEGER,
    status TEXT,           -- pending, completed, dismissed
    source_learning_id INTEGER
)

learnings_fts USING fts5(content, type)
```

### Observation Capture (Turn-Level)

One observation per agent turn (not per tool call). One turn = user message + all tool calls + agent's final response. This gives the daemon richer context and costs ~10x less than per-tool-call capture.

```
User sends message
  → UserPromptSubmit hook buffers user message (in memory)

Agent runs tool loop (N tool calls)
  → PostToolUse hook buffers each tool call summary (in memory)

Agent produces final response
  → Stop hook writes ONE observation to transcript.db:
    { user_message, tool_calls: [...], agent_response }
```

### Daemon Processing (Batch, Not Per-Turn)

The daemon does NOT process every turn in real-time. It accumulates observations and processes them in batches, giving Haiku much better context over the arc of a conversation.

**Three triggers:**

| Trigger | When | Why |
|---------|------|-----|
| Batch threshold | Every ~25 turns | Regular processing with full context |
| `PreCompact` hook | Context window about to compress | Flush before agent loses context |
| `Stop` hook (session end) | Agent session terminates | Catch any remaining observations |

```python
BATCH_THRESHOLD = 25
turn_count = 0

async def on_stop(hook_input, tool_use_id, context):
    """Fires after every agent turn. Counts turns, writes observation, triggers batch."""
    nonlocal turn_count
    turn_count += 1
    await write_observation_to_transcript_db()
    if turn_count >= BATCH_THRESHOLD:
        await processor.flush_all()
        turn_count = 0
    return {}

async def on_pre_compact(hook_input, tool_use_id, context):
    """Fires before context compaction. Emergency flush."""
    if hook_input["trigger"] == "auto":
        await processor.flush_all()
    return {}
```

### Daemon Is Stateless (No Inception Problem)

The daemon is NOT a conversational agent. Each batch processing call is a single, stateless Haiku API call:

```python
response = haiku(
    system="You are a memory curator. Extract learnings from these observations.",
    messages=[{
        "role": "user",
        "content": f"""
Current memory state:
{soul_md} {os_md} {tools_md} {files_md} {user_md} {context_md}

Observations (turns {start}-{end}):
{batch_of_observations}

Extract learnings. Update files if needed.
"""
    }]
)
```

One API call per batch. No conversation history. No context window to manage. The daemon reads the current md files every time — that's its "memory." Pure function: `process(current_state + observations) → updated_state`.

### Haiku Response Format

```
NONE                              → nothing notable
FACT: <content>                   → learning to memory.db
PATTERN: <content>                → learning to memory.db
CORRECTION: <content>             → learning to memory.db
PREFERENCE: <content>             → learning to memory.db
ACTION: <content>                 → pending_action for agent
TOOL_INSTALL: <content>           → learning to memory.db

TOOLS_MD_UPDATE:
<full updated tools.md content>

FILES_MD_UPDATE:
<full updated files.md content>

USER_MD_UPDATE:
<full updated user.md content>

CONTEXT_MD_UPDATE:
<full updated context.md content>
```

Haiku is instructed: "Extract NEW learnings only. When updating md files, output the complete file. Stay under the line limit. Prioritize: recent corrections > active tasks > active preferences > key facts > historical context. Remove contradicted or completed information."

### Self-Correcting Loop

Haiku will make mistakes. The system is resilient:

1. **transcript.db is immutable** — raw data never lost, can reprocess from scratch
2. **memory.db stores all learnings** — even ones removed from md files
3. **User corrections flow through the same pipeline** — "No, dates should be DD/MM/YYYY" becomes a CORRECTION learning that overwrites the bad info
4. **Worst case: rebuild** — wipe memory.db + md files, reprocess every observation from transcript.db

### Memory Passover Flow

```
Session N:
  Agent boots → loads 6 md files → knows everything
  Agent works → hooks capture turns → transcript.db
  Daemon processes batches → learnings → memory.db + updated md files
  Session ends → Stop hook flushes remaining

Session N+1:
  Agent boots → loads UPDATED 6 md files → knows everything from session N
  search_memory() available for deeper recall
  Agent just works. Never thinks about memory.
```

### Agent Memory Interface

The agent has exactly two memory interactions:

1. **Passive (automatic)** — 6 md files loaded at boot. No action needed.
2. **Active (on-demand)** — `search_memory(query, limit=10)` for deeper recall into memory.db. Read-only.

Zero write responsibility.

### SDK Hooks Used

| Hook | When | Action |
|------|------|--------|
| `UserPromptSubmit` | User sends message | Buffer user message in memory |
| `PostToolUse` | Agent uses a tool | Buffer tool call summary in memory |
| `Stop` | Agent finishes turn | Write observation to transcript.db, check batch threshold |
| `PreCompact` | Context about to compress | Emergency flush — process all pending observations |

All hooks return `{}` (passthrough) and wrap in try/except — never block the agent.

### Process Architecture

```
Sprite VM (single Python process)
├── server.py
│   ├── TCP server on :8765
│   ├── AgentRuntime (Claude Agent SDK)
│   │   ├── Canvas tools (create/update/close cards)
│   │   ├── search_memory tool (FTS5, read-only)
│   │   ├── NO memory write tools
│   │   └── Hooks: UserPromptSubmit, PostToolUse, Stop, PreCompact
│   └── ObservationProcessor
│       ├── Called by Stop hook (batch threshold reached)
│       ├── Called by PreCompact hook (emergency flush)
│       └── Stateless Haiku calls per batch
│
├── transcript.db (WAL mode, .os/memory/)
│   └── observations, sessions
│
└── memory.db (WAL mode, .os/memory/)
    ├── learnings, pending_actions
    └── learnings_fts (FTS5)
```

Everything is Python. Single process. No timer loop needed — hooks handle all triggers.

---

## Requirements

- [ ] `.os/` directory structure separates system from user space
- [ ] Two databases: transcript.db (raw, immutable) + memory.db (learnings, searchable)
- [ ] No documents database — filesystem is source of truth for user data
- [ ] 6 memory files loaded at session boot (soul, os, tools, files, user, context)
- [ ] soul.md and os.md are deploy-managed (Bridge writes on deploy)
- [ ] tools.md, files.md, user.md, context.md are daemon-curated
- [ ] Turn-level observations captured via hooks (one per agent turn)
- [ ] Batch processing (~25 turns) instead of per-turn processing
- [ ] PreCompact hook triggers emergency flush before context compaction
- [ ] Stop hook writes observations and checks batch threshold
- [ ] Daemon is stateless — single Haiku API call per batch, no conversation history
- [ ] search_memory tool gives agent FTS5 access to all historical learnings
- [ ] Main agent has zero memory write tools
- [ ] All new components have test coverage

---

## Non-Requirements

- Vector embeddings / ChromaDB (FTS5 is sufficient for MVP)
- Heartbeat / cron (post-MVP)
- Documents database or file metadata tracking (filesystem + files.md is enough)
- Timer-based daemon loop (hooks handle all triggers)
- Agent writing to any memory files (daemon manages all 4 curated files)
- Learnings consolidation / archival (tables grow cheaply, post-MVP cleanup)

---

## Constraints

- **Claude Agent SDK hooks**: UserPromptSubmit, PostToolUse, Stop, PreCompact confirmed. Hook callbacks are async Python, return dict.
- **Bridge API proxy**: Daemon calls Haiku via ANTHROPIC_BASE_URL pointing to Bridge proxy. Real API keys stay on Bridge (m7b.3.6).
- **SQLite WAL mode + busy_timeout=5000**: For concurrent access between hooks and processor within the same process.
- **Haiku cost**: ~$0.001-0.005 per batch (25 turns context). Much cheaper than per-turn.
- **Sprite sleep/wake**: Hooks and processor are asyncio — freeze with CRIU, resume on wake. No special handling.
- **File size limits**: Daemon must stay under line limits. Forces prioritization, not data loss.

---

## Success Criteria

- [ ] New session boots with full context from previous session (memory passover works)
- [ ] Agent never calls a memory write tool (pure worker)
- [ ] User corrections propagate to md files within one batch cycle
- [ ] search_memory returns relevant historical learnings
- [ ] transcript.db can be used to rebuild memory.db from scratch
- [ ] PreCompact flush prevents context loss on compaction
- [ ] `.os/` structure cleanly separates system from user space

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | VM file structure | `.os/` for system, top-level for user space |
| 2 | Documents database | None — filesystem is source of truth, files.md tracks index |
| 3 | Number of databases | Two: transcript.db (raw input) + memory.db (processed output) |
| 4 | Memory files | 6 files: soul.md, os.md, tools.md, files.md, user.md, context.md |
| 5 | File ownership | 2 deploy-managed (soul, os) + 4 daemon-curated (tools, files, user, context) |
| 6 | Processing model | Batch (~25 turns), not per-turn. Better context, cheaper. |
| 7 | Daemon triggers | Stop hook (batch threshold) + PreCompact hook (emergency flush) |
| 8 | Daemon state | Stateless — single Haiku call per batch, reads current md files each time |
| 9 | Agent memory access | Boot: 6 md files loaded. Runtime: search_memory() read-only. |
| 10 | Context.md ownership | Daemon-managed (not agent). Agent forgets to write; daemon observes and curates. |
| 11 | Timer loop | Not needed. Hooks cover all trigger cases. |
| 12 | soul.md vs os.md | Separate files. soul = personality/character, os = system rules/constraints. |

---

## Open Questions

1. **Batch threshold tuning** — Starting at 25 turns. More frequent processing means faster memory updates, slightly higher cost but still cheap. Tune based on real usage.
2. **Haiku prompt engineering** — The curator prompt needs careful crafting. What instructions produce the best learning extraction? Requires iteration.
3. **files.md update mechanism** — Does the daemon detect filesystem changes from observations alone (tool calls that write files), or does it also need to scan the filesystem periodically?

---

## Next Steps

1. Update the implementation plan (`plan.md`) to reflect new architecture
2. `/plan` to create Beads tasks for implementation
3. Update Bridge bootstrap to create `.os/` directory structure
4. Implement in order: schema → hooks → processor → loader → search_memory → bootstrap
