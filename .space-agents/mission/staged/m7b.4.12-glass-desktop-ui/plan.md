# Feature: Glass Desktop UI (Phase A)

**Goal:** Ship the spatial glass desktop OS interface with data cards, chat, top bar, and workspace switching — replacing the v1 sidebar/header shell for workspace views.

**Spec:** `spec.md` (this folder)
**Prototype:** `frontend/app/(app)/test-chat/page.tsx` (529 lines — most code ports from here)
**Ein UI components:** glass-card, glass-button, glass-tabs, glass-input, glass-dock (already installed)

## Overview

Phase A delivers the "OS feel" — a glass desktop with wallpaper, infinite canvas, agent-created data cards, chat bar, top bar, and workspace switching. This is the first user-visible step toward the "personal AI computer" vision. Generative apps (Phase C), document extraction (Phase B), and notifications (Phase D) come later.

**What's already done:** Ein UI registry configured, 5 glass components installed, prototype with wallpaper + top bar + chat bar + assistant panel working in test-chat.

**What this plan does NOT include:**
- "1 VM per user" Bridge routing change (infrastructure — tracked separately)
- Generative app iframe cards (Phase C)
- Voice input (Phase D — icon present but non-functional)
- Notification system (Phase D)
- Real document panel integration with Sprite filesystem (Phase B)
- Workspace CRUD persistence to Sprite SQLite (needs Sprite runtime)

**Stale beads to close:** m7b.4.2, m7b.4.3, m7b.4.5, m7b.4.6, m7b.4.7 (all assume react-grid-layout + `(app)/` route group — fully superseded by this plan).

## Tasks

### Task: Desktop route group + glass tokens

**Goal:** Create the `(desktop)/` route group with minimal layout and add glass CSS custom properties.
**Files:** Create `frontend/app/(desktop)/layout.tsx`, create `frontend/app/(desktop)/stacks/[id]/page.tsx`, modify `frontend/app/globals.css`
**Depends on:** None

**Steps:**
1. Create `frontend/app/(desktop)/layout.tsx` — minimal, no sidebar, no parallel routes, no v1 context providers. Just auth protection via Clerk.
2. Create `frontend/app/(desktop)/stacks/[id]/page.tsx` — `'use client'` component that will compose all desktop sub-components. Initially renders empty placeholder divs for wallpaper, top bar, canvas, chat bar.
3. Add glass CSS tokens to `globals.css` under `@theme inline`: `--glass-chrome-bg`, `--glass-chrome-blur`, `--glass-card-bg`, `--glass-card-blur`, `--glass-card-radius`, `--glass-card-shadow`, `--ease-apple: cubic-bezier(0.2, 0.8, 0.2, 1)`.
4. Add `@keyframes animate-scan` CRT keyframe (needed later for generative cards).

**Tests:**
- [ ] Navigating to `(desktop)/stacks/test-id` renders the desktop page (not the v1 layout)
- [ ] `(app)/` routes still work unchanged at `/documents`, `/stacks`
- [ ] Glass CSS variables accessible in browser DevTools
- [ ] `npm run build` passes cleanly

---

### Task: Wallpaper layer + wallpaper store

**Goal:** Full-bleed wallpaper background with selectable presets and localStorage persistence.
**Files:** Create `frontend/lib/stores/wallpaper-store.ts`, create `frontend/components/wallpaper/wallpaper-layer.tsx`, create `frontend/components/wallpaper/wallpaper-picker.tsx`
**Depends on:** Desktop route group

**Steps:**
1. Create wallpaper-store.ts — Zustand + localStorage persist. Shape: `{ url: string, setWallpaper: (url: string) => void }`. Default to first gradient.
2. Create wallpaper-layer.tsx — full-bleed `position: fixed; z-index: -1` div. Reads from wallpaper store. Applies `background-image` or `background` (supports both gradients and images).
3. Create wallpaper-picker.tsx — circle swatch row ported from prototype's `WallpaperPicker`. 8 CSS gradient presets initially.
4. Wire both into the desktop page.

**Tests:**
- [ ] Wallpaper fills entire viewport behind all content
- [ ] Clicking a swatch changes the wallpaper
- [ ] Selected wallpaper persists across page reload (localStorage)
- [ ] No layout shift or flash on initial load

---

### Task: Infinite canvas viewport

**Goal:** CSS transform-based infinite canvas with pan and zoom, replacing react-grid-layout.
**Files:** Create `frontend/components/desktop/desktop-viewport.tsx`
**Depends on:** Desktop route group, Zustand stores (reads/writes `view` from desktop-store)

**Steps:**
1. Port prototype's pan/zoom logic: `transform: translate(panX, panY) scale(zoom)` container.
2. Pointer events: click-drag on empty space pans, scroll wheel zooms (min 0.25, max 2.0).
3. Position/zoom indicator in bottom-right: `POS: x, y` and `ZM: %`.
4. `e.target` check to distinguish canvas panning from card dragging.
5. `useEffect` for `window`-dependent values (SSR-safe — no top-level `window` access).
6. Accepts `children` prop for card rendering.

**Tests:**
- [ ] Click-dragging on empty canvas pans the view
- [ ] Scroll wheel zooms in/out with visible scale change
- [ ] POS and ZM indicators update during pan/zoom
- [ ] Zoom clamped to min/max range
- [ ] Children render at correct positions within transformed space
- [ ] No SSR errors (no `window` access during render)

---

### Task: Desktop card component

**Goal:** Glass card wrapper with title bar, pointer-event drag, and mount/close animations.
**Files:** Create `frontend/components/desktop/desktop-card.tsx`
**Depends on:** Infinite canvas viewport, Zustand stores (reads `scale` from desktop-store, calls `moveCard`/`removeCard`/`bringToFront`)

**Note:** Cards must be direct children of `AnimatePresence` in the viewport — no extra wrapper divs between `AnimatePresence` and `motion.div`, or exit animations won't fire.

**Steps:**
1. Glass card using Ein UI `GlassCard` as base. Title bar: title text + "..." options menu + close X button.
2. Pointer-event drag: `e.movementX / scale` for zoom-aware movement. `onPointerDown/Move/Up` handlers.
3. Props: `title`, `position: {x, y}`, `zIndex`, `onMove`, `onClose`, `children`.
4. Drag state: `scale(1.02)` + larger shadow, transitions disabled during drag.
5. Mount animation: opacity 0→1, scale 0.95→1 (CSS transition, 400ms, `--ease-apple`).
6. Close animation: `motion` `AnimatePresence` for unmount (opacity 1→0, scale 1→0.95, 300ms).

**Tests:**
- [ ] Card renders with title bar, options button, close button
- [ ] Dragging title bar moves the card (not the canvas)
- [ ] Movement is zoom-aware (correct at different zoom levels)
- [ ] Close button triggers onClose callback
- [ ] Mount animation plays on creation
- [ ] Unmount animation plays before removal (not instant disappear)

---

### Task: Zustand stores (desktop + chat)

**Goal:** Centralized state for canvas cards and chat messages.
**Files:** Create `frontend/lib/stores/desktop-store.ts`, create `frontend/lib/stores/chat-store.ts`
**Depends on:** None (pure Zustand, independent of UI components)

**Steps:**
1. Desktop store: `cards: Record<string, DesktopCard>`, `view: {x, y, scale}`, `activeWorkspace: string`, `maxZIndex: number`. Actions: `addCard`, `updateCard`, `removeCard`, `moveCard`, `setView`, `bringToFront`, `setActiveWorkspace`. Zustand + localStorage persist (use `Record` not `Map` for JSON serialization).
2. Chat store: `messages: ChatMessage[]`, `chips: SuggestionChip[]`, `mode: 'bar' | 'panel'`, `isTyping: boolean`, `isAgentStreaming: boolean`. Actions: `addMessage`, `appendToLastAgent`, `setChips`, `setMode`, `setTyping`, `clearMessages`. NOT persisted (ephemeral).
3. `appendToLastAgent` handles streaming: if last message is agent role, append content; else create new message.

**Tests:**
- [ ] `addCard` creates entry retrievable by card_id
- [ ] `updateCard` merges new fields without losing position
- [ ] `removeCard` deletes from store
- [ ] `bringToFront` assigns highest z-index
- [ ] Desktop store persists to localStorage and restores on reload
- [ ] `addMessage` appends to messages array
- [ ] `appendToLastAgent` merges when last message is agent role
- [ ] Chat store is NOT persisted to localStorage

---

### Task: WebSocket provider + canvas_update wiring

**Goal:** React context provider that manages WS connection and dispatches messages to Zustand stores.
**Files:** Create `frontend/components/desktop/ws-provider.tsx`
**Depends on:** Zustand stores

**Steps:**
1. Lift WS connection pattern from `test-chat/page.tsx` into a `WebSocketProvider` context.
2. Expose `useWebSocket()` hook: `{status, error, connect, disconnect, send}`.
3. Use `useRef` for WS manager (prototype pattern — avoid re-render on every message).
4. Message dispatch: `canvas_update` → desktop-store (`create_card`→`addCard`, `update_card`→`updateCard`, `close_card`→`removeCard`); `agent_event` → chat-store (`addMessage`/`appendToLastAgent`); `system` → connection status.
5. Takes `stackId` prop from route param. Uses Clerk `useAuth().getToken` for auth.
6. Create `frontend/components/desktop/auto-placer.ts` — when card has no position, place in spiral/grid pattern offset from viewport center.
7. Cleanup on unmount (calls `destroy()`).

**Tests:**
- [ ] `useWebSocket()` returns connection status and methods
- [ ] `canvas_update` with `create_card` → card appears in desktop-store
- [ ] `canvas_update` with `update_card` → card blocks updated in store
- [ ] `canvas_update` with `close_card` → card removed from store
- [ ] `agent_event` text messages accumulate in chat-store
- [ ] Auto-placement positions new cards without overlap
- [ ] Cleanup on unmount

---

### Task: Top bar (three floating pills)

**Goal:** OS-style top bar with app drawer, workspace tabs, and system tray.
**Files:** Create `frontend/components/top-bar/top-bar.tsx`, `app-drawer-pill.tsx`, `workspace-tabs-pill.tsx`, `system-tray-pill.tsx`
**Depends on:** Desktop route group, Zustand stores (reads zoom from desktop-store)

**Steps:**
1. `top-bar.tsx` — container flex row, 3 pills with gaps, ~16px from top edge.
2. `app-drawer-pill.tsx` — left. 3 circular glass buttons: documents (opens left panel), grid/apps, settings. Ported from prototype's app circles.
3. `workspace-tabs-pill.tsx` — center. GlassTabs with workspace names + colored status dots. "+" button for new workspace. Back "<" button. Hardcoded workspace list for now.
4. `system-tray-pill.tsx` — right. Zoom % (reads `desktop-store.view.scale`), search icon, bell icon, Clerk `UserButton` for avatar.
5. All pills same height (~48px), glass chrome styling.

**Tests:**
- [ ] Three pills render in row with wallpaper visible between them
- [ ] Left pill shows 3 app circle icons
- [ ] Center pill shows workspace tabs with active highlight
- [ ] Right pill shows zoom %, search, bell, avatar
- [ ] Zoom percentage reflects actual canvas zoom from desktop-store

---

### Task: Chat bar (bottom pill)

**Goal:** Bottom-center chat pill with suggestion chips / text input toggle.
**Files:** Create `frontend/components/chat-bar/chat-bar.tsx`
**Depends on:** Zustand stores (chat-store), WebSocket provider

**Steps:**
1. Port from prototype's ChatBar. Single-line layout: paperclip (left), chips OR input (center), keyboard + mic + chat-toggle (right).
2. Reads chips from chat-store. When `mode === 'panel'`, chat bar slides down with `translateY(150%)`.
3. Chips ↔ input transition: CSS cross-fade with opposing Y-translate (300ms).
4. Enter sends message via `useWebSocket().send()`. No send button. No placeholder.
5. Clicking chat icon sets `chat-store.mode = 'panel'`.

**Tests:**
- [ ] Chat bar renders as floating pill at bottom center
- [ ] Suggestion chips display when input empty
- [ ] Typing or keyboard icon switches to text input
- [ ] Empty input switches back to chips
- [ ] Enter sends message and clears input
- [ ] Chat icon toggles mode to 'panel'
- [ ] Bar slides down when mode is 'panel'

---

### Task: Restyle card-renderer for glass

**Goal:** Update block components to use glass-appropriate colors instead of shadcn theme tokens.
**Files:** Modify `frontend/components/canvas/card-renderer.tsx`
**Depends on:** Desktop card component (to visually verify on glass)

**Steps:**
1. Replace `bg-muted` → `bg-white/5`, `text-muted-foreground` → `text-white/60`, `border-border` → `border-white/10`.
2. Keep same 8 block types and structure — only CSS class changes.
3. Badge variants still visually distinct on glass (use semi-transparent colored backgrounds).
4. Table headers, rows use white/alpha styling.
5. Test over multiple wallpapers.

**Tests:**
- [ ] All 8 block types render with glass-appropriate colors
- [ ] Text legible on glass over bright wallpapers
- [ ] Badge variants still visually distinct
- [ ] No `bg-muted`, `text-muted-foreground`, or `border-border` references remain
- [ ] `npm run build` passes (v1 routes don't use CardRenderer — canvas-only component)

---

### Task: Chat panel (right side)

**Goal:** Right-side assistant panel with full chat history (dual chat mode 2).
**Files:** Create `frontend/components/chat-bar/chat-panel.tsx`, create `frontend/lib/hooks/use-panel.ts`
**Depends on:** Zustand stores (chat-store), WebSocket provider

**Steps:**
1. Port from prototype's assistant panel. Fixed glass panel, right edge, full height below top bar.
2. Title bar: "Assistant" + green status dot + minimize button.
3. Scrollable chat history from chat-store. User messages right, agent messages left.
4. Text input at bottom with attach + send.
5. Slide-in from right: CSS transition `translateX(110%)` → `translateX(0)`, 500ms.
6. Create `use-panel.ts` hook (~20 lines): Escape-to-close, click-outside-to-dismiss. No overlay.
7. Minimize sets chat-store mode back to 'bar'. Chat bar slides up as panel closes (coordinated transition).

**Tests:**
- [ ] Panel slides in from right when mode is 'panel'
- [ ] Full chat history visible and scrollable
- [ ] User messages right-aligned, agent messages left
- [ ] Minimize returns to chat bar mode
- [ ] Escape closes panel
- [ ] Canvas remains interactive (no overlay)
- [ ] Text input sends messages via WebSocket

---

### Task: Documents panel (left-anchored)

**Goal:** Left-side file browser panel triggered from app drawer.
**Files:** Create `frontend/components/desktop/documents-panel.tsx`
**Depends on:** Desktop route group, Chat panel (creates `use-panel` hook)

**Steps:**
1. Fixed glass panel, left edge, full height below top bar. Triggered by documents icon in app drawer pill.
2. File tree with folders (My Drive, Active Projects, Invoices) + files with type icons.
3. Search bar at top for client-side filtering.
4. Storage indicator at bottom.
5. Slide-in from left: `translateX(-110%)` → `translateX(0)`, 500ms.
6. **Phase A is a static mockup** — file tree data is hardcoded. Phase B wires to Sprite filesystem.
7. Uses `usePanel` hook for Escape/click-outside dismiss.

**Tests:**
- [ ] Panel slides in from left when documents icon clicked
- [ ] File tree renders with folders and files
- [ ] Search filters the tree
- [ ] Storage indicator visible
- [ ] Escape/click-outside closes panel
- [ ] No overlay blocking canvas

---

### Task: Source wallpaper images

**Goal:** Add 4-5 default wallpaper images (real photos/art, not just CSS gradients).
**Files:** Add `frontend/public/wallpapers/*.webp`, update wallpaper store + picker
**Depends on:** Wallpaper layer + store

**Steps:**
1. Source 4-5 royalty-free images (Unsplash/Pexels): aqua-blue, aurora, midnight, dusk, slate.
2. Optimize to WebP, 2560x1600, under 500KB each.
3. Place in `frontend/public/wallpapers/`.
4. Update wallpaper store to support image URLs alongside CSS gradients.
5. Update wallpaper-picker to show image thumbnails.

**Tests:**
- [ ] 4-5 wallpaper images exist in `public/wallpapers/`
- [ ] Each under 500KB
- [ ] Picker shows thumbnails alongside gradient swatches
- [ ] Image wallpaper renders as full-bleed background
- [ ] Glass surfaces visibly tinted by wallpaper colors

## Sequence

Optimal execution order (serial, single-worker):

```
1. Desktop route group + glass tokens     (no deps — foundation)
2. Zustand stores (desktop + chat)        (no deps — pure state, needed by viewport+card)
3. Wallpaper layer + store                (depends on 1)
4. Infinite canvas viewport               (depends on 1, 2)
5. Desktop card                           (depends on 2, 4)
6. WS provider + canvas_update wiring     (depends on 2)
7. Top bar                                (depends on 1, 2)
8. Chat bar                               (depends on 2, 6)
9. Restyle card-renderer                  (depends on 5)
10. Chat panel                            (depends on 2, 6)
11. Documents panel                       (depends on 1, 10 — uses use-panel hook)
12. Wallpaper images                      (depends on 3)
```

**Why stores moved to task 2:** The viewport reads/writes `view: {x, y, scale}` from desktop-store. The card reads `scale` and calls `moveCard`/`removeCard`/`bringToFront`. Both need the store to exist before they can be built.

**Minimal vertical slice** (tasks 1-6): User opens workspace → sees wallpaper → agent creates glass cards on infinite canvas → cards can be dragged. The core "agent renders on spatial desktop" loop works end-to-end.

**Parallelism** (if using parallel agents):
- Worker A (visual): 1 → 3 → 4 → 5 → 9
- Worker B (state + chrome): 2 → 6 → 7 → 8 → 10 → 11 → 12
- (Workers converge: A needs stores from B at task 4, B needs route from A at task 6)

**Critical path bottleneck:** Task 4 (infinite canvas viewport) — only non-trivial greenfield code. Everything else is porting from the 529-line test-chat prototype.

## Success Criteria

- [ ] Opening `/stacks/[id]` via (desktop)/ route shows wallpaper + glass chrome — no sidebar, no header
- [ ] Agent can create data cards (table, stat, key-value) that float as glass panels over wallpaper
- [ ] Glass surfaces are tinted by the wallpaper colors
- [ ] Cards can be dragged to new positions (zoom-aware)
- [ ] Cards can be closed (X button) with exit animation
- [ ] Canvas supports pan (click-drag) and zoom (scroll wheel)
- [ ] Chat bar shows suggestion chips that switch to text input when typing
- [ ] Chat panel (right side) shows full conversation history
- [ ] Top bar shows workspace tabs, app icons, system tray
- [ ] Documents panel slides in from left
- [ ] Wallpaper is changeable and preference persists
- [ ] `npm run build` passes cleanly
- [ ] `(app)/` v1 routes still work unchanged
