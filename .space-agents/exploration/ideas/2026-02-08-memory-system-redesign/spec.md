# Exploration: Memory System Redesign — Workspace Daemon + Hook-Driven Capture

**Date:** 2026-02-09 (revised from 2026-02-08)
**Status:** Needs discussion (inter-agent comms mechanism tabled)

---

## Problem

The Sprite agent's memory system relies on the agent voluntarily saving its own memory — and this doesn't work.

**Agents don't reliably follow memory instructions.** The main agent (potentially Haiku 4.5) cannot be trusted to consistently call memory tools, especially as context grows longer and instruction-following degrades. The original spec (v1) proposed 6 custom memory tools and soul.md guidance teaching the agent when to save. In practice, smaller models ignore these instructions under load.

**Information loss on compaction.** The Claude Agent SDK compacts conversation context when it grows too large. Without a mechanism to persist learnings before compaction, everything the agent learned during the session is lost. The original spec proposed a PreCompact hook, but this is unverified with the persistent `ClaudeSDKClient` and still relies on the agent cooperating with the save instruction.

**No workspace consistency.** The agent creates canvas cards showing extraction results, but the underlying workspace files may not reflect the same state. If the agent updates a canvas card but doesn't update the corresponding markdown file, the workspace drifts. There is no background process to maintain consistency.

**Native memory tool is unavailable.** Anthropic's `memory_20250818` tool (announced 2025) is only available through the base `anthropic` Python SDK, not the Claude Agent SDK (`claude-agent-sdk`). GitHub Issue #552 is open with no response. Adopting it would mean losing the Agent SDK's full toolset (Bash, Read, Write, Glob, Grep, WebSearch, subagents, MCP, hooks).

**Research inputs:**
- OpenClaw memory architecture (`docs/research/openclaw-memory-architecture.md`): "Context is RAM, disk is truth." Pre-compaction flush is critical. Agent writes its own summaries.
- claude-mem plugin (github.com/thedotmack/claude-mem, 25k+ stars): Hook-driven automatic capture via PostToolUse. Background worker processes observations via Claude Agent SDK. Progressive disclosure for retrieval. System captures, agent doesn't need to cooperate.
- Anthropic Memory Tool docs (platform.claude.com): Native CRUD memory with context management. Not available in Agent SDK.

---

## Solution

**Remove all memory responsibility from the main agent. Offload everything to a background Workspace Daemon.**

The main agent has zero memory tools. It talks to the user, creates canvas cards, extracts data from documents — nothing else. It doesn't know how to save memory and doesn't need to.

A second agent — the **Workspace Daemon** — runs as a background process on the same Sprite VM. It watches everything the main agent does via SDK hooks (PostToolUse, UserPromptSubmit), processes observations in real-time using Haiku, and maintains both memory and workspace consistency.

The design principle is: **the system captures automatically (hooks), the daemon provides intelligence (Haiku processing), and the main agent is a pure worker (zero memory overhead).**

This inverts both the OpenClaw and claude-mem models:
- OpenClaw trusts the agent to write its own summaries. We don't trust it.
- claude-mem captures automatically but still gives the agent a `save_memory` tool. We give it nothing.
- Our model: the agent IS the worker. Memory is infrastructure. The daemon IS the memory system.

---

## Requirements

- [ ] PostToolUse hook captures every tool call (name, input, output) to SQLite observations table
- [ ] UserPromptSubmit hook captures every user message to SQLite observations table
- [ ] Workspace Daemon runs as a background TypeScript/Bun process on the Sprite VM (forked from claude-mem)
- [ ] Daemon processes every observation in real-time via Haiku 4.5 API calls
- [ ] Daemon extracts structured learnings (facts, patterns, corrections, preferences) → SQLite learnings table
- [ ] Daemon detects user preference changes and writes updates to user.md
- [ ] Daemon syncs canvas card state to corresponding workspace files
- [ ] Daemon maintains workspace consistency (file ↔ canvas, folder organization)
- [ ] Daemon performs simple factual sync silently (file writes, user.md, learnings)
- [ ] Daemon queues complex judgment calls for the main agent (e.g., "update extraction rules?")
- [ ] Session start loads soul.md + user.md + last 48h of learnings into system prompt
- [ ] Main agent has ZERO memory tools — all memory management removed
- [ ] Main agent's soul.md describes the daemon's existence and role
- [ ] soul.md template includes Autonomy Rules and Tool Guidance sections
- [ ] soul.md remains read-only (deploy-managed, not agent-writable)
- [ ] All existing memory tests adapted for new architecture
- [ ] New components have test coverage

---

## Non-Requirements

- Not implementing Anthropic's native `memory_20250818` tool — unavailable in Agent SDK (Issue #552)
- Not implementing `context_management.edits` — unavailable in Agent SDK
- Not implementing progressive disclosure / search for memory retrieval — post-MVP (learnings injected directly)
- Not implementing heartbeat / periodic reflection — post-MVP
- Not implementing inactivity flush timer — daemon captures continuously, no flush needed
- Not implementing vector embeddings / ChromaDB — SQLite FTS5 is sufficient for MVP
- Not implementing the daemon's canvas access — daemon writes files only, canvas is main agent's domain
- Not implementing inter-agent communication mechanism beyond simple queue — tabled during brainstorm
- Not implementing memory file rotation/archiving — learnings in SQLite, manageable via queries
- Not changing the memory loader pattern (loader.py) — extend it to query SQLite learnings

---

## Architecture

### System Overview

```
Sprite VM (/workspace/)
│
├── Main Agent Process (Haiku or Sonnet)
│   ├── WebSocket connection to Bridge (user chat)
│   ├── Tools: canvas, bash, read, write, grep, glob, etc.
│   ├── NO memory tools
│   ├── System prompt: soul.md + user.md + recent learnings + pending actions
│   └── SDK hooks: PostToolUse → observations, UserPromptSubmit → observations
│
├── Workspace Daemon Process (TypeScript/Bun, forked from claude-mem)
│   ├── Watches SQLite observations table for new entries
│   ├── Processes each observation via Haiku 4.5 API call (@anthropic-ai/sdk)
│   ├── Writes learnings to SQLite learnings table
│   ├── Updates user.md when preferences detected
│   ├── Syncs canvas state → workspace files
│   ├── Queues complex decisions for main agent
│   └── Runs continuously while Sprite is awake
│
├── SQLite Database (/workspace/data/memory.db)
│   ├── observations    — raw hook captures (tool calls + user messages)
│   ├── learnings       — structured extractions (facts, patterns, corrections)
│   ├── sessions        — session metadata (start, end, message count)
│   └── pending_actions — queued items for main agent attention
│
└── Filesystem
    ├── /workspace/memory/
    │   ├── soul.md        — READ-ONLY, deploy-managed (identity + rules)
    │   └── user.md        — DAEMON-MANAGED (user preferences)
    ├── /workspace/documents/  — user uploads
    ├── /workspace/ocr/        — OCR text cache
    └── /workspace/projects/   — organized workspace (daemon-maintained)
```

### Hook Capture (PostToolUse + UserPromptSubmit)

```python
# Registered with ClaudeAgentOptions in runtime.py

async def capture_tool_use(tool_name, tool_input, tool_result, session_id):
    """PostToolUse hook — captures every tool call to SQLite."""
    await db.insert("observations", {
        "timestamp": time.time(),
        "session_id": session_id,
        "type": "tool_call",
        "tool_name": tool_name,
        "input_summary": truncate(json.dumps(tool_input), 2000),
        "result_summary": truncate(str(tool_result), 2000),
    })

async def capture_user_message(message, session_id):
    """UserPromptSubmit hook — captures every user message to SQLite."""
    await db.insert("observations", {
        "timestamp": time.time(),
        "session_id": session_id,
        "type": "user_message",
        "content": truncate(message, 2000),
    })
```

### Daemon Processing (Real-Time, TypeScript)

The daemon (forked from claude-mem's worker service) polls the observations table for new entries. For each observation, it calls Haiku with a sliding window of recent context:

```typescript
// Pseudocode — daemon processing loop (TypeScript/Bun)

async function processObservation(observation: Observation, recentContext: Observation[]) {
  const prompt = `You are a memory extraction agent. Analyze this interaction
    and extract any valuable learnings.

    Recent conversation context:
    ${formatContext(recentContext)}

    Current observation:
    ${formatObservation(observation)}

    Extract:
    - FACTS: Important information learned (names, numbers, rules)
    - PATTERNS: Corrections or repeated behaviors (user always wants X)
    - PREFERENCES: User preferences for how things should be done
    - ACTIONS: Things that need follow-up or workspace sync

    If nothing notable, respond with NONE.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const learnings = parseLearnings(response);
  for (const learning of learnings) {
    db.run("INSERT INTO learnings (type, content, ...) VALUES (?, ?, ...)", ...);
  }

  // If preference detected, update user.md
  if (learnings.some(l => l.type === "preference")) {
    await updateUserMd(learnings);
  }

  // If workspace sync needed, perform it
  if (learnings.some(l => l.type === "action")) {
    await syncWorkspace(learnings);
  }
}
```

**Cost per observation:** ~500 input tokens + ~100 output tokens = ~$0.0001 with Haiku 4.5.
**Cost per session (20 tool calls):** ~$0.002. Effectively free.

### Daemon Responsibilities — Silent vs Queued

| Action | Daemon handles silently | Queued for main agent |
|--------|------------------------|-----------------------|
| Extract learning → SQLite | Yes | — |
| Update user.md with preference | Yes | — |
| Sync canvas card → workspace file | Yes | — |
| Create missing folder structure | Yes | — |
| "Document X never processed" | — | Yes |
| "10 corrections suggest rule change" | — | Yes |
| "Workspace has duplicate projects" | — | Yes |
| "Extraction rules may need updating" | — | Yes |

### Session Start — Context Injection

```python
# Updated loader.py

def load_memory():
    """Assemble system prompt from memory sources."""
    sections = []

    # 1. soul.md — identity and rules (always)
    sections.append(read_file("soul.md"))

    # 2. user.md — user preferences (always)
    sections.append(read_file("user.md"))

    # 3. Recent learnings from SQLite (last 48 hours)
    learnings = db.query("""
        SELECT type, content, created_at
        FROM learnings
        WHERE created_at > datetime('now', '-48 hours')
        ORDER BY created_at DESC
        LIMIT 50
    """)
    if learnings:
        sections.append(format_learnings(learnings))

    # 4. Pending actions from daemon
    pending = db.query("""
        SELECT content, priority
        FROM pending_actions
        WHERE status = 'pending'
        ORDER BY priority ASC
    """)
    if pending:
        sections.append(format_pending_actions(pending))

    return "\n\n---\n\n".join(sections)
```

### soul.md Template (Revised)

```markdown
# Stack Identity

## Purpose
This stack has not been configured yet. Ask the user what this stack is for.

## Extraction Rules
No extraction rules configured. When the user uploads documents, ask what
data they want extracted and update these rules.

## Your Daemon

You have a background process called the Workspace Daemon that runs alongside
you. It watches everything you do and handles:
- Extracting learnings from your work (facts, patterns, corrections)
- Keeping user preferences up to date (user.md)
- Syncing your canvas output to workspace files
- Flagging things that need your attention

You don't need to manage memory — the daemon handles it automatically.
If the daemon has flagged items for your attention, they'll appear in your
context at session start under "Pending Actions."

## Autonomy Rules
What you can do without asking:
- Organize uploaded files into appropriate folders
- Create canvas cards to display results
- Read any file in /workspace/
- Run extraction on uploaded documents

What requires user confirmation:
- Deleting any file or folder
- Sending data outside the workspace
- Changing extraction rules (update this section)
- Any action you're uncertain about

## Tool Guidance

### Canvas Cards
Available card types: `notes`
Block format: `[{"type": "text", "content": "markdown content here"}]`
- Use a single text block with rich markdown (headers, lists, code fences)
- Do NOT use block types: header, code, status (these are not valid)
- The content field supports full markdown rendering
```

### SQLite Schema

```sql
-- Raw observations captured by hooks
CREATE TABLE observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL,           -- 'tool_call' | 'user_message'
    tool_name TEXT,               -- for tool_call type
    input_summary TEXT,           -- truncated tool input
    result_summary TEXT,          -- truncated tool result
    content TEXT,                 -- for user_message type
    processed INTEGER DEFAULT 0  -- daemon marks as processed
);

-- Structured learnings extracted by daemon
CREATE TABLE learnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    session_id TEXT,
    type TEXT NOT NULL,           -- 'fact' | 'pattern' | 'correction' | 'preference'
    content TEXT NOT NULL,        -- human-readable learning
    source_observation_id INTEGER REFERENCES observations(id),
    confidence REAL DEFAULT 1.0  -- daemon's confidence in this learning
);

-- Queued items for main agent attention
CREATE TABLE pending_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    content TEXT NOT NULL,
    priority INTEGER DEFAULT 2,  -- 0=urgent, 1=high, 2=normal
    status TEXT DEFAULT 'pending', -- 'pending' | 'dismissed' | 'acted_on'
    source_learning_id INTEGER REFERENCES learnings(id)
);

-- Session metadata
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    message_count INTEGER DEFAULT 0,
    observation_count INTEGER DEFAULT 0
);

-- FTS5 index for learnings search (post-MVP enhancement)
CREATE VIRTUAL TABLE learnings_fts USING fts5(content, type);
```

### Data Flow

```
Session Start:
  loader.py loads soul.md + user.md + last 48h learnings + pending actions
  → Injected into system prompt
  → Agent starts with full context of identity + recent memory + daemon flags

During Session:
  User sends message → UserPromptSubmit hook → observation to SQLite
  Agent calls tool → PostToolUse hook → observation to SQLite
  Daemon picks up observation → calls Haiku → extracts learnings
  Daemon detects preference → updates user.md silently
  Daemon detects sync needed → writes workspace file silently
  Daemon detects complex issue → queues pending_action for agent
  (All happens in background, main agent unaware)

Session End (Stop hook):
  Mark session as ended in sessions table
  Daemon processes any remaining observations

Next Session:
  loader.py loads fresh soul.md + user.md + new learnings
  Agent sees pending_actions from daemon
  Seamless continuity — agent never saved anything, but memory persists
```

### Process Architecture

```
┌──────────────────────────────────────┐
│ systemd / supervisor (process mgr)   │
├──────────────────────────────────────┤
│                                      │
│  ┌─────────────────────────────┐     │
│  │ Main Agent (server.py)      │     │
│  │ - WebSocket server :8765    │     │
│  │ - Claude Agent SDK          │     │
│  │ - PostToolUse hook ─────┐   │     │
│  │ - UserPromptSubmit hook─┤   │     │
│  └─────────────────────────┼───┘     │
│                            │         │
│                   SQLite DB│         │
│                   (shared) │         │
│                            │         │
│  ┌─────────────────────────┼───┐     │
│  │ Workspace Daemon (TS/Bun) │  │     │
│  │ - Forked from claude-mem  │  │     │
│  │ - Polls observations ◄──┘  │     │
│  │ - Haiku API calls          │     │
│  │ - File I/O (user.md, sync) │     │
│  │ - Pending action queue     │     │
│  └────────────────────────────┘     │
│                                      │
└──────────────────────────────────────┘
```

---

## Constraints

- **Claude Agent SDK hooks** — PostToolUse and UserPromptSubmit hooks are confirmed available in the SDK. Must verify exact hook signatures and data passed to handlers.
- **Haiku API key on Sprite** — The daemon needs an Anthropic API key to call Haiku. Current architecture proxies API keys through Bridge (security — m7b.3.6). Daemon may need its own key or a proxy endpoint.
- **SQLite concurrent access** — Main agent (hooks writing observations) and daemon (reading observations, writing learnings) access the same DB. SQLite handles this with WAL mode, but must enable it explicitly.
- **Bun runtime on Sprite** — Daemon runs on Bun (TypeScript). Must install Bun during Sprite bootstrap (`curl -fsSL https://bun.sh/install | bash`). Bun handles SQLite natively via `bun:sqlite`.
- **Sprite sleep/wake** — Daemon process must survive checkpoint/CRIU sleep (same as main agent server). Start via `exec` with `max_run_after_disconnect=0`.
- **Existing test infrastructure** — `sprite/tests/test_memory_system.py` (5 tests) and `test_memory_tools.py` (6 tests) must be adapted. Memory tools tests will largely be deleted (no more agent memory tools). Loader tests need updating for SQLite learnings.
- **Bootstrap sequence** — Daemon must start after SQLite DB is initialized. New Sprites need schema migration on first boot.
- **soul.md template** — Python string constant `SOUL_TEMPLATE` in `memory/__init__.py`. Update in place.
- **MEMORY.md file** — Replaced by SQLite learnings table. `ensure_templates()` no longer creates MEMORY.md. Loader no longer reads it.
- **Journals directory** — Replaced by SQLite sessions + learnings. `journal.py` module can be removed or repurposed for daemon summaries.

---

## Success Criteria

- [ ] PostToolUse hook fires on every tool call and writes observation to SQLite
- [ ] UserPromptSubmit hook fires on every user message and writes observation to SQLite
- [ ] Daemon process starts as a background task on the Sprite and runs continuously
- [ ] Daemon processes observations in real-time via Haiku API calls
- [ ] Daemon extracts facts, patterns, corrections, and preferences from observations
- [ ] Daemon updates user.md when user preferences are detected
- [ ] Daemon syncs canvas card updates to corresponding workspace files
- [ ] Daemon queues complex decisions as pending_actions for main agent
- [ ] Session start injects soul.md + user.md + last 48h learnings + pending actions
- [ ] Main agent has no memory tools — `create_memory_tools()` removed or returns empty list
- [ ] Main agent's soul.md describes the daemon and its role
- [ ] Agent can see and act on pending_actions from daemon
- [ ] After context compaction, agent retains knowledge via daemon-persisted learnings
- [ ] Daemon cost per session is under $0.01 (Haiku processing)
- [ ] SQLite database uses WAL mode for concurrent access
- [ ] Daemon survives Sprite sleep/wake cycles
- [ ] All adapted tests pass, new components have test coverage

---

## Open Questions

1. **Inter-agent communication mechanism** — How do the main agent and daemon communicate beyond the pending_actions queue? Options discussed: filesystem inbox (markdown files), SQLite message queue, or both. **Tabled during brainstorm — implement simple pending_actions table first, revisit if needed.**

2. **API key for daemon** — Current architecture avoids injecting API keys into Sprites (prompt injection risk, m7b.3.6). The daemon needs to call Haiku. Options: (a) proxy through Bridge, (b) separate restricted API key for daemon only, (c) inject key since daemon is server-side code, not agent-accessible. Needs security review.

3. **Daemon observation context window** — To detect corrections and preferences, the daemon needs context beyond a single observation. How many recent observations should be included in each Haiku call? Proposed: sliding window of last 5-10 events. Needs tuning.

4. **Canvas ↔ file sync mapping** — How does the daemon know which workspace file corresponds to a canvas card? Options: (a) convention-based (card title → file path), (b) explicit mapping table in SQLite, (c) daemon infers from context. Needs design.

5. **Proactive maintenance scope** — The daemon should flag orphaned documents and maintain folder structure, but the exact rules need definition. What triggers a "document never processed" alert? How aggressively should the daemon organize files? Needs use-case examples.

6. **Daemon failure handling** — What happens if the daemon crashes or Haiku API is down? Observations queue up in SQLite. Daemon should resume processing on restart. But how long can the backlog grow? Should there be a max observation age before they're skipped?

---

## Reference Implementation: claude-mem

**Repository:** [github.com/thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) (25k+ stars)
**License:** Open source

claude-mem is the closest existing implementation to this spec. It implements hook-driven capture, background worker processing, SQLite + FTS5 storage, and progressive disclosure — all as a Claude Code plugin.

**Implementation approach:** Fork claude-mem and adapt it to run as the Workspace Daemon on Sprites. **The daemon stays in TypeScript/JavaScript** — only the hook capture layer is Python (it's part of the Agent SDK). The two communicate via SQLite, so the language boundary is clean.

```
Python (Agent SDK)              SQLite              TypeScript (Daemon)
                                  │
PostToolUse hook ──writes──►  observations  ──reads──► claude-mem worker
UserPromptSubmit ──writes──►  table          ──writes──► learnings table
                                  │                ──writes──► user.md
loader.py ◄──────reads──────  learnings       ──writes──► workspace files
                              pending_actions
```

**What to keep from claude-mem (already written):**
- Worker processing loop (polling, batching, error handling)
- SQLite schema design (sessions, observations tables — adapt for our learnings table)
- FTS5 search setup (virtual table configuration, query patterns)
- AI processing prompts (extracting learnings from raw tool calls)
- Session lifecycle management (start, active, end states)
- SQLite via `bun:sqlite` driver (fast, native)

**What to adapt:**
- Observation schema: claude-mem's hook format → our PostToolUse/UserPromptSubmit format
- Output tables: add `learnings` and `pending_actions` tables (claude-mem only has observations + summaries)
- Storage path: `~/.claude-mem/` → `/workspace/data/memory.db`
- AI model: claude-mem uses Agent SDK for processing → we use direct Haiku API calls via `@anthropic-ai/sdk`
- Add workspace sync logic (canvas → files) — new capability not in claude-mem
- Add pending actions queue for main agent — new capability not in claude-mem
- Remove `save_memory` MCP tool — agent gets no memory tools

**What to remove:**
- Express.js HTTP API (10 endpoints) — daemon doesn't need an API, it shares SQLite directly
- Viewer UI (React web interface) — not needed for Sprite
- MCP tool registration — we inject learnings into system prompt directly, no search tools for MVP
- ChromaDB vector store — SQLite FTS5 is sufficient
- Smart install pre-hook — we control the Sprite environment
- 6 lifecycle hook scripts — replaced by 2 Python SDK hooks (PostToolUse + UserPromptSubmit)
- Context injection hook — replaced by Python loader.py reading from SQLite

**Runtime:** Bun on Sprite VM (lightweight, already handles SQLite natively). Install during bootstrap.

---

## Next Steps

1. Resolve API key question (Open Question 2) — this may affect Bridge architecture
2. Fork claude-mem repo, study the hook capture and worker processing code in detail
3. `/plan` to create implementation tasks from this spec
4. Build daemon as a standalone Python process first, test observation processing in isolation
5. Integrate hooks with existing runtime.py
6. Update loader.py to query SQLite learnings instead of MEMORY.md
7. Deploy to test Sprite and validate end-to-end: user chat → hook capture → daemon processing → learnings injection
