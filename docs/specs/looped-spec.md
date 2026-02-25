# LOOPED: Product Specification

**Version:** 0.1.0
**Date:** February 25, 2026
**Author:** Fraser Brown
**Status:** Validated Spike, Pre-MVP

## Vision

Looped is a personal AI computer. Every user gets their own persistent cloud VM with an AI agent pre-installed. The agent remembers everything, can read and write files, run scripts, and work autonomously. The interface feels like an operating system, not a chat app.

**Tagline:** Your AI employee with its own computer.

**Core insight:** The value isn't the AI model. It's the persistent, isolated environment where the AI lives and works. ChatGPT forgets. Looped remembers. ChatGPT can't touch files. Looped has a 100GB filesystem. ChatGPT is shared infrastructure. Looped is YOUR computer.

## Validated Architecture (Spike: Feb 25, 2026)

The following architecture was validated end-to-end in a live spike test on Sprites.dev. The agent (pi v0.55.0) running MiniMax M2.5 via OpenRouter completed multi-step tasks with tool use, persistent memory across prompts, and file creation on a real Sprite VM.

**Cost observed:** $0.002 for 10K tokens (6 requests including tool use, file creation, and a full business plan generation).

```
Browser (Next.js)
    |
    | WebSocket (wss://)
    |
    v
Fly.io Bridge (Node.js)
    |  - Auth (Clerk JWT on connect)
    |  - Route user_id -> sprite_name (Supabase)
    |  - API key proxy (OpenRouter key never on Sprite)
    |  - Sleep/wake reconnection + keepalive
    |
    | TCP Proxy WebSocket
    |
    v
Sprites.dev (one VM per user)
    |
    | stdin/stdout (JSON lines)
    |
    v
pi-coding-agent (persistent RPC process)
    - Multi-provider LLM (OpenRouter, Anthropic, Google, etc.)
    - Tools: bash, read, write, edit, grep, find, ls
    - Session persistence: JSONL files on disk
    - Auto-compaction when context fills
    - AGENTS.md for per-user instructions
```

### Key Technical Decisions

**Agent runtime: pi-coding-agent (not Claude Agent SDK)**
- Open source TypeScript framework by Mario Zechner
- Multi-provider LLM support via OpenRouter (461 models in registry)
- RPC mode: JSON stdin/stdout protocol, perfect for process integration
- Built-in tools, session management, compaction, extensions
- Validated: v0.55.0 installed via npm on Sprite in 12 seconds

**LLM: MiniMax M2.5 via OpenRouter (default model)**
- $0.0003/1K input, $0.0011/1K output tokens
- Strong reasoning with thinking tokens
- Validated: completed multi-step file creation tasks with tool use
- At $29/month Pro tier, users can run ~14,500 tasks before breaking even on LLM costs
- Users can upgrade to better models (Claude, GPT) as a premium feature
- Bring-your-own-key option for power users

**Memory: pi's built-in compaction + filesystem (no custom daemon)**
- Short-term: in-process conversation history (prompt to prompt)
- Medium-term: auto-compaction summaries when context fills (~20K recent tokens kept verbatim)
- Long-term: files on disk + AGENTS.md (pi reads this automatically on startup)
- Session files: JSONL in ~/.pi/agent/sessions/ (survives process restart)
- No ObservationProcessor, no SQLite memory DB, no memory daemon
- The filesystem IS the long-term memory. Agent writes notes/profiles to files.

**Infrastructure: Sprites.dev microVMs**
- Firecracker isolation (hardware-level, single-tenant)
- CRIU checkpoint: processes frozen on sleep, same PID on wake
- 8GB RAM, 100GB persistent disk per user
- Ubuntu 25.04, Node.js 22 pre-installed
- 30s auto-sleep (keepalive pings prevent during active sessions)
- ~1-2s wake latency, ~180ms API RTT from AU
- TCP connections die on sleep. Bridge reconnects.

**Bridge: Node.js WebSocket proxy on Fly.io (exists, deployed)**
- Already built and deployed at wss://ws.stackdocs.io
- 136 tests passing (Vitest)
- Handles auth, routing, reconnection, keepalive, provisioning
- Needs: swap Python Sprite protocol for pi RPC protocol
- Needs: OpenRouter API key proxy (instead of Anthropic/Mistral)

## User Interface

### Design Philosophy

The agent is the operating system. The UI is the desktop. The user doesn't "chat with an AI" -- they work with their computer. Results are objects on a desk, not messages in a thread. The workspace grows over time, becoming a visual representation of everything user and agent have built together.

### The Workspace (Primary Surface)

The workspace occupies the majority of the screen. It is persistent, spatial, and grows as the agent works.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  W O R K S P A C E                                  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ ◈        │  │ ◈        │  │ ◈        │          │
│  │ plan.md  │  │ stack.txt│  │pricing.md│          │
│  │          │  │          │  │          │          │
│  │ Business │  │ Next.js  │  │ Free/Pro │          │
│  │ plan for │  │ Fly.io   │  │ /Business│          │
│  │ Looped   │  │ Sprites  │  │ tiers    │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
│  ┌──────────┐                                       │
│  │ 👤       │                                       │
│  │ Fraser   │                                       │
│  │ Looped   │                                       │
│  │ founder  │                                       │
│  └──────────┘                                       │
│                                                     │
│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                     │
│  T R A N S C R I P T                                │
│                                                     │
│  You: Add pricing tiers to the plan                 │
│  ◈ Updated pricing.md with 3 tiers                  │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Talk to me...                          ⌘↵  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ◉ ─────────────────────────────────── idle  0.4GB  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Workspace Cards

Cards are the primary output objects. They represent files, results, profiles, and running processes on the user's VM.

**Lifecycle:**
1. **Translucent** - appearing, agent is creating this file
2. **Glowing/shimmering** - agent is actively editing this file
3. **Solid** - complete, stable, ready to interact with
4. **Greyed** - stale, hasn't been touched in a while
5. **Pinned** - user has pinned this card (always visible)

**Card types:**
- **File card** - represents a file on the VM. Shows filename, preview of content, file size. Click to expand into full rendered view (markdown rendered, code highlighted, images displayed).
- **Profile card** - represents the user. Shows name, context the agent has learned. Auto-created when agent first learns user's name/role.
- **Process card** - represents a running background task. Shows progress, live output. Disappears when complete (result becomes a file card).
- **Folder card** - represents a directory. Shows file count, total size. Click to expand and see contents.

**Interactions:**
- Click to expand into full preview (overlay or panel)
- Drag to rearrange (positions persist in localStorage, synced to VM)
- Right-click for context menu (download, delete, rename, pin)
- Hover for quick preview tooltip
- Cards auto-arrange in a responsive grid, but user positioning overrides

#### Workspace Behavior

**First visit:** Empty. Just the command bar and the heartbeat dot. Clean desk, first day.

**As agent works:** Cards materialize. First translucent, then solid. The workspace fills organically.

**Return visits:** Workspace loads from persisted state. Everything is where you left it. The agent wakes (1-2s), heartbeat resumes.

**Overflow:** When cards exceed visible space, the workspace becomes scrollable. A minimap or "show all" toggle reveals the full collection. Consider folders/grouping for heavy users.

### The Transcript (Secondary Surface)

The transcript sits below the workspace, separated by a subtle dashed line. It is a compact log of interactions, NOT a chat interface.

**Design principles:**
- Compact single lines, not chat bubbles
- User messages prefixed with "You:"
- Agent responses are brief summaries, not full output (full output is in the cards)
- Tool use shown as compact status lines: "◈ Created plan.md (1.8KB)"
- Scrolls. Old messages disappear upward. Not paginated.
- Clicking a file reference in the transcript highlights the corresponding card

**During agent work:**
```
You: Create a business plan for Looped
◈ Creating business-plan/...
◈ Writing plan.md ████████░░
◈ Writing stack.txt ✓
◈ Writing pricing.md ✓
Done - 3 files created in /business-plan/
```

**This is NOT a chat UI.** The transcript is like Activity Monitor or Console.app. It shows what happened. The workspace shows the results.

### The Command Bar

Always visible. Always ready. Centered at the bottom of the transcript area.

```
┌─────────────────────────────────────────────┐
│  Talk to me...                         ⌘↵   │
└─────────────────────────────────────────────┘
```

**Features:**
- Text input (primary)
- File drag-and-drop (drop files onto the bar to upload to VM)
- Paste images/screenshots (agent can process them)
- Keyboard shortcut to focus: Cmd+K or / (like Spotlight/Raycast)
- Multi-line input with Shift+Enter
- Send with Enter or Cmd+Enter (configurable)
- Suggestions appear above bar based on workspace context (optional, not MVP)

**Voice input (post-MVP):**
- Microphone button on command bar
- Speech-to-text, sends as regular prompt
- Agent responds with text (not voice, to start)

### The Heartbeat (Agent Status)

Bottom status bar. The user's constant awareness of agent state.

```
◉ ─────────────────────────────────── idle  0.4GB
```

**States:**
- **◉ idle** - soft pulsing dot, agent ready. Shows storage used.
- **◉━━━━━━━━━░░░░ working** - animated progress line. Shows current action.
- **◉ sleeping** - dim dot, sprite is asleep. Wakes on next message (1-2s).
- **◉ waking** - dot brightening, sprite waking up.
- **◉ error** - red dot, something went wrong. Click for details.

The heartbeat communicates that the agent is ALIVE. It's not a loading spinner. It's a vital sign. Even when idle, the soft pulse says "I'm here, I'm ready."

**Information shown:**
- Agent state (idle/working/sleeping/error)
- Current action when working ("Writing plan.md...")
- Storage used (e.g., "0.4GB / 25GB")
- Session duration (optional)
- Model in use (optional, for power users)

### Mobile Layout

Same structure, compressed. Workspace cards become a horizontal scroll strip at the top.

```
┌──────────────────────┐
│ LOOPED          ≡  👤│
│──────────────────────│
│                      │
│ ┌────┐ ┌────┐ ┌────┐│
│ │plan│ │stck│ │pric││
│ │.md │ │.txt│ │.md ││
│ └────┘ └────┘ └────┘│
│  ← scroll →          │
│──────────────────────│
│                      │
│ You: Add pricing...  │
│ ◈ Updated pricing.md │
│                      │
│ ┌──────────────────┐ │
│ │ Talk to me...    │ │
│ └──────────────────┘ │
│ ◉ ──── idle   0.4GB │
└──────────────────────┘
```

**Mobile-specific:**
- Cards scroll horizontally (swipe)
- Tap card to expand full-screen
- Transcript takes remaining vertical space
- Command bar sticks to bottom (above keyboard when typing)
- Heartbeat compressed to single line

### Card Expansion (Full Preview)

When a card is clicked/tapped, it expands into a preview overlay.

```
┌─────────────────────────────────────────────────────┐
│  ← Back to workspace              ⬇ Download  ✕    │
│─────────────────────────────────────────────────────│
│                                                     │
│  plan.md                              1.8KB  ◈     │
│                                                     │
│  # Looped - Business Plan                           │
│                                                     │
│  ## Problem                                         │
│                                                     │
│  AI coding assistants like ChatGPT are powerful     │
│  but stateless -- every conversation starts from    │
│  scratch. Developers lose context between sessions, │
│  can't maintain persistent development              │
│  environments, and repeatedly re-explain their      │
│  projects.                                          │
│                                                     │
│  ## Solution                                        │
│                                                     │
│  Looped gives every user their own persistent       │
│  cloud computer...                                  │
│                                                     │
│─────────────────────────────────────────────────────│
│  ┌─────────────────────────────────────────────┐    │
│  │  Ask about this file...                     │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Preview features:**
- Markdown rendering (headings, lists, tables, code blocks)
- Code syntax highlighting
- Image display
- CSV/spreadsheet rendering as tables
- Download button
- "Ask about this file" contextual command bar
- Live updates if agent is currently editing this file (glowing border)

### First-Time Experience

**Step 1: Landing page / Sign up**
- "Your AI employee with its own computer"
- Sign up with email (Clerk auth)
- No credit card for free tier

**Step 2: Sprite provisioning (10-15 seconds)**
- "Setting up your computer..."
- Progress animation showing VM creation
- Brief explanation: "We're creating a private computer just for you. It will remember everything and be here whenever you come back."

**Step 3: Empty workspace**
- Clean desk. Heartbeat pulsing.
- Command bar focused, placeholder: "Tell me about yourself, or ask me to do something..."
- Optional: subtle onboarding hint cards that disappear after first interaction

**Step 4: First interaction**
- User types anything
- Agent responds, possibly creates first file
- First card appears on workspace
- User experiences the core loop: talk -> work happens -> result appears as object

### Navigation and Settings

**Top bar (minimal):**
```
LOOPED                                    [?] [⚙] [👤]
```

- Logo/wordmark (left)
- Help (?) - opens docs/support
- Settings (gear) - model selection, storage, account, API keys
- Profile (avatar) - account, billing, logout

**Settings panel:**
- Model selection (default MiniMax M2.5, upgrade to Claude/GPT)
- Bring-your-own-key toggle (paste OpenRouter/Anthropic key)
- Storage usage and management
- Session history browser
- Export data
- Delete account / destroy VM

**No sidebar. No hamburger menu hiding essential features. Everything is the workspace, the transcript, and the command bar.**

## Protocol: Browser to Agent

### Message Flow

```
Browser                    Bridge                     Sprite
  |                          |                          |
  |-- auth {jwt} ---------->|                          |
  |<- connected ------------|                          |
  |                          |-- TCP proxy connect ---->|
  |<- sprite_ready ----------|                          |
  |                          |                          |
  |-- chat {text} --------->|                          |
  |                          |-- pi RPC {prompt} ------>|
  |                          |<- pi events (streaming)--|
  |<- agent_start -----------|                          |
  |<- tool_start ------------|                          |
  |<- card_create -----------|  (new file detected)     |
  |<- card_update -----------|  (file being written)    |
  |<- text_delta ------------|  (agent response text)   |
  |<- tool_end --------------|                          |
  |<- agent_end -------------|                          |
  |                          |                          |
```

### Bridge Translation Layer

The Bridge translates pi RPC events into Looped-specific WebSocket messages for the frontend. Pi's raw events (message_start, message_update, tool_execution_start, etc.) are mapped to UI-meaningful events:

**Pi event -> Looped event mapping:**
- `agent_start` -> `agent_start` (heartbeat: working)
- `tool_execution_start(bash, {mkdir})` -> `card_create(folder, path)`
- `tool_execution_start(write, {path, content})` -> `card_create(file, path)` + `card_update(content streaming)`
- `tool_execution_end(write)` -> `card_update(status: complete)`
- `tool_execution_start(read, {path})` -> `card_highlight(path)` (glow the card being read)
- `tool_execution_start(edit, {path})` -> `card_update(status: editing, glow)`
- `message_update(text_delta)` -> `transcript_delta(text)` (streaming agent response)
- `agent_end` -> `agent_end` (heartbeat: idle)

This translation is the core value-add of the Bridge for Looped. Raw pi events are developer-oriented. Looped events are workspace-oriented.

### Card State Sync

Cards reflect the VM filesystem state. The source of truth is always the Sprite's filesystem.

**On connect/reconnect:**
1. Bridge reads a manifest file from Sprite (list of tracked files/folders)
2. Sends `workspace_sync` event with current card state
3. Frontend reconciles with localStorage positions

**During work:**
- Card creates/updates come from pi tool events via Bridge
- Card positions stored in frontend localStorage AND synced to a file on Sprite

**Manual refresh:**
- User can "refresh workspace" to re-scan the Sprite filesystem
- Picks up files created outside of pi (e.g., by cron jobs, webhooks)

## Data Model

### Supabase (Platform Only)

```sql
-- Users table (exists, needs minor updates)
users (
  id            text primary key,  -- Clerk user ID
  email         text,
  tier          text default 'free',  -- free, pro, business
  sprite_name   text,
  sprite_status text default 'pending',  -- pending, provisioning, active, failed
  openrouter_key text,  -- encrypted, user's own key (optional)
  created_at    timestamptz,
  updated_at    timestamptz
)
```

### Sprite Filesystem (Per User)

```
/home/sprite/
├── .pi/
│   └── agent/
│       ├── sessions/          # JSONL conversation history
│       │   └── --home-sprite--/
│       │       └── {session-id}.jsonl
│       ├── auth.json          # Provider auth tokens
│       └── settings.json      # Pi settings (compaction, model prefs)
├── AGENTS.md                  # Agent instructions (read on startup)
├── .looped/
│   ├── workspace.json         # Card positions, pinned state
│   ├── profile.md             # User profile (agent-maintained)
│   └── preferences.md         # User preferences (agent-maintained)
└── {user files}               # Everything the agent creates
    ├── business-plan/
    │   ├── plan.md
    │   ├── stack.txt
    │   └── pricing.md
    └── ...
```

### AGENTS.md (Per User, On Sprite)

This file is read by pi automatically on startup. It contains instructions that make pi behave as a Looped agent rather than a generic coding assistant.

```markdown
# Looped Agent

You are the user's personal AI assistant running on their private computer.

## On Startup
- Read /home/sprite/.looped/profile.md for user context
- Read /home/sprite/.looped/preferences.md for preferences
- Greet the user by name if you know them

## File Management
- Create files in /home/sprite/ (the user's home directory)
- Organize related files into folders
- After creating/modifying files, briefly describe what you did

## Memory
- When the user shares personal info (name, business, preferences),
  update /home/sprite/.looped/profile.md
- When the user expresses preferences (formatting, style, tools),
  update /home/sprite/.looped/preferences.md
- These files persist across sessions and compactions

## Behavior
- Be concise. Results matter more than explanations.
- When working on tasks, focus on creating useful output files.
- If the user asks you to remember something, write it to a file.
- You have full bash access. Use it for research, file processing,
  data manipulation, and automation.
```

## MVP Scope

### What to Build (Phase 1, ~4-6 weeks)

**Frontend (Next.js on Vercel):**
- [ ] Workspace view with card grid
- [ ] Card components (file, folder, profile) with lifecycle states
- [ ] Card expansion/preview overlay
- [ ] Transcript area with streaming agent responses
- [ ] Command bar with text input
- [ ] Heartbeat status bar
- [ ] WebSocket connection to Bridge
- [ ] Card position persistence (localStorage + Sprite sync)
- [ ] Mobile responsive layout
- [ ] Clerk auth (sign up, sign in, profile)
- [ ] Settings panel (model selection, storage, account)
- [ ] Sprite provisioning loading screen

**Bridge (Node.js on Fly.io, exists - needs adaptation):**
- [ ] Swap Python Sprite protocol for pi RPC stdin/stdout
- [ ] Pi event -> Looped event translation layer
- [ ] OpenRouter API key proxy (replace Anthropic/Mistral proxy)
- [ ] Workspace manifest sync (read file list from Sprite)
- [ ] Start pi process on Sprite (via exec API, persistent)
- [ ] Health monitoring for pi process (restart if dead)

**Sprite Bootstrap (automated setup for new users):**
- [ ] Install pi-coding-agent via npm
- [ ] Write AGENTS.md with Looped instructions
- [ ] Create .looped/ directory with empty profile/preferences
- [ ] Start pi in RPC mode as persistent process
- [ ] Write VERSION file for lazy updates

**NOT in MVP:**
- Task template marketplace
- Voice input
- Team/shared workspaces
- Custom extensions
- File upload via drag-and-drop (just text input first)
- Billing/payments (free tier only to start)
- Process cards (background tasks)
- Card drag-to-reposition (auto-grid only)

### What to Reuse from Stackdocs

**Direct reuse (copy/adapt):**
- Bridge codebase (~80% reusable): auth, proxy, reconnect, keepalive, provisioning
- Sprites.dev client: REST API, FS API, exec API, TCP proxy
- Supabase schema: users table
- Clerk auth integration
- Fly.io deployment config

**Pattern reuse (same approach, new code):**
- WebSocket message protocol design
- Frontend WebSocket connection manager
- Zustand stores for workspace state
- Debug panel (Cmd+Shift+D)

**Not reused:**
- Canvas viewport / momentum physics
- Glass components
- Python agent runtime
- Claude Agent SDK integration
- Memory daemon / ObservationProcessor
- SQLite databases on Sprite

## Business Model

### Pricing (MVP: Free Tier Only)

**Free:**
- 1 Sprite (sleeps after 30s idle)
- 10 tasks/day
- 1GB storage
- Default model: MiniMax M2.5

**Pro ($29/month, post-MVP):**
- 1 always-on Sprite (or 3 auto-sleep)
- Unlimited tasks
- 25GB storage
- Model selection (Claude, GPT, Gemini via OpenRouter)
- Bring-your-own-key option

**Business ($99/month, future):**
- 5 Sprites
- 100GB storage each
- Admin dashboard
- SSO/team management

### Unit Economics (Validated)

| Cost | Per User/Month | Notes |
|------|---------------|-------|
| Sprite VM | ~$15 (estimated) | With aggressive auto-sleep |
| LLM (absorbed) | ~$0.50-2.00 | MiniMax M2.5 at $0.002/10K tokens |
| Bridge infra | ~$0.10 | Shared Fly.io machine |
| Supabase | ~$0.01 | Free tier covers MVP |
| **Total COGS** | **~$16-17** | |
| **Pro revenue** | **$29** | |
| **Gross margin** | **~41-45%** | Improves with auto-sleep optimization |

At scale with better sleep optimization and usage-based pricing for heavy users, margins improve to 55-65%.

## Technical Risks and Mitigations

**Risk: pi-coding-agent breaks or becomes unmaintained**
- Mitigation: Fork the repo. It's MIT licensed. The RPC protocol is stable.
- Mitigation: pi's LLM abstraction layer means swapping to a different agent framework later is feasible.

**Risk: Sprites.dev reliability (early platform)**
- Mitigation: Bridge handles reconnection. JSONL session files survive process death.
- Mitigation: Sprites are Fly.io Machines under the hood. Fly.io is production-grade.
- Mitigation: Process persistence via CRIU is the key differentiator. No alternative offers this.

**Risk: OpenRouter rate limits or downtime**
- Mitigation: pi supports direct provider APIs as fallback.
- Mitigation: Bring-your-own-key shifts responsibility to user.

**Risk: MiniMax M2.5 quality degrades or pricing changes**
- Mitigation: One config change to swap default model. No code changes needed.
- Mitigation: OpenRouter's 461 models provide infinite fallback options.

**Risk: Users create too many files, workspace becomes unmanageable**
- Mitigation: Card grouping, folders, search, pinning in future iterations.
- Mitigation: Storage caps per tier.

## Success Metrics (3 Months Post-Launch)

- 500+ signups
- 50%+ complete their first task
- 100+ return users (used Looped on 2+ separate days)
- Average 3+ tasks per active session
- Sub-5-second agent response time (first token)
- Sub-2-second Sprite wake time
- Zero data loss incidents

## Appendix: Spike Test Results (Feb 25, 2026)

### Test 1: Single Prompt (File Creation)

**Prompt:** "Create a folder called business-plan and generate a business plan"

**Result:** Agent used 3 tools (bash mkdir, write plan.md, bash ls to verify). Created complete business plan with Problem, Solution, Target Market, Pricing, GTM sections. File persists on Sprite filesystem.

**Cost:** ~$0.001
**Time:** ~8 seconds

### Test 2: Persistent Process (4 Prompts, Memory Test)

**Setup:** Single pi process in RPC mode, 4 sequential prompts.

**Prompt 1:** "My name is Fraser, create a project with README and stack.txt"
- Result: 3 tool calls, files created correctly.

**Prompt 2:** "What is my name and what did you just create?"
- Result: Perfect recall. Zero tool calls. Answered from conversation memory.

**Prompt 3:** "Add pricing.md referencing the tech stack"
- Result: Read stack.txt (1 tool call), wrote pricing.md with correct references.

**Prompt 4:** "Summarize everything we did this session"
- Result: Perfect recall of all 3 files, all contents, user name, project name. Zero tool calls.

**Total cost for all 4 prompts:** ~$0.002
**Total tokens:** ~10K

### Test 3: Memory Without Persistence (Negative Test)

**Setup:** New pi process (separate invocation), asked "what did you just do?"

**Result:** "This appears to be the start of our conversation, so I haven't done anything yet."

**Confirms:** Memory is in-process only. Persistent process is required. JSONL session files exist for recovery but weren't tested for reload.

### Environment Details

- Sprite: `looped-spike` on Sprites.dev
- OS: Ubuntu 25.04, Linux 6.12.47-fly
- Node: v22.20.0 (pre-installed)
- pi: v0.55.0 (@mariozechner/pi-coding-agent)
- Model: minimax/minimax-m2.5 via OpenRouter
- Provider: openrouter with OPENROUTER_API_KEY
