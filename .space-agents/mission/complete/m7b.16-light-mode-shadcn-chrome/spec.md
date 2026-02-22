# Exploration: Light Mode + shadcn Chrome Migration

**Date:** 2026-02-21
**Status:** Ready for planning

## Problem

The Stackdocs desktop UI was built with a dark glass aesthetic (glassmorphism) -- translucent backgrounds, backdrop-blur, `white/XX` opacity patterns throughout. This causes two problems:

1. **Visual noise at scale.** When 15+ cards are on the canvas, glass transparency stacks and borders blur together. The eye has no clear hierarchy. Cards with solid fills (table, metric, document, article, data) are noticeably more readable than the glass chrome surrounding them.

2. **Hardcoded dark-mode assumptions.** 108 occurrences of `bg-white/10`, `text-white/70`, `backdrop-blur-xl`, etc. across 17 files. These patterns assume a dark background. Switching to a light background makes all chrome invisible (white-on-white). The shadcn CSS variable system already exists in `globals.css` with light-mode `:root` values, but the glass components ignore it entirely.

The user wants a clean, professional light-mode UI using standard shadcn/ui styling for all chrome (nav, chat, panels, toolbars), while keeping the existing card components untouched.

## Solution

Two-pronged approach: **replace** glass components with real shadcn equivalents where they exist, **restyle** custom components to match shadcn aesthetic where no equivalent exists.

- **Background:** zinc-50 (`#fafafa`) via wallpaper store default
- **Replace with real shadcn components (delete glass wrappers after):**
  - `GlassCard` -> shadcn `Card` (already in project)
  - `GlassButton` -> shadcn `Button` (already in project)
  - `GlassIconButton` -> shadcn `Button` with `variant="ghost" size="icon"`
  - `GlassTooltip` -> shadcn `Tooltip` / `TooltipContent`
  - `GlassContextMenu` -> shadcn `ContextMenu`
- **Restyle custom components (no shadcn equivalent):**
  - `GlassTabSwitcher` -- custom animated tab bar, restyle for light
  - `GlassSidePanel` -- custom sliding panel, restyle for light
  - `GlassPill` -- grouped icon container, restyle as simple styled div
  - `ChatBar` -- custom floating input, restyle for light
  - `ChatPanel` -- custom message list, restyle for light
- **Cards:** Left as-is (they already have solid fills and work on any background)
- **Card fallback:** The `GlassCard` default fallback in `desktop-card.tsx` switches to shadcn `Card`

After migration, glass-* files with shadcn equivalents get deleted. Consumers update imports to point at real shadcn components. Custom components keep their files but with shadcn-aligned styling (CSS variable classes, not hardcoded values).

## Requirements

- [ ] Desktop background defaults to zinc-50 (wallpaper store update)
- [ ] Top bar (stack tabs, left sidebar icons, right sidebar icons) renders correctly on light background
- [ ] Glass tab switcher shows dark text, subtle borders, no backdrop-blur
- [ ] Bottom chat bar has solid white background, dark text, subtle border
- [ ] Chat side panel has light message bubbles, dark text, no `prose-invert`
- [ ] Documents side panel has dark text, correct icon colors on light
- [ ] File tree has dark text, appropriate hover/selected states for light
- [ ] Context menus (right-click, tab menu) use shadcn popover styling
- [ ] Tooltips use shadcn tooltip styling
- [ ] Connection status indicator readable on light background
- [ ] Default card fallback in `desktop-card.tsx` uses shadcn Card instead of GlassCard
- [ ] 5 glass primitives replaced with real shadcn: GlassButton, GlassIconButton, GlassCard, GlassTooltip, GlassContextMenu
- [ ] Glass wrapper files deleted after consumer imports updated
- [ ] 3 custom components restyled: GlassTabSwitcher, GlassSidePanel, GlassPill
- [ ] Voice bars and persona orb colors work on light background

## Non-Requirements

- Not implementing dark mode toggle or dual-theme support (light only for now)
- Not touching card components (table-card, metric-card, document-card, article-card, data-card)
- Not redesigning component APIs for the custom components that remain
- Not adding new components or features
- Not changing the wallpaper store architecture (keep it, just change default)
- Not updating the debug panel (Cmd+Shift+D) -- developer tool, dark is fine

## Architecture

### Two Migration Strategies

**Strategy A: Replace with real shadcn (5 glass components)**

These glass wrappers have direct shadcn equivalents. Replace all consumer imports, then delete the glass file.

| Glass Component | shadcn Replacement | Consumers to Update |
|----------------|-------------------|-------------------|
| `GlassButton` | `Button` | DesktopTopBar, ChatBar, ChatPanel, DocumentsPanel, DesktopContextMenu |
| `GlassIconButton` | `Button variant="ghost" size="icon"` | DesktopTopBar (all sidebar/toolbar icons), ChatBar |
| `GlassCard` | `Card` | desktop-card.tsx default fallback |
| `GlassTooltip` | `Tooltip`/`TooltipContent` | DesktopTopBar (icon tooltips) |
| `GlassContextMenu` | `ContextMenu` | DesktopContextMenu (right-click) |

**Strategy B: Restyle custom components (no shadcn equivalent)**

These stay as custom components but replace hardcoded `white/XX` patterns with shadcn CSS variable classes.

| Component | File | Changes |
|-----------|------|---------|
| `GlassTabSwitcher` | `glass-tab-switcher.tsx` | Solid bg, dark text, subtle borders, remove blur |
| `GlassSidePanel` | `glass-side-panel.tsx` | Solid bg, dark title, border-border, remove blur |
| `GlassPill` | `glass-pill.tsx` | Solid bg, subtle border, remove blur/shadow |
| `ChatBar` | `chat-bar.tsx` | Solid white bar, dark text, muted placeholder |
| `ChatPanel` | `chat-panel.tsx` | Light message bubbles, dark text, remove prose-invert |

### Pattern Mapping (for Strategy B restyling)

| Glass Pattern | shadcn Replacement |
|--------------|-------------------|
| `bg-white/10` | `bg-background` or `bg-card` |
| `text-white/70` | `text-foreground` or `text-muted-foreground` |
| `text-white/40` | `text-muted-foreground` |
| `border-white/20` | `border-border` |
| `hover:bg-white/10` | `hover:bg-accent` |
| `bg-white/15` (selected) | `bg-accent` |
| `backdrop-blur-xl` | Remove (not needed on solid backgrounds) |
| `shadow-[0_Xpx_Xpx_rgba(0,0,0,X)]` | `shadow-sm` or `shadow-md` |
| `prose-invert` | Remove (default prose is dark-on-light) |

### Files to Change

**Phase 1: Replace glass primitives with shadcn (5 files to delete, N consumer files to update imports):**
1. `frontend/components/ui/glass-button.tsx` -- replace with shadcn `Button`, update all consumers
2. `frontend/components/ui/glass-icon-button.tsx` -- replace with shadcn `Button variant="ghost" size="icon"`, update all consumers
3. `frontend/components/ui/glass-card.tsx` -- replace with shadcn `Card`, update desktop-card.tsx
4. `frontend/components/ui/glass-tooltip.tsx` -- replace with shadcn `Tooltip`, update consumers
5. `frontend/components/ui/glass-context-menu.tsx` -- replace with shadcn `ContextMenu`, update consumers

**Phase 2: Restyle custom chrome components (8 files):**
6. `frontend/components/desktop/desktop-top-bar.tsx` -- launcher class, fallback pill, updated imports
7. `frontend/components/desktop/glass-tab-switcher.tsx` -- container, indicator, tab text, menu popover
8. `frontend/components/desktop/chat-bar.tsx` -- glass bar, suggestion chips, textarea, placeholder
9. `frontend/components/desktop/glass-side-panel.tsx` -- panel container, title text
10. `frontend/components/desktop/chat-panel.tsx` -- message bubbles, typing indicator, prose
11. `frontend/components/desktop/documents-panel.tsx` -- storage labels, bar, file icons
12. `frontend/components/desktop/desktop-context-menu.tsx` -- section labels, buttons, separators
13. `frontend/components/desktop/connection-status.tsx` -- base text, status-specific colors

**Phase 3: Supporting components (5 files):**
14. `frontend/components/ai-elements/file-tree.tsx` -- hover, selected, icon, text, indent colors
15. `frontend/components/desktop/wallpaper-thumbnail.tsx` -- selected/unselected borders
16. `frontend/components/desktop/desktop-viewport.tsx` -- HUD text color
17. `frontend/components/desktop/desktop-card.tsx` -- default fallback case (GlassCard to Card)
18. `frontend/components/ui/glass-pill.tsx` -- restyle (no shadcn equivalent)

**Config (1 file):**
19. `frontend/lib/stores/wallpaper-store.ts` -- verify default is zinc-50

**Possibly (minor, voice):**
20. `frontend/components/voice/voice-bars.tsx` -- bar fill color
21. `frontend/components/voice/persona-orb.tsx` -- loading state border/gradient

## Constraints

- Glass components with shadcn equivalents get replaced and archived to `frontend/components/ui/_archived-glass/` (not deleted until user gives all-clear). Consumer imports updated to point at real shadcn components.
- Custom components (no shadcn equivalent) keep their files but use shadcn CSS variable classes (`bg-background`, `text-foreground`, etc.) -- not new hardcoded light-mode values
- The wallpaper store stays intact but defaults to zinc-50
- Card components (table, metric, document, article, data) are not modified
- shadcn `Button` already uses CVA -- consumers switch from `GlassButton` to `Button` with appropriate variant
- `ThemeProvider` uses `next-themes` with `defaultTheme="system"` -- light mode works when OS is set to light, which is the target
- No `dark:` prefix patterns -- the codebase has zero, keep it that way
- Ein UI CSS variables in `globals.css` (lines 64-80) may need light-mode values if any component references them

## Success Criteria

- [ ] Desktop loads with zinc-50 background by default
- [ ] All text in chrome is readable (dark on light) without squinting
- [ ] No `white/XX` opacity patterns remain in chrome files
- [ ] 5 glass wrapper files archived to `_archived-glass/` (not deleted until user confirms)
- [ ] Tab switcher, chat bar, and side panels look like native shadcn components
- [ ] Right-click context menu uses shadcn popover aesthetic
- [ ] Existing card components render correctly without changes
- [ ] No visual regressions in card content (tables, metrics, documents, articles)
- [ ] Connection status indicator colors work on light background
- [ ] Chat message bubbles are distinguishable (user vs agent) on light

## Open Questions

1. **Streaming glow effects** -- The chat bar and chat panel have cyan/purple gradient glows during streaming. These may look odd on light backgrounds. Keep, soften, or remove? (Non-blocking -- can adjust during implementation.)

2. **Ein UI CSS variables** -- Lines 64-80 of `globals.css` define glass-specific vars (`--glass-bg`, `--text-primary`, etc.). Are these used anywhere beyond the glass components? If not, they can be removed. If yes, they need light-mode values. (Non-blocking -- research during implementation.)

## Next Steps

1. `/plan` to create implementation tasks from this spec
2. Group tasks by cascade priority: glass primitives first, then chrome consumers, then supporting components
3. Verify with visual inspection after each group (load desktop, check readability)
