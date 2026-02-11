# Memory System Redesign — Workspace Daemon + Hook-Driven Capture

**Date:** 2026-02-10 (revised, session 142)
**Status:** Ready for planning

---

## Problem

Agents don't reliably save their own memory. The main agent can't be trusted to call memory tools consistently — smaller models ignore instructions under load, context compaction loses unsaved learnings, and Anthropic's native memory tool isn't available in the Agent SDK.

---

## Solution

Remove all memory responsibility from the main agent. A background process (the Workspace Daemon) captures everything automatically via SDK hooks, processes observations via Haiku, and curates persistent memory files.

**The agent is a pure worker. Memory is infrastructure.**

---

## Architecture

### Memory Files

```
/workspace/memory/
├── os.md        ≤200 lines  LOCKED. App system prompt. Deploy-managed.
├── tools.md     ≤150 lines  CURATED. Available capabilities. Haiku rewrites on installs.
└── user.md      ≤200 lines  CURATED. User profile + key facts. Haiku rewrites on updates.
```

| File | Analogy | Owner | Writable by |
|------|---------|-------|-------------|
| os.md | Identity | Deploy (us) | Nobody on Sprite |
| tools.md | Procedural memory | Daemon (Haiku) | Daemon rewrites, agent can also write |
| user.md | Working memory | Daemon (Haiku) | Daemon rewrites only |

**Size limits force prioritization.** Haiku must compress or drop less important content to stay within limits — like real memory. Nothing is truly lost; everything lives in the learnings table for recall via `search_memory`.

### Memory Layers

```
Always in context (system prompt):
  os.md + tools.md + user.md + learnings(48h) + pending_actions

On-demand (agent searches when needed):
  All historical learnings via search_memory tool (FTS5)
```

### SQLite Tables

```sql
observations (id, timestamp, session_id, sequence_num, user_message,
              tool_calls_json, agent_response, processed)

learnings (id, created_at, session_id, type, content,
           source_observation_id, confidence)

pending_actions (id, created_at, content, priority, status,
                 source_learning_id)

sessions (id, started_at, ended_at, message_count, observation_count)

learnings_fts (content, type)  -- FTS5 virtual table
```

### Observation Capture (Turn-Level)

Observations are captured per **agent turn**, not per tool call. One turn = one user message + all tool calls + agent's final response. This gives Haiku richer context and costs ~10x less than per-tool-call capture.

```
User sends message
  → UserPromptSubmit hook buffers user message (in memory)

Agent runs loop (N tool calls)
  → PostToolUse hook buffers each tool call summary (in memory)

Agent produces final response
  → ResultMessage handler writes ONE observation to SQLite:
    { user_message, tool_calls: [...], agent_response }
```

### Processing Loop

```
During session (real-time):
  Daemon (asyncio background task, every 2s):
    → Claims unprocessed observations
    → Calls Haiku with: os.md + tools.md + user.md + recent learnings + observation
    → Haiku extracts: FACT / PATTERN / PREFERENCE / ACTION / TOOL_INSTALL / NONE
    → Learnings → SQLite
    → USER_MD_UPDATE → rewrites user.md (not append)
    → TOOLS_MD_UPDATE → rewrites tools.md (not append)
    → ACTION → pending_actions table

End of session (guaranteed):
  Stop hook → processor.flush_remaining() → catches anything daemon missed
```

### Haiku Response Format

```
NONE                              → nothing notable
FACT: <content>                   → learning to SQLite
PATTERN: <content>                → learning to SQLite
CORRECTION: <content>             → learning to SQLite
PREFERENCE: <content>             → learning to SQLite
ACTION: <content>                 → pending_action for agent
TOOL_INSTALL: <content>           → learning to SQLite
USER_MD_UPDATE:
<full updated user.md content>
TOOLS_MD_UPDATE:
<full updated tools.md content>
```

Haiku is instructed: "Extract NEW learnings only. When updating user.md or tools.md, output the complete file. Stay under the line limit. Prioritize: recent corrections > active preferences > key facts > historical context. Remove contradicted information."

### Process Architecture

```
Sprite VM
├── server.py (main process)
│   ├── TCP server on :8765
│   ├── AgentRuntime (Claude Agent SDK)
│   │   ├── Canvas tools (create/update/close cards)
│   │   ├── search_memory tool (FTS5, read-only)
│   │   ├── NO memory write tools
│   │   └── Hooks: PostToolUse (buffer), UserPromptSubmit (buffer), Stop (flush)
│   ├── ObservationProcessor (shared module)
│   │   ├── Called by daemon loop (real-time)
│   │   └── Called by Stop hook (end-of-session flush)
│   └── Daemon loop (asyncio.Task, every 2s)
│       └── processor.process_batch()
│
└── SQLite (/workspace/agent.db, WAL mode)
    ├── observations, learnings, pending_actions, sessions
    └── learnings_fts (FTS5)
```

Everything is Python. Single process. No TypeScript, no Bun, no second process.

---

## Requirements

- [ ] Turn-level observations captured (one per agent turn, not per tool call)
- [ ] Daemon processes observations in real-time via Haiku (~2s latency)
- [ ] Stop hook flushes remaining observations at session end
- [ ] Haiku rewrites user.md/tools.md (not appends) with size limits
- [ ] Haiku receives existing memory files to prevent duplicate extraction
- [ ] Session start loads os.md + tools.md + user.md + learnings(48h) + pending_actions
- [ ] search_memory tool gives agent FTS5 access to all historical learnings
- [ ] Main agent has zero memory write tools
- [ ] os.md is locked/deploy-managed
- [ ] All new components have test coverage

## Non-Requirements

- Vector embeddings / ChromaDB (FTS5 is sufficient for MVP)
- Heartbeat / cron (post-MVP, lives on Bridge not Sprite)
- Mid-session context injection (learnings consumed at session start only)
- Learnings consolidation / archival (table grows cheaply, post-MVP cleanup)
- Canvas-to-file sync (post-MVP)
- Pre-compaction flush (SDK doesn't expose compaction controls)

---

## Constraints

- **Claude Agent SDK hooks**: PostToolUse, UserPromptSubmit, Stop confirmed. Hook callbacks are async Python, return dict.
- **Bridge API proxy**: Daemon calls Haiku via ANTHROPIC_BASE_URL pointing to Bridge proxy. Real API keys stay on Bridge.
- **SQLite WAL mode + busy_timeout=5000**: For concurrent access between hooks and daemon within the same process.
- **Haiku cost**: ~$0.0003 per observation (500 input + 200 output tokens). ~$0.003 per session (10 turns). Effectively free.
- **Sprite sleep/wake**: Daemon is an asyncio task — freezes with CRIU, resumes on wake. No special handling needed.

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Daemon language | Python (not TypeScript). Writing from scratch, not forking claude-mem. Single language stack. |
| 2 | Daemon process model | asyncio background task in server.py (not separate process). ~15 lines. |
| 3 | Observation granularity | Turn-level (one per user message + agent response). Not per tool call. |
| 4 | Memory file updates | Haiku rewrites entire file (not appends). Prevents contradictions, maintains structure. |
| 5 | File size limits | os.md ≤200, tools.md ≤150, user.md ≤200 lines. Forces prioritization. |
| 6 | File structure | os.md (locked) + tools.md (capabilities) + user.md (user profile). Replaces single soul.md. |
| 7 | Deep memory access | search_memory tool (FTS5) for historical learnings beyond 48h window. Read-only. |
| 8 | Inter-agent comms | One-way pending_actions table (daemon→agent). |
| 9 | API access | Existing Bridge API proxy (m7b.3.6). No new infrastructure. |
| 10 | Failure handling | Exponential backoff + 6h staleness cutoff. Observations queue in SQLite if API unavailable. |
