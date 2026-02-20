# Exploration: Canvas Card Template System

**Date:** 2026-02-20
**Status:** Ready for planning

## Problem

The current canvas dumps all extracted content directly onto every card surface. A document card shows the full extraction inline: headings, tables, key-value pairs, paragraphs, all visible at once. When multiple cards are on screen, the result is a cluttered, hard-to-scan wall of text with no visual hierarchy between cards.

The prototype comparison makes this stark: Image 1 (current) shows 8+ cards of varying sizes with full content bleeding off edges, while Image 2 (prototype) shows 5 cards where each communicates its purpose at a glance with a clear call-to-action for detail.

The core insight: information density is actually *higher* when cards show summaries, because users can scan 5 summary cards faster than they can parse 1 wall of text.

## Solution

Replace the current "dump everything" card model with a **card template system** where:

1. **Canvas cards show summaries only.** Each card is a "poster" for its content: title, 1-2 line description, category badge, tags, and a visual treatment that signals its type.

2. **Full content lives behind a click.** Clicking a card opens a full-screen overlay rendering all extracted blocks. The canvas is the index; the overlay is the document.

3. **The agent picks a template from a fixed menu** when creating a card. Five templates, each with a distinct visual treatment and slot structure. The agent also writes an explicit summary rather than relying on the frontend to auto-generate one.

4. **The zoomable/pannable canvas stays.** Cards are draggable, the viewport supports zoom/pan with momentum physics. What changes is what each card *shows*, not how the canvas works.

Reference implementation: `docs/references/canvas-card-prototype/` (Vite + React prototype with all 5 card components).

## Requirements

- [ ] 5 card templates: Document, Metric, Table, Article, Data
- [ ] Agent selects template via `card_type` field when creating cards
- [ ] Agent sends both summary fields and full `blocks[]` in one message
- [ ] Each template has a fixed width and visual treatment (see Architecture)
- [ ] Canvas cards render summary slots only (no block content on the card surface)
- [ ] Click a card to open full-screen overlay with all blocks rendered
- [ ] Click-vs-drag discrimination (tap opens overlay, drag moves card)
- [ ] Color system: each template has a default color, agent can override from palette
- [ ] Card shape: 40px border radius, p-8 padding (editorial object feel)
- [ ] Remove spike if/else branching from block-renderer and desktop-card
- [ ] Protocol updated across all 3 codebases (bridge, frontend, sprite)

## Non-Requirements

- No editable content in the overlay (view-only for this phase)
- No split-screen or side-by-side PDF comparison view
- No card resizing by users (sizes are fixed per template)
- No Agent/status card (explicitly rejected)
- No auto-grid or masonry layout (keep free-position canvas)
- No time-series tracking for metric cards (sparklines are decorative)
- No overlay animation decision yet (parked for implementation phase)
- No changes to the chat bar or input system
- No changes to the header/navigation

## Architecture

### Card Templates

| Template | Default Color | Width | Key Slots | Visual Character |
|----------|--------------|-------|-----------|-----------------|
| **Document** | cream | 400px | type badge, date, title, summary, tags[], "Read Report" CTA | Editorial report poster |
| **Metric** | green | 300px | title badge, value (large), trend %, direction, decorative bar chart | Big number stat card |
| **Table** | dark | 600px | title, headers[], rows[] (preview subset), entry count, sync time | Dark data table preview |
| **Article** | white | 500px | category badge, read time, title, subtitle, body preview, author | Long-form content card |
| **Data** | yellow | 400px | title, data records preview, Export/Edit buttons | Key-value / record card |

### Color System

9 colors available (from prototype BaseCard):
- `cream` (#F2E9E4), `white` (#F8F9FA), `yellow` (#F2E8CF), `green` (#D8F3DC), `pink` (#FFD6E0), `blue` (#D7E3FC), `orange` (#FFD8BE), `purple` (#E2C6FF), `dark` (#121212)

Each template has a default color. Agent can override when creating a card (e.g., to differentiate multiple document cards). Typography color adapts to background (dark text on light cards, light text on dark cards).

### Protocol Changes

New/modified fields on `CanvasUpdate` and `CardInfo`:

```
card_type: "document" | "metric" | "table" | "article" | "data"  // NEW
summary: string                    // NEW - 1-2 line description for canvas card
tags?: string[]                    // NEW - category badges
color?: string                     // NEW - override default template color
blocks: Block[]                    // EXISTING - full content for overlay

// Template-specific (NEW):
type_badge?: string                // Document: e.g., "PDF Report"
date?: string                      // Document: e.g., "Oct 12"
value?: string                     // Metric: e.g., "$1.2M"
trend?: string                     // Metric: e.g., "15%"
trend_direction?: "up" | "down"    // Metric
author?: string                    // Article
read_time?: string                 // Article
headers?: string[]                 // Table: column headers
preview_rows?: string[][]          // Table: first N rows for card surface
```

### Data Flow

```
1. Agent calls create_card(card_type="document", title="Q3 Report", summary="Revenue up 15%...", tags=["Finance"], blocks=[...full extraction...])
2. Sprite builds CanvasUpdate with all fields, persists to WorkspaceDB, sends via WS
3. Bridge proxies to browser
4. ws-provider receives canvas_update, maps to DesktopCard with new fields
5. Desktop renders card using template component (DocumentCard, MetricCard, etc.)
6. User clicks card -> overlay opens, BlockRenderer renders full blocks[] array
7. User closes overlay -> returns to canvas
```

### Component Structure

```
desktop-card.tsx          -> Template dispatcher (switch on card_type)
cards/
  document-card.tsx       -> Cream poster with CTA button
  metric-card.tsx         -> Big number with decorative chart
  table-card.tsx          -> Dark table preview
  article-card.tsx        -> Long-form preview with author
  data-card.tsx           -> Record/key-value preview
  base-card.tsx           -> Shared wrapper (drag, position, shape, color)
card-overlay.tsx          -> Full-screen content view (renders blocks[])
block-renderer.tsx        -> Cleaned up, single rendering path (no spike branches)
```

### Click vs. Drag Discrimination

Track pointer distance between `pointerdown` and `pointerup`. If distance < threshold (e.g., 5px), treat as click (open overlay). If distance >= threshold, treat as drag (move card). This is a well-established pattern.

## Constraints

- Protocol changes must update all 3 codebases: `bridge/src/protocol.ts`, `frontend/types/ws-protocol.ts`, `sprite/src/protocol.py`
- Sprite canvas tools (`sprite/src/tools/canvas.py`) must be updated for new `create_card` parameters
- Must maintain localStorage persistence contract (Zustand store shape changes need migration)
- The current momentum physics viewport (`desktop-viewport.tsx`) is kept as-is
- Prototype uses `motion/react` (Framer Motion) for card animations; current codebase does not have Framer Motion installed. Decision needed: add it or replicate with CSS transitions.
- Prototype font: Plus Jakarta Sans. Current spike tests DM Sans, Plus Jakarta, General Sans, System. Font choice TBD but independent of this spec.

## Success Criteria

- [ ] All 5 card templates render on the canvas with summary-only content
- [ ] Clicking a card opens a full-screen overlay showing all blocks
- [ ] Agent can create each card type via updated `create_card` tool
- [ ] Cards are draggable on the canvas (existing behavior preserved)
- [ ] Canvas zoom/pan works with new card components
- [ ] Spike code removed (no if/else branching in block-renderer)
- [ ] Protocol types consistent across bridge, frontend, and sprite
- [ ] Card colors follow template-default-with-override system
- [ ] Visual fidelity matches prototype reference (40px radius, p-8, typography scale)

## Open Questions

1. **Overlay animation** - How should the overlay enter/exit? Parked during brainstorm. Options: morph from card, slide from side, fade in. Can decide during implementation.
2. **Framer Motion** - Prototype uses `motion/react`. Add as dependency or replicate animations with CSS? Trade-off: richer animation library vs. bundle size + new dependency.
3. **Font choice** - Plus Jakarta Sans (prototype), DM Sans, General Sans, or System (Geist). Spike has a font switcher for evaluation. Independent of this spec but affects visual fidelity.
4. **Table preview rows** - How many rows should the table card show on the canvas surface? Prototype shows 4. Agent could control this.
5. **Metric card decorative chart** - Keep the bar chart from the prototype, or simplify to a static SVG/icon? User said "like an enlarged icon" which suggests simpler than the interactive bars.

## Next Steps

1. `/plan` to break this into implementation tasks
2. Resolve Framer Motion decision (impacts component implementation)
3. Lock in font choice via the existing spike font switcher
4. Clean up spike code as part of implementation (not as a separate task)
