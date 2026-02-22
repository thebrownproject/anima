# Feature: Light Mode + shadcn Chrome Migration

**Goal:** Replace glassmorphism chrome with shadcn/ui components and CSS variable styling so the desktop renders cleanly on a light (zinc-50) background. Cards stay untouched.

## Overview

The Stackdocs desktop has 108 hardcoded dark-mode patterns (`bg-white/10`, `text-white/70`, `backdrop-blur-xl`) across 17 chrome files. The shadcn CSS variable system already exists in `globals.css` with light-mode `:root` values, but glass components ignore it entirely.

Two-pronged approach:
1. **Replace** 5 glass components with real shadcn equivalents (Button, Card, Tooltip, ContextMenu), archive the old files
2. **Restyle** 3 custom components (TabSwitcher, SidePanel, Pill) to use shadcn CSS variable classes

4 files created, 7 archived, ~18 modified. 4 waves with parallel opportunities in Waves 2 and 3.

## Tasks

### Task: Add missing shadcn primitives and archive dead glass files

**Goal:** Install shadcn card, tooltip, and context-menu (they don't exist yet), archive dead-code glass-input.tsx and glass-tabs.tsx.
**Files:** Create `card.tsx`, `tooltip.tsx`, `context-menu.tsx` via shadcn CLI. Create `_archived-glass/` dir. Move `glass-input.tsx`, `glass-tabs.tsx` to archive.
**Depends on:** None

**Steps:**
1. Run `pnpm dlx shadcn@latest add card tooltip context-menu` in frontend/
2. Create `frontend/components/ui/_archived-glass/` directory
3. Move `glass-input.tsx` and `glass-tabs.tsx` to `_archived-glass/` (zero consumers confirmed)
4. Verify `pnpm build` passes
5. Grep for any stale imports of glass-input or glass-tabs (expect zero)

**Tests:**
- [ ] `card.tsx`, `tooltip.tsx`, `context-menu.tsx` exist in `frontend/components/ui/`
- [ ] `glass-input.tsx` and `glass-tabs.tsx` in `_archived-glass/`
- [ ] `pnpm build` passes

### Task: Replace GlassButton, GlassIconButton, and GlassTooltip with shadcn

**Goal:** Create new IconButton wrapper using shadcn Button + Tooltip, update all consumers, swap GlassTooltipProvider for shadcn TooltipProvider, archive 3 glass files.
**Files:** Create `icon-button.tsx`. Modify `desktop/page.tsx`, `desktop-top-bar.tsx`, `chat-bar.tsx`, `documents-panel.tsx`, `glass-side-panel.tsx`, `persona-orb.tsx`, 3 test files. Archive `glass-button.tsx`, `glass-icon-button.tsx`, `glass-tooltip.tsx`.
**Depends on:** Add missing shadcn primitives

**Steps:**
1. Create `frontend/components/ui/icon-button.tsx` wrapping shadcn `Button variant="ghost" size="icon"` + `Tooltip`. Match GlassIconButton prop interface (icon, tooltip, tooltipSide, onClick, className, disabled, aria-label).
2. Update `desktop/page.tsx`: GlassTooltipProvider -> TooltipProvider from shadcn tooltip
3. Update 4 desktop consumers: swap GlassIconButton import for IconButton (desktop-top-bar, chat-bar, documents-panel, glass-side-panel)
4. Update `persona-orb.tsx`: GlassTooltip -> shadcn Tooltip directly
5. Update 3 test files: GlassTooltipProvider -> TooltipProvider
6. Verify shadcn tooltip exports TooltipProvider (add export if missing)
7. Archive glass-button.tsx, glass-icon-button.tsx, glass-tooltip.tsx
8. Grep for any remaining glass-button/glass-icon-button/glass-tooltip imports (expect zero)

**Tests:**
- [ ] `pnpm build` passes
- [ ] `pnpm test:run` passes (all test files)
- [ ] Zero grep hits for GlassButton, GlassIconButton, GlassTooltip in non-archived files
- [ ] Icon buttons render with `text-muted-foreground` (not `text-white/70`)

### Task: Replace GlassCard and GlassContextMenu with shadcn

**Goal:** Swap GlassCard for shadcn Card in desktop-card fallback, swap GlassContextMenu for shadcn ContextMenu in desktop-context-menu, archive 2 glass files.
**Files:** Modify `desktop-card.tsx`, `desktop-context-menu.tsx`. Archive `glass-card.tsx`, `glass-context-menu.tsx`.
**Depends on:** Add missing shadcn primitives

**Steps:**
1. Update `desktop-card.tsx` default case: GlassCard -> shadcn Card. Restyle title bar and buttons: `border-white/[0.08]` -> `border-border`, `text-white/90` -> `text-foreground`, `hover:bg-white/10` -> `hover:bg-accent`, `text-white/40` -> `text-muted-foreground`. Soften drag shadow to `shadow-xl`.
2. Update `desktop-context-menu.tsx`: GlassContextMenu -> shadcn ContextMenu. Restyle DesktopMenuBody: `text-white/40` -> `text-muted-foreground`, `text-white/70` -> `text-foreground`, `bg-white/10` separators -> `bg-border`, `hover:bg-white/10` -> `hover:bg-accent`.
3. Archive glass-card.tsx, glass-context-menu.tsx
4. Grep for remaining glass-card/glass-context-menu imports (expect zero)

**Tests:**
- [ ] `pnpm build` passes
- [ ] Default card fallback has solid white background, dark text, `border-border`
- [ ] Right-click context menu has opaque background, dark labels, visible separators
- [ ] Zero grep hits for GlassCard, GlassContextMenu in non-archived files

### Task: Restyle GlassTabSwitcher and desktop top bar chrome

**Goal:** Restyle tab switcher and top bar for light mode. Dark text, subtle borders, no backdrop-blur.
**Files:** Modify `glass-tab-switcher.tsx`, `desktop-top-bar.tsx`.
**Depends on:** Replace GlassButton/GlassIconButton/GlassTooltip (top-bar imports changed)

**Steps:**
1. Restyle `glass-tab-switcher.tsx`: container `bg-white/10 backdrop-blur-xl` -> `bg-card border-border shadow-sm`. Indicator `bg-white/20` -> `bg-accent`. Active tab `text-white` -> `text-foreground`. Inactive `text-white/50` -> `text-muted-foreground`. Tab hover `bg-white/5` -> `bg-accent/50`. TabMenuPopover: `bg-white/10` -> `bg-popover`, `text-white/60` -> `text-muted-foreground`. Close button: `hover:bg-white/10` -> `hover:bg-accent`.
2. Restyle `desktop-top-bar.tsx`: launcherClass `border-white/20 bg-white/10 backdrop-blur-2xl` -> `border-border bg-card shadow-sm`. Fallback "Stackdocs" pill: same pattern + `text-white/40` -> `text-muted-foreground`.

**Tests:**
- [ ] `pnpm build` passes
- [ ] Zero `white/` or `backdrop-blur` patterns in these 2 files
- [ ] Active tab text is `text-foreground`, inactive is `text-muted-foreground`
- [ ] Tab container has solid background on light canvas

### Task: Restyle GlassSidePanel and ChatPanel

**Goal:** Restyle side panel and chat messages for light mode. Solid backgrounds, dark text, remove prose-invert.
**Files:** Modify `glass-side-panel.tsx`, `chat-panel.tsx`.
**Depends on:** Replace GlassButton/GlassIconButton/GlassTooltip (side panel uses IconButton)

**Steps:**
1. Restyle `glass-side-panel.tsx`: container `bg-white/10 backdrop-blur-2xl border-white/20` -> `bg-card border-border shadow-lg`. Title `text-white/90` -> `text-foreground`.
2. Restyle `chat-panel.tsx`: system messages `text-white/40` -> `text-muted-foreground`. User bubble `bg-white/15 text-white` -> `bg-primary text-primary-foreground`. Agent bubble `bg-white/5 text-white/90` -> `bg-muted text-foreground`. Remove `prose-invert`. Timestamps `text-white/25` -> `text-muted-foreground`. Typing dots `bg-white/40` -> `bg-muted-foreground`. Soften streaming glow for light.

**Tests:**
- [ ] `pnpm build` and `pnpm test:run` pass
- [ ] Zero `white/` or `backdrop-blur` patterns in these 2 files
- [ ] `prose-invert` removed
- [ ] User and agent bubbles visually distinct on light background

### Task: Restyle ChatBar

**Goal:** Restyle bottom chat bar for light mode. Solid white background, dark text, muted placeholder.
**Files:** Modify `chat-bar.tsx`.
**Depends on:** Replace GlassButton/GlassIconButton/GlassTooltip (chat bar uses IconButton)

**Steps:**
1. Suggestion chips: `bg-white/8 text-white/70 backdrop-blur-xl` -> `bg-card text-muted-foreground shadow-sm`, hover: `hover:bg-accent hover:text-foreground`.
2. Main bar container: `bg-white/10 backdrop-blur-2xl border-white/20` -> `bg-card border-border shadow-lg`. Streaming variant: `border-primary/20` with softened glow.
3. Streaming pulse gradient: soften opacities from `/5` to `/3` for light background.
4. Textarea: `text-white placeholder:text-white/30` -> `text-foreground placeholder:text-muted-foreground`.
5. "Ask anything..." placeholder: `text-white/30` -> `text-muted-foreground`.
6. Spinner: `text-white/70` -> `text-muted-foreground`.

**Tests:**
- [ ] `pnpm build` and `pnpm test:run` pass (all 20 chat-bar tests)
- [ ] Zero `white/` or `backdrop-blur` patterns in `chat-bar.tsx`
- [ ] Textarea text dark, placeholder muted grey
- [ ] Suggestion chips readable on light background

### Task: Restyle DocumentsPanel, FileTree, and GlassPill

**Goal:** Restyle documents panel storage bar, file tree items, and system tray pill for light mode.
**Files:** Modify `documents-panel.tsx`, `file-tree.tsx`, `glass-pill.tsx`.
**Depends on:** Replace GlassButton/GlassIconButton/GlassTooltip (documents panel uses IconButton)

**Steps:**
1. `documents-panel.tsx`: storage labels `text-white/40` -> `text-muted-foreground`, `text-white/60` -> `text-foreground`. Bar track `bg-white/10` -> `bg-muted`. File icons `text-white/50` -> `text-muted-foreground`.
2. `file-tree.tsx`: folder/file hover `hover:bg-white/10` -> `hover:bg-accent`. Selected `bg-white/15` -> `bg-accent`. Chevron/icons `text-white/40` -> `text-muted-foreground`. Names `text-white/70` -> `text-foreground`. Indent line `border-white/10` -> `border-border`.
3. `glass-pill.tsx`: container `bg-white/10 backdrop-blur-2xl border-white/20 shadow-[...]` -> `bg-card border-border shadow-sm`.

**Tests:**
- [ ] `pnpm build` passes
- [ ] Zero `white/` or `backdrop-blur` patterns in these 3 files
- [ ] File tree hover shows accent background
- [ ] GlassPill has solid background with subtle border

### Task: Restyle supporting components (viewport, wallpaper, connection, voice)

**Goal:** Final pass on smaller components: HUD text, wallpaper thumbnails, connection status, voice bars, persona orb.
**Files:** Modify `desktop-viewport.tsx`, `wallpaper-thumbnail.tsx`, `connection-status.tsx`, `voice-bars.tsx`, `persona-orb.tsx`.
**Depends on:** Replace GlassButton/GlassIconButton/GlassTooltip (persona-orb tooltip import)

**Steps:**
1. `desktop-viewport.tsx`: HUD `text-white/40` -> `text-muted-foreground`.
2. `wallpaper-thumbnail.tsx`: selected `border-white/50` -> `border-primary`. Unselected `border-white/15` -> `border-border`, hover `border-white/30` -> `border-muted-foreground`.
3. `connection-status.tsx`: base `text-white/80 backdrop-blur-2xl` -> `text-foreground`. Connecting `bg-white/10 border-white/20` -> `bg-card border-border`. Spinner `text-white/70` -> `text-muted-foreground`. Status text: amber `text-amber-300/90` -> `text-amber-600`, red `text-red-300/90` -> `text-red-600`.
4. `voice-bars.tsx`: bar fill `bg-white/70` -> `bg-muted-foreground`.
5. `persona-orb.tsx`: placeholder `border-white/20 from-white/20 to-white/5` -> `border-border from-muted to-muted/50`.

**Tests:**
- [ ] `pnpm build` and `pnpm test:run` pass
- [ ] HUD text readable on light background
- [ ] Connection status colors readable for all states on light
- [ ] Voice bars visible on light background

### Task: Final cleanup and verification

**Goal:** Verify zero glass remnants, remove unused Ein UI CSS variables, verify archive completeness.
**Files:** Modify `globals.css`. Verify all chrome files.
**Depends on:** All previous tasks

**Steps:**
1. Grep `bg-white/`, `text-white/`, `border-white/`, `backdrop-blur` across frontend/components/ and frontend/app/ (excluding `_archived-glass/`, `debug/`, `cards/`). Fix any remaining hits.
2. Remove Ein UI CSS variables from `globals.css` (lines ~64-80): `--glass-bg`, `--glass-border`, `--glass-blur`, `--glow-cyan/purple/pink`, `--text-primary/secondary/muted` and their `@theme inline` mappings. Confirmed unused by any component.
3. Verify `_archived-glass/` contains exactly 7 files: glass-button, glass-icon-button, glass-tooltip, glass-card, glass-context-menu, glass-input, glass-tabs.
4. Verify 3 restyled glass files still exist: glass-pill.tsx (in ui/), glass-side-panel.tsx (in desktop/), glass-tab-switcher.tsx (in desktop/).
5. Run `pnpm build && pnpm test:run` -- full pass required.

**Tests:**
- [ ] Zero grep hits for glass patterns in non-archived, non-card, non-debug files
- [ ] Ein UI CSS vars removed from globals.css
- [ ] 7 files in `_archived-glass/`
- [ ] Full build + test suite passes

## Sequence

**Wave 1:** Add missing shadcn primitives (no dependencies)
**Wave 2 (parallel):** Replace GlassButton/IconButton/Tooltip + Replace GlassCard/ContextMenu (zero file overlap)
**Wave 3 (parallel):** Restyle TabSwitcher, SidePanel+Chat, ChatBar, Documents+FileTree+Pill, Supporting (zero file overlap between all 5)
**Wave 4:** Final cleanup (depends on all)

Critical path: Wave 1 -> Task 2 -> any Wave 3 task -> Wave 4

## Success Criteria

- [ ] Desktop loads with zinc-50 background, all chrome text dark and readable
- [ ] 5 glass wrapper files archived to `_archived-glass/`
- [ ] Tab switcher, chat bar, side panels look like native shadcn components
- [ ] Right-click context menu uses shadcn popover aesthetic
- [ ] Card components render correctly without any changes
- [ ] Chat message bubbles distinguishable (user vs agent) on light
- [ ] Connection status indicator readable for all states
- [ ] Zero `white/XX` opacity patterns in chrome files
- [ ] Full build + test suite passes
