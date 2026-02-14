# CLAUDE.md — Sprite Runtime

This file provides guidance to Claude Code when working with the Sprite runtime codebase.

---

## What is the Sprite Runtime?

Each Stackdocs user gets one persistent microVM (Sprite) running a Python WebSocket server. The server hosts a Claude Agent SDK-powered agent with:
- Full tool access (Bash, Read, Write, Glob, Grep, WebSearch, etc.)
- Canvas tools (create/update/close windows)
- Memory system that learns from conversations
- Three SQLite databases for workspace state, memory, and conversation logs

**Mental model:** The agent IS the operating system for a user's workspace. Users talk to the agent via chat, and the agent organizes information visually on a Canvas.

---

## Architecture

```
Bridge (Fly.io) ←→ TCP Proxy API ←→ Sprite Runtime (Sprites.dev VM)
                                     │
                                     ├─ WebSocket Server (port 8765)
                                     ├─ SpriteGateway (message router)
                                     ├─ AgentRuntime (Claude Agent SDK)
                                     ├─ Canvas Tools (create/update/close cards)
                                     ├─ Memory System (learnings + observations)
                                     └─ SQLite DBs (workspace, memory, transcript)
```

**Key Behavior:** Sprite VMs use CRIU checkpointing. On sleep, processes are frozen (same PID on wake). TCP connections die but the Python process persists indefinitely through sleep/wake cycles.

---

## Codebase Structure

```
sprite/
├── src/
│   ├── server.py            # TCP server on port 8765, graceful shutdown
│   ├── gateway.py           # SpriteGateway routes messages by type
│   ├── runtime.py           # AgentRuntime wraps Claude Agent SDK
│   ├── protocol.py          # Python dataclasses (mirror of bridge/src/protocol.ts)
│   ├── database.py          # TranscriptDB, MemoryDB, WorkspaceDB (aiosqlite)
│   ├── state_sync.py        # Builds StateSyncMessage on TCP connect
│   ├── tools/
│   │   ├── canvas.py        # Tool factory: create_canvas_tools()
│   │   └── memory.py        # Tool factory: create_memory_tools()
│   └── memory/
│       ├── loader.py        # Load 6 markdown files into system prompt
│       ├── hooks.py         # TurnBuffer + SDK hook callbacks
│       ├── processor.py     # ObservationProcessor (batch learnings extraction)
│       └── __init__.py      # Convenience exports
├── tests/                   # pytest tests with aiosqlite mocks
├── memory/                  # Template markdown files (bootstrap reference)
├── templates/               # Jinja2 templates (unused MVP)
├── requirements.txt         # Python dependencies
└── pyproject.toml           # pytest config
```

---

## Key Files

### server.py (131 lines)
Entry point. Asyncio TCP server listens on port 8765 for Bridge connections via TCP Proxy.

- **Runtime scoping:** AgentRuntime is scoped to the SERVER, NOT the connection. This preserves conversation context across TCP reconnections (sleep/wake, page reload).
- **Connection handler:** Creates new Gateway + send_fn per connection, updates runtime's send_fn.
- **State sync:** Sends `state_sync` message on connect (all stacks/cards/chat).
- **Databases:** TranscriptDB, MemoryDB, WorkspaceDB initialized at server startup.
- **Graceful shutdown:** SIGTERM/SIGINT handled via asyncio.Future.

### gateway.py (179 lines)
Routes parsed JSON messages to handlers by type.

- **Serial execution:** `mission` and `heartbeat` share an async lock (only one at a time).
- **Parallel execution:** `canvas_interaction`, `file_upload`, `auth`, `system` run concurrently.
- **Ping handling:** Silently dropped (no response).
- **Canvas interactions:** Handled directly by Gateway (no agent needed for archive/create/restore stack).
- **Mission flow:** Validates message → sends ack → persists to chat → calls `runtime.handle_message()`.

### runtime.py (282 lines)
Wraps Claude Agent SDK, streams `agent_event` messages back.

- **Persistent client:** ClaudeSDKClient created on first message, reused for multi-turn conversation.
- **Session lifecycle:** `_start_session()` creates client + loads memory → `_continue_session()` reuses client.
- **Streaming:** Maps SDK messages (AssistantMessage, ResultMessage) to `agent_event` WebSocket messages.
- **Tool registration:** Canvas + memory tools registered via single MCP server (`sprite`).
- **Hooks:** TurnBuffer captures observations → written to TranscriptDB → triggers batch processing every 25 turns.
- **SDK config:** `permission_mode="bypassPermissions"` and `cwd="/workspace"` required for headless operation.

### protocol.py (671 lines)
Python dataclasses mirroring `bridge/src/protocol.ts` (TypeScript source of truth).

- **Message types:** MissionMessage, AgentEvent, CanvasUpdate, StateSyncMessage, etc.
- **Block types:** TextBlock, TableBlock, DocumentBlock, NoteBlock.
- **Type guards:** `is_websocket_message()`, `is_canvas_block()`.
- **Serialization:** `to_json()` helper for outbound messages.

### database.py (302 lines)
Three async SQLite databases using aiosqlite.

#### TranscriptDB (`/workspace/.os/memory/transcript.db`)
Append-only conversation log. Hooks write observations, daemon reads for batch processing.

- **Tables:** `observations` (user message, tool calls, agent response), `sessions` (metadata).
- **Access:** Hooks write, ObservationProcessor reads.

#### MemoryDB (`/workspace/.os/memory/memory.db`)
Searchable learnings archive with FTS5 virtual table.

- **Tables:** `learnings` (extracted facts/procedures), `learnings_fts` (full-text search), `pending_actions` (todo items).
- **Access:** ObservationProcessor writes, agent reads via `search_memory` tool.

#### WorkspaceDB (`/workspace/.os/workspace.db`)
Stacks, cards, and chat messages.

- **Tables:** `stacks`, `cards`, `chat_messages`.
- **Access:** Gateway writes (canvas interactions, chat), agent reads/writes via canvas tools.
- **Methods:** `create_stack()`, `list_stacks()`, `archive_stack()`, `restore_stack()`, `upsert_card()`, `archive_card()`, `add_chat_message()`, `get_chat_history()`.

---

## Memory System

### Filesystem Layout (`/workspace/.os/memory/`)
```
/workspace/.os/memory/
├── transcript.db      # Append-only conversation log
├── memory.db          # Extracted learnings (FTS5)
├── soul.md            # Stack identity (deploy-managed)
├── os.md              # System rules (deploy-managed)
├── tools.md           # Learned procedures (daemon-managed)
├── files.md           # File index (daemon-managed)
├── user.md            # User preferences (daemon-managed)
└── context.md         # Active context (daemon-managed)
```

### Memory Files
- **Deploy-managed:** `soul.md`, `os.md` — set by Bridge bootstrap, never changed by daemon.
- **Daemon-managed:** `tools.md`, `files.md`, `user.md`, `context.md` — auto-updated by ObservationProcessor every 25 turns.

### Memory Pipeline
1. **Hooks capture observations** (user message → tool calls → agent response) → written to `transcript.db`.
2. **Every 25 turns:** `on_pre_compact` hook triggers batch processing.
3. **ObservationProcessor** reads unprocessed observations → calls Haiku to extract learnings → writes to `memory.db`.
4. **Daemon updates markdown files** (`tools.md`, `files.md`, `user.md`, `context.md`) from learnings.
5. **Next session:** `loader.py` loads all 6 markdown files into system prompt.

### Hooks (`memory/hooks.py`)
- **TurnBuffer:** Captures user messages + tool calls + agent responses (cleared on Stop hook).
- **Hooks:** `on_user_prompt_submit`, `on_post_tool_use`, `on_stop`, `on_pre_compact`.
- **Batch threshold:** 25 turns (configurable).

### Processor (`memory/processor.py`)
- **ObservationProcessor:** Stateless per batch.
- **LLM:** Uses Haiku (cheap, ~$0.0001/observation).
- **Extracts:** Procedures (tools.md), file paths (files.md), user prefs (user.md), active context (context.md).

---

## Tool Factory Pattern

Tools use factory functions to scope database access per request:

```python
from claude_agent_sdk import tool

def create_canvas_tools(send_fn, workspace_db, stack_id):
    """Factory creates tools scoped to specific stack."""

    @tool("create_card", "Create a new card on the active stack")
    async def create_card(args: dict) -> dict:
        title = args.get("title")
        blocks = args.get("blocks", [])
        # All queries locked to stack_id — agent cannot override
        card = await workspace_db.upsert_card(card_id, stack_id, title, blocks)
        # Send CanvasUpdateMessage to frontend
        await send_fn(to_json(canvas_update_message))
        return {"content": [{"type": "text", "text": f"Card created: {title}"}]}

    return [create_card, update_card, close_card]
```

**Why factories?** Each connection has different `send_fn` and `stack_id`. Tools are created fresh per session.

---

## Testing

**Framework:** pytest with async fixtures.

**Mock pattern:** Use aiosqlite in-memory databases (`:memory:`) for isolated tests.

```python
@pytest.fixture
async def workspace_db():
    db = WorkspaceDB(":memory:")
    await db.connect()
    yield db
    await db.close()
```

**Run tests:** `pytest tests/`

---

## Key Patterns

### Server Persistence
Server persists through Sprite sleep/wake (CRIU checkpoint). Same PID on wake. TCP connections die but process survives.

### Connection Lifecycle
1. Bridge connects via TCP Proxy → `handle_connection()` called.
2. Gateway routes messages → `mission` goes to AgentRuntime.
3. AgentRuntime streams `agent_event` messages back.
4. Connection closes (sleep/wake/user disconnect) → Gateway cleaned up, Runtime persists.
5. New connection arrives → Runtime's send_fn updated, conversation context preserved.

### Message Flow
```
User types in chat
  ↓
Bridge sends MissionMessage
  ↓
Gateway routes to _handle_mission()
  ↓
AgentRuntime.handle_message()
  ↓
Claude Agent SDK (tools, multi-turn)
  ↓
AgentRuntime._send_event() streams back
  ↓
Bridge receives agent_event messages
  ↓
Frontend displays text/tool/complete events
```

### Canvas Updates
Agent creates/updates cards via `create_card` or `update_card` tools → WorkspaceDB persists → CanvasUpdateMessage sent → Frontend updates Canvas UI.

### Permissions
- `permission_mode="bypassPermissions"` required for headless agent (SDK blocks Bash without it).
- `/workspace/` owned by `ubuntu` user but exec runs as `sprite` — bootstrap must `chown -R`.

---

## Common Tasks

### Add a new tool
1. Define tool function in `src/tools/` (canvas.py or memory.py).
2. Use tool factory pattern with scoped closures.
3. Register tool in `runtime.py` via MCP server.
4. Add tests in `tests/tools/`.

### Add a new memory file
1. Define template in `memory/` directory.
2. Update `memory/loader.py` to load new file.
3. Update `memory/processor.py` to extract relevant learnings.
4. Ensure Bridge bootstrap includes new file in INIT_MEMORY_FILES.

### Add a new message type
1. Define message type in `protocol.py` (Python dataclass).
2. Add corresponding type to `bridge/src/protocol.ts` (TypeScript).
3. Update Gateway routing in `gateway.py`.
4. Add tests in `tests/test_gateway.py`.

---

## Deployment

**Bootstrap:** Bridge creates Sprite via Sprites API → pip install deps → deploy code via FS API → init databases → write VERSION file.

**Updates:** Bridge checks `/workspace/VERSION` on wake, deploys if outdated.

**Env vars:** `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` (for batch processor + SDK).

---

## References

- `.space-agents/mission/staged/m7b-stackdocs-v2-sovereign-agent-platform/spec.md` — v2 architecture spec
- `bridge/src/protocol.ts` — TypeScript source of truth for message types
- `backend/CLAUDE.md` — v1 backend patterns (being replaced)
