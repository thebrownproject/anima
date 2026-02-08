# Phase 3 Update: Canvas Grid Layout + Agent Prompt

**Goal:** Replace React Flow infinite canvas with react-grid-layout (homescreen widget model) and add Canvas-aware agent system prompt for proactive card creation.

## Overview

Session 136 brainstorm identified that React Flow (whiteboard/diagramming) is the wrong metaphor. The user wants a dashboard of information cards — like smartphone homescreen widgets that snap to a grid, can be dragged to rearrange, and resized between predefined sizes.

The agent also needs system prompt guidance to use Canvas cards proactively as its primary output surface, with text chat serving as short PA-style narration.

This plan amends existing Phase 3 beads (m7b.4.*) and adds one new task.

## Updated Tasks

### Task: Grid layout canvas and base card component (amends m7b.4.2)

**Goal:** Replace React Flow with react-grid-layout for a responsive grid canvas with draggable, resizable cards.
**Files:** Modify `frontend/components/canvas/stack-canvas.tsx`, modify `frontend/components/canvas/canvas-card.tsx`, modify `frontend/app/(app)/test-chat/page.tsx`, modify `frontend/package.json`
**Depends on:** None

**Steps:**
1. Remove `@xyflow/react` dependency, install `react-grid-layout` + `@types/react-grid-layout`
2. Rewrite `stack-canvas.tsx`: Use `<ResponsiveGridLayout>` with breakpoints (lg=3col, md=2col, sm=1col). Row height TBD based on testing. No zoom, no pan — natural page scroll.
3. Restyle `canvas-card.tsx`: Remove React Flow node wrapper (NodeResizer, Handle). Keep title bar (drag handle, title, close button) + scrollable body with CardRenderer. Use shadcn Card styling.
4. Card sizes map to grid units: small (w=1), medium (w=2), large (w=2, taller h), full (w=3). Height auto-sizes or uses content-based calculation.
5. New cards append to bottom of grid (simplest auto-placement).
6. Update test-chat page: Remove React Flow imports, use grid layout.
7. Update `frontend/types/ws-protocol.ts`: Add `size` field to CanvasUpdatePayload, remove card_type.
8. Keep `card-renderer.tsx` unchanged — block rendering is layout-independent.

**Tests:**
- [ ] Cards display in responsive grid (3 col desktop, 2 tablet, 1 mobile)
- [ ] Cards can be dragged to rearrange (other cards reflow)
- [ ] Cards can be resized between small/medium/large/full widths
- [ ] No zoom or pan controls — page scrolls naturally
- [ ] Card renders title bar with drag handle and close button
- [ ] CardRenderer still renders blocks array top-to-bottom
- [ ] New cards appear at bottom of grid (auto-placement)
- [ ] Visual styling is clean, content-first (no grid dots, A2UI-inspired)
- [ ] test-chat page works with grid layout
- [ ] `npm run build` passes with no TypeScript errors

---

### Task: Agent system prompt + canvas tool API update (NEW)

**Goal:** Update agent system prompt for proactive Canvas card usage and align tool API with grid layout (size instead of card_type).
**Files:** Modify `sprite/src/runtime.py`, modify `sprite/src/agents/shared/canvas_tools.py`, modify `sprite/src/protocol.py`, modify `bridge/src/protocol.ts`
**Depends on:** None (can be done in parallel with m7b.4.2)

**Steps:**
1. Update `DEFAULT_SYSTEM_PROMPT` in `runtime.py` with Canvas section (PA framing, proactive card creation, short text replies, card size guidance, block composition patterns, update vs create rules).
2. Update `create_card` tool in `canvas_tools.py`: Replace `card_type` parameter with `size` parameter (small/medium/large/full, default medium). Update tool description. Update validation.
3. Update `sprite/src/protocol.py`: Add `size` field to `CanvasUpdate`/`CanvasUpdatePayload`. Remove card_type references.
4. Update `bridge/src/protocol.ts`: Add `size` field to `CanvasUpdatePayload`. Remove card_type references.
5. Update tool description to include size guidance matching the system prompt.

**Tests:**
- [ ] `create_card` tool accepts `size` parameter (small/medium/large/full)
- [ ] `create_card` rejects invalid size values
- [ ] `create_card` defaults to "medium" when size omitted
- [ ] `card_type` parameter no longer accepted
- [ ] System prompt includes Canvas section with PA framing
- [ ] Protocol types include `size` field in all 3 codebases (bridge, frontend, sprite)
- [ ] Agent on test sprite proactively creates cards when given structured information
- [ ] Agent text replies are short and reference cards (not duplicating content)

---

### Task: MVP block components (amends m7b.4.3)

**Goal:** Extract 8 block components from inline card-renderer.tsx into individual files with polished A2UI-inspired styling.
**Files:** Create `frontend/components/canvas/blocks/` directory with 8 files.
**Depends on:** Grid layout canvas (m7b.4.2)

No change to block types or functionality. The inline renderers in card-renderer.tsx become proper components with better styling. No card_type dependency — blocks are layout-independent.

---

### Task: Canvas Zustand store with WS integration (amends m7b.4.5)

**Goal:** Centralized state for canvas cards with localStorage persistence and WebSocket message handling.
**Files:** Create `frontend/lib/stores/canvas-store.ts`
**Depends on:** Grid layout canvas (m7b.4.2), WebSocket connection manager (m7b.4.1 — done)

**Key changes from original:**
- Card model: `{ title, blocks, size, layout: {x, y, w, h} }` — no `card_type`
- `size` field (small/medium/large/full) maps to grid width units
- Layout positions stored per-breakpoint (react-grid-layout responsive model)
- No "pan to focus" — grid layout doesn't pan

---

### Task: Subbar, chat bar, and status indicator (amends m7b.4.6)

**Goal:** Card manager, chat input, connection status.
**Depends on:** Canvas Zustand store (m7b.4.5)

**Key changes from original:**
- Subbar: Click tab → scroll to card (not pan, since no infinite canvas)
- Chat bar: Unchanged
- Connection status: Unchanged

---

### Task: Stack page rewrite for Canvas layout (amends m7b.4.7)

**Goal:** Replace tab-based stack detail view with grid canvas + chat layout.
**Depends on:** Subbar, chat bar (m7b.4.6)

**Key changes from original:**
- Canvas scrolls naturally (no viewport clamping needed for pan/zoom)
- Grid layout fills available space, overflow scrolls

---

### Task: CSV and JSON export (m7b.4.8)

No changes.

## Sequence

1. m7b.4.2 (grid layout) + NEW task (prompt + tool API) — **parallel, no dependencies**
2. m7b.4.3 (block components) — depends on m7b.4.2
3. m7b.4.5 (Zustand store) — depends on m7b.4.2
4. m7b.4.6 (subbar/chat) — depends on m7b.4.5
5. m7b.4.7 (stack page) — depends on m7b.4.6
6. m7b.4.8 (export) — depends on m7b.4.3

## Success Criteria

- [ ] Cards display in responsive grid layout (no React Flow)
- [ ] Agent proactively creates cards without being asked
- [ ] Agent text replies are short PA-style narration
- [ ] Cards draggable and resizable between predefined sizes
- [ ] No zoom/pan — clean scrolling interface
- [ ] A2UI-inspired visual quality
