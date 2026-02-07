# Exploration: Canvas Tools + Memory System for Sprite Agent

**Date:** 2026-02-08
**Status:** Ready for planning
**Beads:** m7b.3.4 (Canvas tools for agent), m7b.3.5 (Basic memory system)

---

## Problem

The Sprite agent can receive user messages and respond with text, but it cannot render visual output to the Canvas or persist learning across sessions. Without canvas tools, the agent has no way to create the cards that are the core UI of Stackdocs v2. Without a memory system, every session starts from zero — the agent can't learn extraction patterns, remember user preferences, or maintain context.

These are the last two tasks in Phase 2 (Sprite Runtime) before the agent is feature-complete for MVP integration with the Canvas UI (Phase 3).

---

## Solution

Build two sets of agent tools — canvas tools and memory tools — registered via the existing Claude Agent SDK MCP server pattern (`@tool` + `create_sdk_mcp_server`). Canvas tools let the agent create/update/close composable cards on the user's Canvas via WebSocket messages. Memory tools let the agent read/write persistent files (soul.md, user.md, MEMORY.md, journals) that load into its system prompt at session start.

Both tool sets use the **closure-based tool factory pattern** from v1, with `send_fn` (WebSocket callback) and filesystem paths captured in closures.

---

## Requirements

### Canvas Tools (m7b.3.4)

- [ ] `create_card(title, card_type, blocks)` — sends `canvas_update` message with `command: 'create_card'` and block array
- [ ] `update_card(card_id, blocks)` — sends `canvas_update` with `command: 'update_card'` and changed blocks matched by block `id`
- [ ] `close_card(card_id)` — sends `canvas_update` with `command: 'close_card'`
- [ ] Tool factory: `create_canvas_tools(send_fn)` returns list of `@tool`-decorated functions with `send_fn` in closure
- [ ] All three tools registered via `create_sdk_mcp_server` alongside memory tools
- [ ] Agent composes cards from MVP block catalog: `heading`, `stat`, `key-value`, `table`, `badge`, `progress`, `text`, `separator`
- [ ] Block validation: each block has `id` (auto-generated UUID) and `type` matching catalog
- [ ] Message payloads match existing protocol schema in `sprite/src/protocol.py` (use `CanvasUpdate` dataclass + `to_json()`)

### Memory System (m7b.3.5)

- [ ] `memory/__init__.py` — on first boot, create templates: `soul.md`, `user.md`, `MEMORY.md` in `/workspace/memory/` if missing; skip if files exist
- [ ] `memory/loader.py` — load soul.md + user.md + MEMORY.md + today's journal + yesterday's journal into structured system prompt section
- [ ] `memory/journal.py` — after each mission, append summary to `/workspace/memory/YYYY-MM-DD.md` (append, not overwrite)
- [ ] `memory/transcript.py` — log tool calls + agent responses to `/workspace/transcripts/YYYY-MM-DDTHH-MM-SS.jsonl` (valid JSON lines)
- [ ] Memory tools via factory: `create_memory_tools()` returns `@tool`-decorated functions
  - `write_memory(file, content)` — write to specified memory file
  - `update_soul(content)` — update soul.md
  - `update_user_prefs(content)` — update user.md
- [ ] All memory tools registered via same `create_sdk_mcp_server` as canvas tools

### Integration

- [ ] `runtime.py` modified to: create canvas + memory tools, bundle into single MCP server, pass to `ClaudeAgentOptions`
- [ ] System prompt includes loaded memory context (from `loader.py`) at session start
- [ ] `bootstrap.ts` updated to deploy new files (canvas_tools.py, memory_tools.py, memory/*.py)
- [ ] All new files added to the deployment file list in `bridge/src/bootstrap.ts`

---

## Non-Requirements

- No streaming card creation — cards pop in complete with fade animation (streaming is post-MVP)
- No canvas state sync to Sprite — layout persists in browser localStorage only for MVP
- No FTS5 memory search — that's m7b.6.1 (Phase 5)
- No pre-compaction memory flush — post-MVP, Claude Agent SDK doesn't expose compaction controls
- No heartbeat system — post-MVP
- No agent-generated JSX/markup — structured data cards only for MVP
- No image block type — only the 8 MVP block types listed above
- No card-to-card connections/edges — React Flow edges not used

---

## Architecture

### Tool Registration Flow

```
runtime.py (AgentRuntime)
│
├── create_canvas_tools(send_fn)
│   ├── @tool create_card(title, card_type, blocks)
│   ├── @tool update_card(card_id, blocks)
│   └── @tool close_card(card_id)
│
├── create_memory_tools()
│   ├── @tool write_memory(file, content)
│   ├── @tool update_soul(content)
│   └── @tool update_user_prefs(content)
│
├── create_sdk_mcp_server(name="sprite", tools=[...all 6 tools...])
│
└── ClaudeAgentOptions(
        mcp_servers={"sprite": server},
        system_prompt=memory_loader.load() + base_prompt,
        permission_mode="bypassPermissions",
        cwd="/workspace",
        max_turns=15
    )
```

Tools appear to the agent as: `mcp__sprite__create_card`, `mcp__sprite__update_card`, `mcp__sprite__close_card`, `mcp__sprite__write_memory`, `mcp__sprite__update_soul`, `mcp__sprite__update_user_prefs`.

### Canvas Update Protocol (wire format)

```json
{
  "type": "canvas_update",
  "id": "uuid",
  "timestamp": 1707350400000,
  "payload": {
    "command": "create_card",
    "card_id": "uuid",
    "title": "Invoice #2847",
    "card_type": "table",
    "position": { "x": 100, "y": 200 },
    "size": { "width": 400, "height": 300 },
    "blocks": [
      { "id": "b1", "type": "heading", "data": { "text": "Invoice #2847 — Extraction", "level": 2 } },
      { "id": "b2", "type": "stat", "data": { "label": "Total", "value": "$1,247.50" } },
      { "id": "b3", "type": "table", "data": { "columns": ["Vendor", "Date", "Amount"], "rows": [] } },
      { "id": "b4", "type": "badge", "data": { "text": "Completed", "variant": "success" } }
    ]
  }
}
```

- `position` and `size` are optional — frontend auto-places if omitted
- `card_type` determines defaults: `"table"` | `"document"` | `"notes"`
- Each block has `id` (UUID) for targeted updates and `type` from the MVP catalog

### MVP Block Catalog

| Type | Data Fields | Renders As |
|------|------------|------------|
| `heading` | `text`, `level` (1-4) | shadcn heading with size |
| `stat` | `label`, `value`, `description?` | Large value with label |
| `key-value` | `pairs: [{key, value}]` | Two-column key-value list |
| `table` | `columns: string[]`, `rows: any[][]` | shadcn Table component |
| `badge` | `text`, `variant` (default/success/warning/destructive) | shadcn Badge |
| `progress` | `value` (0-100), `label?` | shadcn Progress bar |
| `text` | `content` (markdown string) | Rendered markdown |
| `separator` | (none) | shadcn Separator |

### MVP Card Types

| Card Type | Typical Blocks | Use Case |
|-----------|---------------|----------|
| `table` | heading + stat + table + badge | Extraction results |
| `document` | heading + text + badge | Uploaded document preview |
| `notes` | heading + text | Agent or user-created notes |

### Memory File Structure (on Sprite filesystem)

```
/workspace/
├── memory/
│   ├── soul.md          # Stack identity, extraction rules (agent-maintained)
│   ├── user.md          # User preferences, learned patterns
│   ├── MEMORY.md        # Persistent global memory, curated summaries
│   ├── 2026-02-08.md    # Today's journal (append-only)
│   └── 2026-02-07.md    # Yesterday's journal
└── transcripts/
    └── 2026-02-08T09-30-00.jsonl  # Session audit log
```

### System Prompt Loading (loader.py)

Loads in this order and assembles into a structured system prompt section:

1. `soul.md` — stack identity and configuration
2. `user.md` — user preferences
3. `MEMORY.md` — global persistent memory
4. Today's journal (`YYYY-MM-DD.md`) — current session context
5. Yesterday's journal — recent context

Format: each file wrapped in a labeled section header for clarity in the system prompt.

### File Structure (new files to create)

```
sprite/src/
├── agents/
│   └── shared/
│       ├── __init__.py
│       ├── canvas_tools.py    # create_canvas_tools(send_fn) factory
│       └── memory_tools.py    # create_memory_tools() factory
├── memory/
│   ├── __init__.py            # ensure_templates() — first-boot template creation
│   ├── loader.py              # load() → structured system prompt string
│   ├── journal.py             # append_journal(summary) — daily journal
│   └── transcript.py          # TranscriptLogger — JSONL audit log
└── runtime.py                 # Modified: create tools, MCP server, memory loading
```

---

## Constraints

- **Claude Agent SDK requires MCP server wrapper** — no bare `tools=[]` API. Must use `@tool` decorator + `create_sdk_mcp_server()`. This is in-process, not an external server.
- **Tool args come as `dict`** — `@tool` decorator's third argument is a param schema, function receives `args: dict`. Claude sometimes stringifies JSON — include `json.loads()` guards for list/dict params.
- **Tool naming convention** — tools are prefixed `mcp__{server}__{tool}` automatically. Use a single "sprite" server for all tools.
- **Protocol types already exist** — `CanvasUpdate`, `CanvasUpdatePayload`, `CanvasCommand`, block types all defined in `sprite/src/protocol.py`. Canvas tools should construct these dataclasses, not raw dicts.
- **Protocol shared across three codebases** — TypeScript in `bridge/src/protocol.ts` (source of truth) and `frontend/types/ws-protocol.ts`, Python in `sprite/src/protocol.py`. All three already match.
- **Bootstrap deploys files** — `bridge/src/bootstrap.ts` line 26 lists deployed files. New files must be added to this list AND to the directory creation step.
- **`/workspace/` owned by `ubuntu`, exec runs as `sprite`** — bootstrap must `chown -R` after deploying new files (already handled).
- **v1 tool factory pattern** — follow the exact closure pattern from `backend/app/agents/extraction_agent/tools/`. Proven across two agents.

---

## Success Criteria

- [ ] Agent can create a card on Canvas via chat (e.g., "Show me a summary card") and card appears with correct blocks
- [ ] Agent can update a specific block on an existing card (e.g., "Change the total to $500") and card updates in place
- [ ] Agent can close a card (e.g., "Remove that card") and card disappears from Canvas
- [ ] Agent's system prompt includes content from soul.md, user.md, MEMORY.md, and recent journals at session start
- [ ] Agent can update soul.md via `update_soul` tool and changes persist across sessions
- [ ] Daily journal is appended after each mission with activity summary
- [ ] JSONL transcript logs every tool call for the session
- [ ] All canvas_update messages match the protocol schema (parseable by Bridge and Frontend)
- [ ] Memory templates created on first boot, not overwritten on subsequent boots
- [ ] All 6 tools visible to the agent (listed when agent describes its capabilities)

---

## Open Questions

1. **`allowed_tools` whitelist** — Should we explicitly whitelist tools (limits agent to named tools) or omit `allowed_tools` (agent gets everything including built-ins)? Omitting is simpler for MVP. If specified, must list all built-in tools too (Bash, Read, Write, Glob, Grep, WebSearch, WebFetch).
   - **Recommendation:** Omit for MVP. Agent gets all built-in + all custom tools. Restrict later if needed.

2. **Auto-placement algorithm** — When agent creates a card without specifying `position`, how does the frontend place it? Options: right-of-last-card, grid packing, center of viewport. This is a frontend concern (Phase 3) but affects whether canvas tools should always specify position.
   - **Recommendation:** Frontend handles auto-placement. Canvas tools make position optional. Design the placement algorithm in m7b.4.2 (React Flow canvas task).

---

## Next Steps

1. `/plan` to break m7b.3.4 and m7b.3.5 into implementation subtasks
2. Canvas tools and memory system can be built in parallel (independent tool sets)
3. After implementation: Phase 3 (Canvas UI) integration — frontend renders the cards these tools create
4. Consider updating existing Beads m7b.3.4 and m7b.3.5 with refined scope from this spec
