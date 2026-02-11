# Exploration: Stackdocs OS — Spatial Glass Desktop with Generative Apps

**Date:** 2026-02-11 (updated)
**Status:** Ready for planning
**Supersedes:** Original "Liquid Glass UI Reskin" spec (2026-02-09), "Spatial Glass Desktop" spec (2026-02-09)
**Related:** Canvas Tools + Memory System spec (2026-02-08), v2 Architecture spec
**Prototype:** Built in Google AI Studio during sessions 142-143 (iterated extensively)

---

## Problem

Stackdocs v2 is a personal AI computer — each stack runs a full agent on its own VM. But every AI product in the market (ChatGPT, Claude, Gemini) is stuck in the chat log paradigm. Users upload 50 invoices, get text summaries buried in a scrolling conversation. The actual data they need is scattered across chat bubbles. They can't see it all at once, arrange it spatially, or compare things side by side.

The original v2 UI plan (sidebar + header + subbar + React Flow grid) looked and felt like a web dashboard. It didn't communicate the "agent IS the operating system" vision.

More importantly: the current design limits the agent to rendering structured data blocks. But the agent runs on a full VM with real compute. It can build *anything*. The UI should let the agent generate full custom apps on demand — calculators, kanban boards, calendars, financial summaries — not just tables and stats.

**The vision shift:** Stackdocs isn't a document extraction tool with AI. It's a **personal AI computer** where document extraction is one capability among many. The agent builds whatever the user needs, on demand, with their actual data.

---

## Solution

A spatial glass desktop OS interface where the agent renders floating glass cards and generative apps on a wallpaper-backed canvas. The user talks to the agent via a chat bar at the bottom — the chat bar is the universal app launcher. The agent's primary output is the canvas, not text. Text responses are secondary and ephemeral.

**Core concept: "Type what you need, it appears."**

Inspired by: Apple Liquid Glass (iOS 26 / iPadOS 26), Anthropic "Imagine with Claude" (generative UI), iPadOS multitasking (floating windows), macOS Spaces (virtual desktops), Claude Cowork (suggestion chips in input bar).

**Three visual layers:**

```
Layer 0: Wallpaper       Full-bleed background image, bright and vibrant, defines glass tinting
Layer 1: Chrome glass    Top dock, chat bar, menus — heavily blurred, very transparent
Layer 2: Content glass   Canvas cards and app windows — slightly more opaque for readability
```

**Interaction model:**

```
User types in chat bar (or clicks a suggestion chip)
       ↓
Agent processes
       ↓
Agent renders cards/apps on the canvas    ← PRIMARY OUTPUT
Agent's text reply appears in a Chat card ← SECONDARY (ephemeral, scrollable)
```

**Two types of canvas content:**

```
1. DATA CARDS — Structured blocks (tables, stats, key-value, text)
   Created from document extraction, queries, summaries
   Uses the existing block catalog (8 types)

2. GENERATIVE APPS — Full interactive applications
   Agent generates HTML/React in sandboxed iframes
   Calculators, kanbans, calendars, charts, forms, anything
   Users can save favorite apps to the dock
```

---

## Requirements

### Layout

- [ ] Full-bleed wallpaper background covering entire viewport (bright, vibrant — aqua/blue tones)
- [ ] Wallpaper applied via `background-image` with `background-size: cover` (real images, not just CSS gradients)
- [ ] User-selectable wallpaper (4-5 defaults + custom URL)
- [ ] No header bar, no subbar, no traditional app shell
- [ ] No page routes inside a workspace — just `/stacks/[id]` as the desktop
- [ ] All chrome elements float over the wallpaper with gaps between them

### Top Bar — Three Floating Pills

- [ ] **Left pill (App Drawer):** Contains icons for built-in and saved apps (documents, grid/apps, settings/sliders). Clicking an icon opens the corresponding panel from the LEFT side, anchored and fixed. The app panel can be resized wider by the user but stays on the left.
- [ ] **Center pill (Workspace Tabs):** Horizontal glass pill showing workspace tabs — like browser tabs. Each tab shows the workspace name with a colored status dot (red = active/busy, green = idle). "+" button at the end to create a new workspace. User or agent can create, rename, close, and switch tabs. Active tab is visually highlighted.
- [ ] **Right pill (System Tray):** Contains zoom percentage display (e.g., "100%"), search icon 🔍, notification bell 🔔, and user avatar. Clicking user avatar opens profile/settings/billing/sign-out dropdown. Clicking notification bell shows recent notifications.
- [ ] All three pills are the same height (~48px), floating with wallpaper visible between them
- [ ] ~16px margin from top edge of viewport

### Glass Design System

- [ ] CSS variable-driven glass tokens in `globals.css`
- [ ] **Chrome glass** (dock, chat bar, menus): `backdrop-filter: blur(40px) saturate(120%)`, `background: rgba(255,255,255,0.06)`, minimal or no borders, wallpaper tints the surface
- [ ] **Card glass** (canvas cards, app windows): `backdrop-filter: blur(30px) saturate(120%)`, `background: rgba(255,255,255,0.08)`, `border-radius: 16px`, soft shadow
- [ ] Glass surfaces are tinted by the wallpaper — NOT neutral gray. The wallpaper colour bleeds through.
- [ ] Low saturation in backdrop-filter to prevent over-tinting (120% not 200%)
- [ ] Dark text on bright wallpapers, light text on dark wallpapers (adaptive)
- [ ] No hard borders — blur and shadow define edges

### Canvas Area (Infinite Canvas)

- [ ] **Infinite canvas** — not a fixed viewport. Cards live in an unbounded 2D space.
- [ ] **Pan:** Click and drag on empty canvas space to pan/move around the canvas
- [ ] **Zoom:** Scroll wheel to zoom in/out. Zoom level displayed in top-right system tray (e.g., "100%")
- [ ] **Canvas position indicator:** POS: x, y and ZM: percentage shown in bottom-right corner
- [ ] Cards are absolutely positioned in canvas space, freely placed (not grid-snapped)
- [ ] Cards are draggable via pointer events (click-drag on a card moves the card, not the canvas)
- [ ] Cards have minimal title bar (title text + "..." options menu + close X button + optional save/pin icon)
- [ ] **Card "..." menu** (glass dropdown): "Ask AI to edit..." (opens inline prompt targeting this card), "Lock Window" (prevent drag/move), "Pin to View" (keep visible/anchored). Agent-generated apps may have additional contextual options.
- [ ] Cards fade in on creation, fade out on close
- [ ] Auto-placement algorithm for agent-created cards without specified position
- [ ] **Right-click context menu** on empty canvas: glass dropdown with Environment section (wallpaper selection with preview thumbnails) and View section (zoom out, fit to screen, zoom in, "Clean Up By Name" to auto-arrange cards)
- [ ] No React Flow — CSS transforms for pan/zoom, absolute positioning for cards

### Data Cards (Block Catalog)

- [ ] Same 8 block types from canvas tools spec: heading, stat, key-value, table, badge, progress, text, separator
- [ ] Agent creates/updates/closes cards via `canvas_update` WebSocket messages (existing protocol)
- [ ] Cards support drill-down: clicking interactive elements sends `card_interaction` to agent, agent regenerates card content in-place
- [ ] Card sizes vary by content type (small stat, wide table, medium notes, tall document)

### Generative App Cards (NEW)

- [ ] Agent generates full interactive applications rendered in sandboxed iframes within glass cards
- [ ] Agent writes HTML/CSS/JS, frontend renders it in a secure iframe
- [ ] Apps have full interactivity (buttons, inputs, drag-and-drop within the app)
- [ ] Apps can communicate back to the agent via postMessage (e.g., "user completed task X")
- [ ] Save/pin icon ⭐ in title bar — clicking saves the app to the dock for future use
- [ ] Saved apps persist in the workspace and can be re-opened from the dock
- [ ] Examples: calculator, kanban board, calendar view, chart builder, form generator, P&L summary

### Chat — Dual Mode (Bottom Bar OR Right Panel)

The chat has two modes. User can switch between them. Bottom bar is default (keeps canvas clean). Right panel is for users who prefer traditional chat with full history.

**Mode 1: Bottom Chat Bar (default)**

- [ ] Single glass pill anchored bottom center, same height as top dock pills
- [ ] Single-line layout, all on one row:
  - Far left: Paperclip/attach icon
  - Middle: Suggestion chips (agent-driven, e.g., "Show breakdown", "Export CSV", "Upload more") OR text input field — mutually exclusive, same space
  - Far right: Text mode icon (keyboard), microphone icon (voice), chat icon (switch to panel mode)
- [ ] No placeholder text in the input field
- [ ] When user starts typing or clicks text icon: chips fade out, text input appears
- [ ] When input is empty: chips fade back in
- [ ] Chips are clickable — clicking sends the action immediately
- [ ] Border-radius: 24px, glass styling matching top dock
- [ ] No send button — Enter key sends

**Mode 2: Assistant Panel (right side)**

- [ ] Fixed glass panel anchored to the right edge, full height (below top bar)
- [ ] Title bar: "Assistant" with green status dot + minimize/collapse button
- [ ] Full scrollable chat history with timestamps — traditional AI chat layout
- [ ] User messages right-aligned, agent messages left-aligned with agent avatar
- [ ] Text input at the bottom of the panel with attach icon, mic icon, and agent icon
- [ ] Panel can be resized (drag left edge to make wider/narrower)
- [ ] Clicking the chat icon in the bottom bar opens this panel; clicking minimize returns to bottom bar
- [ ] This is an easy way to see full conversation history without cluttering the canvas

**Chat Output on Canvas (both modes)**

- [ ] Agent's primary output is always canvas cards/apps — NOT text
- [ ] Text responses supplement the canvas actions ("I found 12 invoices and organized them into a table for you")

### Workspaces (Browser Tab Model)

**One Sprite VM per user, NOT per workspace.** Workspaces are virtual canvases within the same agent/VM — like browser tabs within one browser. The agent knows about ALL workspaces and all user data. Switching tabs is "change focus" not "connect to different VM."

- [ ] Workspace tabs in the center pill, styled like browser tabs
- [ ] Each tab = one virtual canvas (its own set of cards, apps, zoom level, and state)
- [ ] ALL tabs share the same Sprite VM, same agent, same filesystem, same database
- [ ] Tabs show workspace name + colored status dot (red = active/processing, green = idle)
- [ ] Clicking a tab switches the canvas view — cards/apps swap to that workspace's state
- [ ] "+" button creates a new workspace tab (no new VM — just a new canvas context)
- [ ] Tabs can be reordered by drag
- [ ] Agent can create new workspace tabs programmatically (e.g., "I've created a Tax Returns workspace for you")
- [ ] Workspace state (card positions, zoom level, open panels) persists on the Sprite (SQLite or filesystem)
- [ ] Closing a tab hides the workspace — can be reopened (data is never lost)
- [ ] This means the agent has full context across all workspaces — it can reference Q4 data from the Tax Returns tab

### App Panels (Left-Anchored)

All app panels open from the LEFT side of the screen, anchored/fixed. They don't float on the canvas — they're fixed UI that overlays the left edge. User can resize panel width by dragging the right edge.

**Documents Panel:**

- [ ] Triggered by clicking the documents icon in the app drawer (top-left pill)
- [ ] Fixed glass panel anchored to the left edge, full height (below top bar)
- [ ] File tree navigation — folders expand/collapse (My Drive, Active Projects, Invoices, Shared with me)
- [ ] Shows individual files with icons (PDF, TXT, etc.)
- [ ] Search icon at the top for filtering
- [ ] Storage usage indicator at the bottom (e.g., "15 GB of 20 GB used" with progress bar)
- [ ] Click a document to trigger agent analysis or open a preview card on the canvas
- [ ] Panel can be closed or minimized back to the app drawer

**Apps Panel (future):**

- [ ] Triggered by clicking the grid/apps icon in the app drawer
- [ ] Shows built-in apps and user-saved generated apps in a grid
- [ ] Click an app to open it as a card on the canvas

### Dropdown Menus

- [ ] Left pill menu: Profile, Settings, Billing, Sign Out — glass dropdown
- [ ] Right pill menu: Recent notifications + scheduled automations — glass dropdown
- [ ] Dropdowns use glass styling, appear below their pill with a small gap
- [ ] Click outside or press Escape to close

---

## Non-Requirements

- Not implementing SVG refraction/displacement filters (Apple's "liquid" edge distortion)
- Not implementing animated/moving wallpapers — static images only
- Not supporting mobile — this is a desktop/laptop experience
- Not changing the `canvas_update` WebSocket protocol — existing protocol from canvas tools spec still applies
- Not implementing card-to-card edges/connections — no graph/flowchart concept
- Not implementing window snapping/tiling — free placement only for MVP
- Not implementing multi-monitor or multi-window browser tabs
- Not generating arbitrary React components in the main thread — generative apps MUST be sandboxed in iframes for security
- Not building a wallpaper gallery/marketplace — just defaults + custom URL
- Not implementing agent-to-agent communication between workspaces — each workspace is isolated
- Not supporting light mode for MVP — glass over bright wallpapers only (dark wallpaper support later)
- Not implementing voice mode for MVP — icon present but non-functional initially

---

## Architecture

### Viewport Layout

```
body
├── wallpaper-layer             ← Full-bleed background (position: fixed, z-index: -1)
├── top-bar                     ← Fixed top, z-index: 30
│   ├── app-drawer-pill         ← Top-left (app icons → open left panels)
│   ├── workspace-tabs-pill     ← Top-center (browser-tab-style workspace switcher)
│   └── system-tray-pill        ← Top-right (zoom %, search, notifications, avatar)
├── left-panel-slot             ← Fixed left, z-index: 20 (Documents, Apps panels)
├── canvas-viewport             ← Infinite canvas with pan/zoom (z-index: 1)
│   │                              CSS transform: translate(panX, panY) scale(zoom)
│   ├── [DataCard]*             ← Agent-created data cards (absolute positioned, draggable)
│   ├── [AppCard]*              ← Agent-created generative apps (absolute positioned, iframe)
│   └── [ContextMenu]           ← Right-click menu (environment, view options)
├── right-panel-slot            ← Fixed right, z-index: 20 (Assistant chat panel)
├── dropdown-overlay            ← Dropdown menus (z-index: 40)
├── chat-bar                    ← Fixed bottom center, z-index: 20 (when in bar mode)
└── canvas-info                 ← Bottom-right corner: POS + ZM indicators
```

### One VM Per User (Architecture Decision)

```
Previous v2 plan:  1 Sprite VM per stack (workspace)
New model:         1 Sprite VM per user, multiple workspace tabs

User → 1 Sprite VM → 1 Agent → N Workspace Tabs (virtual canvases)
                   → 1 SQLite DB (all data)
                   → 1 Filesystem (all documents, apps, memory)
```

This simplifies the architecture:
- Bridge routes user_id → single sprite_name (not stack_id → sprite_name)
- Supabase `stacks` table becomes `workspaces` table (lightweight — just name, order, canvas state)
- Agent has full context across ALL workspaces — can reference any data from any tab
- No cross-VM communication needed (was a concern in the old model)
- Billing is per-user (one VM) not per-workspace

### Generative App Rendering

```
User: "Build me a calculator"
       ↓
Agent generates HTML/CSS/JS for a calculator app
       ↓
Agent sends canvas_update with type: "app" and content: { html: "...", title: "Calculator" }
       ↓
Frontend creates a glass card with a sandboxed iframe
       ↓
iframe renders the generated HTML (sandbox="allow-scripts")
       ↓
iframe communicates back via postMessage for agent interactions
       ↓
User clicks ⭐ save → app definition stored in workspace state → icon added to dock
```

**Security:** Generative apps run in sandboxed iframes with `sandbox="allow-scripts"` only. No access to parent DOM, no network requests, no cookies. Agent-generated code is treated as untrusted.

### Dock State

```typescript
interface DockState {
  apps: DockApp[];          // Documents (built-in) + saved generated apps
  workspaces: Workspace[];  // Stack/Sprite references
  activeWorkspace: string;  // Currently active workspace ID
}

interface DockApp {
  id: string;
  icon: string;             // Emoji or icon name
  label: string;            // "Calculator", "Kanban", "Documents"
  type: 'builtin' | 'generated';
  appHtml?: string;         // For generated apps — the HTML to render
}
```

### Chat Bar States

```
STATE: CHIPS (default, input empty)
┌────────────────────────────────────────────────────┐
│  📎  [Show breakdown] [Export CSV] [Upload]  ⌨ 🎤  │
└────────────────────────────────────────────────────┘

STATE: TYPING (user activated text input)
┌────────────────────────────────────────────────────┐
│  📎  build me a kanban board_                ⌨ 🎤  │
└────────────────────────────────────────────────────┘
```

### Technology Choices

| Decision | Choice | Why |
|----------|--------|-----|
| Card positioning | `position: absolute` + pointer events | Simpler than React Flow. No node-edge graph needed. |
| Drag library | `@dnd-kit` or raw pointer events | Lightweight. |
| Glass effects | Native CSS `backdrop-filter` | GPU-accelerated, all modern browsers |
| Wallpaper | CSS `background-image` on fixed div | No JS needed |
| Card state | Zustand store + localStorage | Persist across reloads |
| Generative apps | Sandboxed iframes | Security isolation for agent-generated code |
| Dropdown menus | Custom glass components | shadcn dropdowns are too opaque |

### File Structure (new/modified)

```
frontend/
├── app/
│   ├── globals.css                    # MODIFIED: glass tokens, wallpaper layer
│   └── (app)/stacks/[stackId]/
│       └── page.tsx                   # MODIFIED: full desktop layout
├── components/
│   ├── desktop/                       # NEW: OS desktop components
│   │   ├── desktop-viewport.tsx       # Full-viewport canvas container
│   │   ├── desktop-card.tsx           # Glass card with drag/resize/close
│   │   ├── app-card.tsx              # Generative app card (iframe wrapper)
│   │   ├── card-renderer.tsx          # Block catalog → React components
│   │   ├── auto-placer.ts            # Card placement algorithm
│   │   └── documents-panel.tsx        # File browser panel
│   ├── top-bar/                       # NEW: top bar components
│   │   ├── top-bar.tsx               # Container for three pills
│   │   ├── user-pill.tsx             # Avatar + dropdown menu
│   │   ├── dock-pill.tsx             # Apps + workspaces dock
│   │   ├── system-pill.tsx           # Notifications + settings dropdown
│   │   └── glass-dropdown.tsx        # Shared glass dropdown component
│   ├── chat-bar/                      # NEW: floating chat bar
│   │   ├── chat-bar.tsx              # Single-line input/chips bar
│   │   └── chat-card.tsx             # Floating chat output card
│   ├── wallpaper/                     # NEW: wallpaper system
│   │   ├── wallpaper-layer.tsx       # Background renderer
│   │   └── wallpaper-picker.tsx      # Settings UI for wallpaper selection
│   └── ui/                           # MODIFIED: glass restyling
│       └── ...                       # shadcn components with glass variants
├── lib/stores/
│   ├── desktop-store.ts              # NEW: card positions, sizes, open/closed
│   ├── dock-store.ts                 # NEW: dock apps, workspaces, active state
│   ├── wallpaper-store.ts            # NEW: wallpaper selection + localStorage
│   └── chat-store.ts                 # NEW: chat history, chips state
└── public/
    └── wallpapers/                    # NEW: default wallpaper images
        ├── aqua-blue.webp
        ├── aurora.webp
        ├── midnight.webp
        ├── dusk.webp
        └── slate.webp
```

---

## Constraints

- **Bright wallpapers first** — glass tuned for bright/vibrant backgrounds. Dark wallpaper support is secondary.
- **Readability over aesthetics** — text must remain legible on all glass surfaces. Default to slightly more opaque if in doubt.
- **Performance** — `backdrop-filter: blur()` is GPU-intensive with many layers. Limit visible blurred elements. Cards off-screen should not render blur.
- **Iframe security** — generative apps MUST be sandboxed. No parent DOM access. postMessage only for agent communication.
- **Existing WebSocket protocol** — `canvas_update` messages still work. New message type needed for generative apps (`app_create`, `app_update`).
- **Existing block catalog** — same 8 block types for data cards. Generative apps are a separate rendering path.
- **Tailwind v4 @theme inline** — glass tokens via CSS custom properties in existing pattern.
- **Mobile not targeted** — desktop/laptop only. Spatial canvas doesn't translate to mobile.

---

## Success Criteria

- [ ] Opening a workspace shows full-bleed wallpaper with floating top dock and chat bar — no other chrome
- [ ] Agent can create data cards (table, stat, notes) that float as glass panels over the wallpaper
- [ ] Agent can create a generative app (e.g., calculator) that renders as an interactive iframe in a glass card
- [ ] Glass surfaces are tinted by the wallpaper colours (not neutral gray)
- [ ] Cards can be dragged to new positions
- [ ] Cards can be closed (X button)
- [ ] Chat bar shows suggestion chips that switch to text input when typing
- [ ] Agent text responses appear in a separate Chat card on the canvas
- [ ] Dock shows apps (left) and workspaces (right)
- [ ] Clicking a workspace icon switches the canvas to that workspace's cards
- [ ] User pill dropdown shows profile/settings menu
- [ ] System pill dropdown shows notifications
- [ ] Documents icon opens a floating file browser panel
- [ ] Generative apps can be saved to the dock (pin icon)
- [ ] Wallpaper is changeable and preference persists
- [ ] All glass surfaces show wallpaper bleeding through
- [ ] `npm run build` passes cleanly
- [ ] Page load < 3s first paint

---

## Open Questions

1. **~~One-computer vs one-per-stack~~** — **RESOLVED (Session 143).** One Sprite VM per USER. Workspaces are virtual canvases within the same VM/agent. Agent has full context across all workspaces. This changes the Bridge routing (user_id → sprite, not stack_id → sprite) and the Supabase schema (workspaces are lightweight metadata, not Sprite references).

2. **Generative app persistence** — When a user saves an app to the dock, where is the HTML stored? Options: (a) in the Zustand/localStorage store on the frontend, (b) on the Sprite filesystem, (c) in Sprite SQLite. **Recommendation:** Sprite filesystem (`/workspace/apps/{app_id}/index.html`) so it persists across devices and survives cache clears.

3. **Generative app communication protocol** — How does an iframe app talk back to the agent? Need to define the postMessage schema: `{ type: "agent_request", action: "update_task", data: {...} }`. Agent receives this as a `card_interaction` message. **Needs design.**

4. **Suggestion chip source** — Are chips part of the agent's response, or a separate message type? **Recommendation:** Separate `suggestion_update` message type so the agent can update chips independently.

5. **Notification system** — What generates notifications? Agent actions? Cron completions? Document processing? How are they stored and delivered? **Recommendation:** Defer notifications to post-MVP. Show static demo data for now.

6. **Voice input** — The microphone icon is in the design. When is voice actually implemented? **Recommendation:** Post-MVP. Icon present but non-functional initially. Web Speech API or Whisper when ready.

7. **Workspace switching animation** — Should cards fade/slide when switching workspaces, or instant swap? **Recommendation:** Fade out old cards, fade in new cards. Simple opacity transition.

---

## Decisions Made (Sessions 142-143)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sidebar position | Horizontal top bar (not vertical left sidebar) | Feels more like an OS taskbar. Frees left/right canvas space for cards/panels. |
| Top bar style | Three separate floating pills (not one continuous bar) | More "floaty," wallpaper visible between pills, matches OS aesthetic. |
| Top left pill | App drawer (documents, apps, settings icons) | Opens fixed left-anchored panels. Not a user avatar — user is in the right pill. |
| Top center pill | Workspace tabs (browser tab model) | Users understand tabs. Agent can create/manage them. More intuitive than dock icons. |
| Top right pill | System tray (zoom %, search, notifications, avatar) | Familiar OS pattern. User profile + system status together. |
| Wallpaper brightness | Bright/vibrant (not dark/muted) | Glass looks better over colorful backgrounds. Aqua blue as default. |
| Glass approach | Apple Liquid Glass style — wallpaper tints the glass | Not neutral gray transparency. Glass takes on the wallpaper's colour palette. |
| Canvas model | Infinite canvas with pan/zoom | Not fixed viewport. Users can arrange many cards spatially. Zoom in/out for overview. |
| Canvas interactions | Click-drag=pan, scroll=zoom, right-click=context menu | Familiar canvas patterns (Figma, Miro). Context menu for environment/view settings. |
| Chat design | Dual mode — bottom bar (default) OR right panel | Bottom bar for clean canvas. Right panel for full chat history. User preference. |
| Chat bar design | Single-line pill with chips/input toggle | Clean, minimal. No stacking/expanding. One element. |
| Suggestion chips | Inside the chat bar (replace text field when not typing) | No floating clutter. Chat bar is always useful. |
| Generative apps | Sandboxed iframes in glass cards | Full flexibility for agent-generated UI. Security via sandbox. |
| App saving | Pin to dock / app drawer | Users build a personal toolkit over time. |
| React Flow | Removed | Overkill. CSS transforms for pan/zoom, absolute positioning for cards. |
| Documents panel | Fixed left-anchored panel (not floating card) | File browser needs to stay accessible. Anchored panel doesn't block canvas interaction. |
| VM model | **One Sprite per USER** (not per workspace) | Agent has full context across all workspaces. Simpler routing. One computer metaphor. |

---

## Phasing Recommendation

| Phase | Scope | Why First |
|-------|-------|-----------|
| **Phase A** | Glass desktop + block catalog data cards + chat bar + top dock + workspace switching | Ship the OS *feel* with structured data. Already differentiated from every AI product. |
| **Phase B** | Document extraction on the new UI (upload → OCR → extraction → table cards) | The anchor use case. The thing people pay for. Proves the platform works. |
| **Phase C** | Generative apps (sandboxed iframes) + save to dock | The killer feature. "Type what you need, it appears." |
| **Phase D** | Notifications, automations/cron, voice input, dropdown menus | Platform depth. Engagement features. |

**The pitch:** "Stackdocs is your personal AI accountant that lives on its own computer. Upload documents, talk to it, it extracts your data and builds you tools. It remembers everything and gets smarter over time."

Document extraction is the **wedge**. The generative desktop is the **platform**.

---

## Next Steps

1. `/plan` to create implementation tasks — this supersedes current Phase 3 beads (m7b.4.x)
2. Source 4-5 default wallpaper images (bright abstract gradients, aqua, nature)
3. Evaluate whether existing m7b.4.x beads can be updated or need replacing
4. Design the `card_interaction` and `app_create` message types for generative apps
5. Build a static prototype first (no WebSocket) to validate the glass feel before wiring up the agent
6. Continue iterating on the Google AI Studio prototype for visual reference
