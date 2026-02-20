# Exploration: Card Visual Redesign -- Warm Editorial Direction

**Date:** 2026-02-20
**Status:** Needs discussion (palette TBD, spike test first)
**Bead:** stackdocs-4tx

## Problem

The current card design uses a uniform glass morphism treatment (`bg-white/10`, `border-white/20`, 24px SVG backdrop blur) for every card regardless of content type. This creates two compounding problems:

1. **Cards are visually identical.** Every card is the same translucent grey-purple shell. There is no differentiation between a table card, a document card, a stats card, or a notes card. At density (10+ cards on screen), the desktop becomes a field of indistinguishable blobs.

2. **Cards are too subtle.** The translucency causes cards to wash out into the wallpaper, especially on darker/busier backgrounds. Cards don't command attention or create visual hierarchy. Nothing says "look here" or "this card matters."

Combined, the desktop feels stale, flat, and lifeless. The glass aesthetic that was fine for 2-3 cards collapses at real usage density.

**Reference:** See `/Users/fraserbrown/Downloads/card-inspiration/` for 12 inspiration images collected by the user. Common themes: solid opaque colors, bold typography, each card with its own color, dark backgrounds with bright cards, minimal chrome.

## Solution

Replace the glass morphism card design with a **warm editorial** aesthetic. Cards become fully opaque, individually colored surfaces with dark text. Each card gets its own color from a curated earth-tone palette, chosen by the agent at creation time. The title bar is removed; the card title merges into the card body as a bold heading. Typography shifts from uniform 13px to a dramatic per-block-type scale.

**Design language in one sentence:** Editorial cards pinned to a dark workspace, not frosted windows floating on wallpaper.

**Key references from inspiration:**
- File manager app (stacked earth-tone cards, bold type, sage/cream/terracotta)
- FeeGoo finance app (clean borders, off-white backgrounds, elegant typography)
- Balance app (each screen its own pastel, bold black type, minimal chrome)

## Requirements

### Card Surface
- [ ] Fully opaque card backgrounds (no translucency, no backdrop blur)
- [ ] Each card has its own color from a curated palette of 6-8 warm earth tones
- [ ] Agent chooses card color via a new `color` field in the `canvas_update` protocol message
- [ ] Soft warm shadow only, no visible border
- [ ] Rounded corners at 12px (`rounded-xl`)
- [ ] Drag interaction: subtle scale-up (1.02) + deeper shadow (existing pattern, keep)
- [ ] Entry/exit animation: keep existing opacity + scale (0.95 -> 1) with Apple easing

### Title Bar Removal
- [ ] No separate title bar strip
- [ ] Card title rendered as first element inside card body (bold, 18-22px)
- [ ] Window controls (close, resize, edit) float in top-right corner
- [ ] Controls appear on hover with smooth fade transition
- [ ] Controls have semi-transparent background pill for readability over any card color
- [ ] Drag handle: entire card remains draggable (existing pattern), content area stopPropagation (existing)

### Typography Scale (Per Block Type)
- [ ] **Stat numbers:** 28-36px, bold/semibold -- the showstopper blocks
- [ ] **Card title / section headings:** 18-22px, semibold
- [ ] **Body text / descriptions:** 14-15px, regular weight
- [ ] **Table cells:** 13px (keep compact for data density)
- [ ] **Metadata / timestamps / badges:** 11-12px, muted color
- [ ] All text dark (`#1A1A1A` or similar near-black) on light card surfaces
- [ ] Secondary text uses a muted dark tone (not opacity-based white)

### Color Palette
- [ ] 6-8 curated warm earth-tone colors (sage, cream, terracotta, sand, dusty rose, olive, stone, slate)
- [ ] **Exact hex values TBD** -- to be determined via spike test, not spec
- [ ] Palette defined as CSS custom properties for easy iteration
- [ ] Colors must: support dark text readability, pop against dark desktop, feel cohesive when 5+ cards are on screen simultaneously
- [ ] Agent palette exposed in sprite protocol so agent can reference colors by name

### Color Assignment
- [ ] Agent-chosen: agent picks color name when creating each card
- [ ] Palette names are semantic (e.g. `sage`, `cream`, `terracotta`) not generic (`color1`, `color2`)
- [ ] If agent doesn't specify a color, system assigns one (round-robin or random from palette)
- [ ] Color persists in card state (WorkspaceDB on Sprite, desktop-store on frontend)

## Non-Requirements

- Not redesigning the chat bar, top bar, or side panels (those keep glass for now)
- Not changing card sizes or the size cycling system (small/medium/large/full stays)
- Not changing the auto-placer grid logic
- Not adding card-type-specific layouts (all cards use the same block renderer, just with better typography)
- Not changing the wallpaper system (keep as-is, wallpaper shows between cards)
- Not redesigning block types themselves (heading, stat, key-value, table, badge, progress, text, document, separator all stay)
- Not changing the drag/momentum physics system
- Not implementing user-chosen palettes or themes (agent-chosen only for now)

## Architecture

### Component Changes

```
GlassCard (frontend/components/ui/glass-card.tsx)
  - Remove: bg-white/10, backdrop-filter, border-white/20, pseudo-element highlights
  - Add: opaque bg from palette, dark text, soft shadow, 12px corners
  - Accept new prop: `color: CardColor` (palette name)
  - May rename component (e.g. DesktopCardSurface) since it's no longer glass

DesktopCard (frontend/components/desktop/desktop-card.tsx)
  - Remove: title bar (h-11 strip with border-b)
  - Add: floating hover controls (absolute positioned, top-right)
  - Pass card color through to surface component
  - Keep: drag handler, size cycling, framer-motion animations

BlockRenderer (frontend/components/desktop/block-renderer.tsx)
  - Update all text colors: white/XX -> dark/XX equivalents
  - Update typography scale per block type
  - Card title becomes first rendered block (bold heading style)
  - Update badge colors for light backgrounds
  - Update table borders/hover for light backgrounds
  - Update progress bar colors for light backgrounds
```

### Protocol Changes

```typescript
// bridge/src/protocol.ts -- add to CanvasUpdate
type CardColor = 'sage' | 'cream' | 'terracotta' | 'sand' | 'dusty_rose' | 'olive' | 'stone' | 'slate';

interface CanvasUpdate {
  // existing fields...
  color?: CardColor;  // new, optional (system assigns default if missing)
}
```

```python
# sprite/src/protocol.py -- mirror TypeScript type
CardColor = Literal['sage', 'cream', 'terracotta', 'sand', 'dusty_rose', 'olive', 'stone', 'slate']
```

### Data Flow

```
Agent creates card:
  canvas_update { action: "create", color: "sage", ... }
    -> Bridge forwards to frontend
    -> Frontend maps "sage" to CSS variable --card-sage
    -> Card renders with opaque sage background + dark text

Color stored in:
  - Sprite: WorkspaceDB cards table (new column: color TEXT)
  - Frontend: desktop-store card state (new field: color)
```

### CSS Variable System

```css
/* Palette (exact values TBD via spike) */
--card-sage: #??????;
--card-cream: #??????;
--card-terracotta: #??????;
--card-sand: #??????;
--card-dusty-rose: #??????;
--card-olive: #??????;
--card-stone: #??????;
--card-slate: #??????;

/* Shared card styles */
--card-text: #1A1A1A;
--card-text-muted: #5A5A58;
--card-text-subtle: #8A8A88;
--card-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
--card-shadow-drag: 0 16px 48px rgba(0, 0, 0, 0.3);
--card-radius: 12px;
```

## Constraints

- **Protocol types are shared.** Adding `color` to `CanvasUpdate` requires updating TypeScript (bridge), Python (sprite), and frontend types in sync.
- **GlassCard is used only by desktop cards.** Other glass components (chat-bar, side-panel, pill, button, etc.) are separate and unaffected. Safe to transform.
- **SVG backdrop filter is a singleton.** Defined in `layout.tsx`. Only used by `glass-card.tsx`. Can be removed when glass is removed from cards, but verify no other consumer first.
- **Title bar is the drag target.** Removing it requires ensuring the full card outer div remains the drag target (already the case -- the card div has pointer capture, content area uses stopPropagation).
- **Block renderer is content-agnostic.** It receives `Block[]` and renders vertically. Typography changes are internal to each block type's render function. No structural change needed.
- **Card widths are fixed pixel values** (`small: 280`, `medium: 380`, `large: 560`, `full: 800`). The auto-placer depends on these. No changes needed for this redesign.
- **Existing tests** in `desktop-card.test.tsx` test drag-and-move WS messages. Will need updates if DesktopCard props change (adding `color` prop).

## Success Criteria

- [ ] Cards are visually distinct from each other (different colors on screen simultaneously)
- [ ] Cards pop against the dark desktop background (clear figure-ground separation)
- [ ] Dark text is readable on all palette colors (WCAG AA minimum, 4.5:1 contrast ratio)
- [ ] No title bar visible; title is bold heading inside card body
- [ ] Window controls appear on card hover, disappear on mouse leave
- [ ] Stat blocks use large typography (28px+), creating visual drama
- [ ] Typography hierarchy is clear: heading > body > metadata
- [ ] Cards look cohesive when 5-8 are on screen with different colors
- [ ] Drag interaction still works identically (scale-up + shadow)
- [ ] Entry/exit animations preserved
- [ ] Agent can specify card color in canvas_update messages
- [ ] Cards without a specified color get a default assignment
- [ ] All 9 existing block types render correctly with dark-on-light styling

## Open Questions

1. **Exact color palette values** -- To be determined via spike test. Spec defines the palette structure (6-8 named warm earth tones) but not the exact hex values. Spike will render sample cards on the actual desktop to evaluate colors in context.

2. **Font family** -- Currently using system/default fonts. The editorial direction might benefit from a distinctive font pairing (display + body). Evaluate during spike. Consider: do we load a web font, or push the system font harder with weight/size?

3. **Default color assignment strategy** -- When agent doesn't specify a color, should the system use round-robin (ensures variety), random, or content-type-based defaults? Likely round-robin for simplicity.

4. **Agent system prompt update** -- The sprite's `soul.md` / `os.md` needs to know about the palette so the agent can make meaningful color choices. What guidance do we give it? (e.g. "use sage for data, cream for documents, terracotta for alerts")

5. **Processing/loading card style** -- Currently there's a processing card for file uploads. Should it use a specific color or a neutral one? Probably stone/neutral.

## Next Steps

1. **Spike test first** -- Build a quick prototype with placeholder colors on the actual desktop to validate the direction visually. Test with 5-8 cards at various sizes.
2. **Finalize palette** -- Pick exact hex values based on spike results.
3. **`/plan`** to create implementation tasks from this spec.
4. Update bead `stackdocs-4tx` with link to this spec.
