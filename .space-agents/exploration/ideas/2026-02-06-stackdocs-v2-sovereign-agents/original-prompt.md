# Original Prompt: Stackdocs v2 — Sovereign Agent Platform & Canvas UI

You are acting as the Lead Architect for **Stackdocs v2**. We are fundamentally pivoting the product from a standard Vercel-hosted SaaS to a **single-tenant, agent-native platform** hosted entirely on **Fly.io**.

This is a complete architectural overhaul involving infrastructure, backend logic, and a radically new UI paradigm.

## 1. The Core Concept: "Sovereign Agents"

We are moving to a **Shared-Nothing Architecture**.

- **Old Way**: Centralized API processing requests on a shared server.
- **New Way**: Every user gets their own **Private Cloud Computer** (a Fly.io Sprite).
- **Why**: This gives agents persistence (files/memory stay there), safety (isolated sandbox), and power (full Bash/Python access).

## 2. Infrastructure Architecture (All-on-Fly)

We are exiting Vercel to ensure low-latency, bidirectional real-time communication.

### A. The Control Plane (Gateway)

- **Tech**: Next.js 15 (App Router) + Node.js Server (Socket.io).
- **Hosting**: Standard **Fly Machine**.
- **Role**:
  - **Auth/Billing**: Supabase/Clerk + Stripe.
  - **Orchestrator**: Wakes up User Sprites when they log in.
  - **Bridge**: Proxies WebSockets from the User's Browser to their private Sprite.
  - **Security Proxy**: Intercepts LLM requests from Sprites, injects the `ANTHROPIC_API_KEY`, and forwards to Anthropic. (Sprites *never* touch the real keys).

### B. The User Plane (Sprites)

- **Tech**: **Fly.io Sprites** (Persistent MicroVMs).
- **Persistence**: 100GB native root filesystem.
- **Runtime**: A headless Node.js service running the **Claude Agent SDK**.
- **Memory**: Single-tenant **SQLite** DB + **Markdown** files (OpenClaw style) stored locally.
- **Capabilities**: The agent can run `bash`, install `pip` packages, and write files to disk.

## 3. The New UI Paradigm: "Collaborative Canvas"

We are moving away from a simple "Chatbot" interface to a **Dual-Pane Workspace**.

### A. The Split-Pane Layout

1. **Left Pane (Chat & Command)**:
   - Standard conversational interface.
   - User gives high-level "Missions" (e.g., "Analyze these 50 contracts").
   - Agent provides status updates and asks clarifying questions.

2. **Right Pane (The Canvas)**:
   - A real-time, visual rendering of the agent's work.
   - **Not just text**: If the agent generates a chart, it renders a Plotly graph. If it extracts data, it renders an interactive table.
   - **Live Streaming**: The Canvas updates *instantly* via WebSockets as the agent writes to its local SQLite DB or filesystem.

### B. "Time Travel" & Checkpoints

- The UI should expose the Sprite's **Checkpoint** capability.
- Users can view a timeline of "Mission States" and revert the entire agent (and its files) to a previous state if a mission goes wrong.

## 4. Technical Implementation Details

### The Real-Time Bridge

- **Browser** connects to `wss://stackdocs.com`.
- **Gateway** maps `user_id` -> `sprite_ip` and tunnels the connection over Fly's private 6PN network.
- **Sprite** emits events:
  - `CANVAS_UPDATE`: Contains JSON data or file paths to render.
  - `LOG_stream`: Raw stdout from the agent's bash commands (for a "Terminal View" in the UI).

### The Agent Runtime (Inside Sprite)

- **Commander Agent**: The main orchestrator.
- **Specialist Crew**: Sub-agents (Researcher, Analyst) that run in parallel.
- **Bootstrap**: On boot, the runtime checks for a `STACKDOCS_TOKEN` and connects to the Gateway's WebSocket Bridge.

## 5. Deliverables Required

Please generate the following:

### 1. Monorepo Structure

- `apps/gateway`: Next.js 15 (UI + Control Plane).
- `apps/sprite-runtime`: The Dockerized Node.js agent service.
- `packages/shared`: Shared types for WebSocket events (`CanvasUpdate`, `MissionStart`).

### 2. UI Component Plan

- `Canvas.tsx`: How to build a dynamic renderer that handles different artifact types (Markdown, JSON-Data, Charts).
- `Terminal.tsx`: A component to stream the agent's raw logs.

### 3. Infrastructure Config

- `fly.toml` for the Gateway.
- `Dockerfile` for the Sprite (including system dependencies like Python/Pandas).

### 4. Migration Plan

- How to transition from the current architecture to this Sprite-based model.

***

*Please acknowledge the full scope: The move to Fly.io, the Sovereign Sprite architecture, the security proxy pattern, and the new Dual-Pane Canvas UI.*
