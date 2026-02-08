# Exploration: Canvas Grid Layout + Agent Prompt for Proactive Cards

**Date:** 2026-02-08
**Status:** Ready for planning

---

## Problem

The Canvas UI uses React Flow (infinite canvas with pan/zoom/grid) which is the wrong metaphor. It feels like a whiteboard/diagramming tool when the user wants a **dashboard of information cards** — like a smartphone homescreen with widgets.

The agent's system prompt also has no guidance about Canvas cards. The agent has `create_card`/`update_card`/`close_card` tools available via MCP, but nothing tells it WHEN or HOW to use them. Users shouldn't need to ask the agent to create cards — it should do this proactively as its primary output surface.

The current `card_type` parameter (table/document/notes) is a holdover from a "windows" metaphor that no longer applies. Cards should be defined by their blocks, not a type label.

---

## Solution

Two changes:

1. **Replace React Flow with react-grid-layout** — a grid-based layout where cards snap into position, can be dragged to rearrange, and resized between predefined sizes. Like iOS/Android homescreen widgets. No zoom, no pan, just scroll. Responsive columns (3 on desktop, fewer on mobile).

2. **Add a Canvas section to the agent's system prompt** — framing the agent as a PA (personal assistant) who places information on a desk (the Canvas). Cards are the PRIMARY output. Text chat is short narration: "I've pulled up the invoice" — not a duplication of card content.

---

## Requirements

- [ ] Replace React Flow with react-grid-layout for card positioning
- [ ] Cards snap to grid, can be dragged to rearrange, resize between predefined sizes
- [ ] Predefined card sizes: small (1 col), medium (2 col), large (2 col taller), full (3 col)
- [ ] Card height auto-sizes to content within each width size
- [ ] Responsive: 3 columns desktop, 2 tablet, 1 mobile
- [ ] Remove zoom and pan — scroll only
- [ ] Replace `card_type` parameter with `size` parameter in `create_card` tool
- [ ] Update agent system prompt with Canvas section (PA framing, proactive card creation)
- [ ] Agent text replies are short and referential — point to cards, don't duplicate content
- [ ] Update protocol types in all 3 locations (bridge/protocol.ts, frontend/ws-protocol.ts, sprite/protocol.py)
- [ ] Visual styling inspired by A2UI Composer — clean cards, content-first, no grid dots

---

## Non-Requirements

- Not adding new block types (current 8 are enough for MVP: heading, stat, key-value, table, badge, progress, text, separator)
- Not adding image blocks, action/button blocks, or avatar blocks (post-MVP)
- Not implementing editable table cells in this change (separate task m7b.4.3)
- Not building the Canvas Zustand store in this change (separate task m7b.4.5)
- Not rewriting the stack page layout (separate task m7b.4.7)

---

## Architecture

### Layout Engine Change

```
BEFORE (React Flow):
- Infinite canvas with pan/zoom
- Cards are React Flow nodes with (x, y) coordinates
- Grid background with snap-to-grid (20px)
- NodeResizer for free-form resizing
- autoPlace() positions new cards to the right

AFTER (react-grid-layout):
- CSS grid-based layout, scroll only
- Cards have grid position (x, y) and size (w, h) in grid units
- Drag a card → snaps to grid, other cards reflow
- Resize between predefined width sizes (1/2/3 columns)
- Height auto-sizes to content
- Responsive breakpoints: lg=3col, md=2col, sm=1col
```

### Card Size System

| Size | Grid Width | Columns | Use Case |
|------|-----------|---------|----------|
| `small` | w=1 | 1 of 3 | Single stat, badge, quick status |
| `medium` | w=2 | 2 of 3 | Key-value summaries, short tables |
| `large` | w=2 | 2 of 3 (taller) | Detailed tables, multi-block cards |
| `full` | w=3 | 3 of 3 | Wide data tables, comprehensive views |

Height (h) is dynamic — react-grid-layout supports auto-height or we calculate based on content.

### Tool API Change

```python
# BEFORE:
create_card(title: str, card_type: str, blocks: list)
# card_type: "table" | "document" | "notes"

# AFTER:
create_card(title: str, blocks: list, size: str)
# size: "small" | "medium" | "large" | "full"
# Default: "medium" (agent can omit for auto)
```

### Agent System Prompt Addition

```
## Canvas

You are a personal assistant with a visual Canvas — a desk where you place
documents, data, and information for the user to see.

ALWAYS present information on Canvas cards. Cards are your primary output.
Your text replies should be short — like a PA saying "I've pulled up the
invoice details" or "Here are the extraction results." Don't repeat card
content in your text response. Point to what's on screen.

### Text replies
Keep text short and concise (1-2 sentences). Examples:
- "I've put the invoice summary on screen. The total is $2,450."
- "Here are the documents from this week."
- "I've updated the vendor name on the card."
Only use text-only replies when there's nothing visual to show:
  acknowledgments, clarifying questions, or brief status updates.

### Creating cards
Any time you have information to present — extraction results, document
contents, summaries, query results, metrics — create a card. Default to
showing information visually. Pick the smallest card size that fits:
- "small": Single stat or status
- "medium": Summary with a few fields
- "large": Table or detailed view
- "full": Wide data table or comprehensive overview

### Composing blocks
Lead with a heading. Use key-value for labeled fields, table for rows of
data, stat for important numbers, badge for status. Combine naturally:
heading + key-value + separator + table is common for document extractions.

### Updating cards
When the user corrects data, update the existing card — don't create a
duplicate. Remember card IDs from create_card responses.
```

### Files Changed

| File | Change |
|------|--------|
| `frontend/components/canvas/stack-canvas.tsx` | Rewrite: React Flow → react-grid-layout |
| `frontend/components/canvas/canvas-card.tsx` | Restyle: Remove React Flow node wrapper, keep card UI |
| `frontend/components/canvas/card-renderer.tsx` | No change (block rendering stays) |
| `frontend/app/(app)/test-chat/page.tsx` | Update: Use grid layout, remove React Flow imports |
| `sprite/src/agents/shared/canvas_tools.py` | Update: Replace `card_type` with `size` param |
| `sprite/src/runtime.py` | Update: Expand `DEFAULT_SYSTEM_PROMPT` with Canvas section |
| `bridge/src/protocol.ts` | Update: Add `size` field to CanvasUpdatePayload, remove card_type references |
| `frontend/types/ws-protocol.ts` | Update: Mirror protocol.ts changes |
| `sprite/src/protocol.py` | Update: Add `size` field to CanvasUpdate, remove card_type references |
| `frontend/package.json` | Update: Remove `@xyflow/react`, add `react-grid-layout` |

---

## Constraints

- Protocol changes must update all 3 copies (bridge, frontend, sprite) in sync
- react-grid-layout must support responsive breakpoints (it does: `<ResponsiveGridLayout>`)
- Card height auto-sizing needs either react-grid-layout's auto-height or a ResizeObserver approach
- The `create_card` tool description must include `size` options with clear guidance
- System prompt addition should be concise — the agent's context window is shared with memory and tools
- Existing block validation in `canvas_tools.py` stays — only the card-level params change

---

## Success Criteria

- [ ] Cards display in a grid layout that reflows when cards are dragged/resized
- [ ] No zoom or pan — page scrolls naturally
- [ ] Cards can be dragged to rearrange (other cards shuffle)
- [ ] Cards can be resized between small/medium/large/full widths
- [ ] Agent proactively creates cards without being asked when presenting structured data
- [ ] Agent text replies are short (1-2 sentences) and reference cards ("I've put X on screen")
- [ ] Agent does NOT duplicate card content in text replies
- [ ] Layout is responsive: 3 col desktop, 2 col tablet, 1 col mobile
- [ ] Visual styling is clean and content-first (A2UI-inspired, no grid dots)
- [ ] test-chat page works with new grid layout

---

## Open Questions

1. **Auto-height strategy** — react-grid-layout uses fixed row heights by default. Options: (a) use a large row height and calculate h based on content, (b) use a ResizeObserver to dynamically set h, (c) use CSS-only approach with `autoSize` prop. Need to test which works best.

2. **Default card position** — When the agent creates a new card, where does it go? Options: (a) append to bottom of grid (simple), (b) find first gap in grid, (c) insert at top and push others down. Recommend (a) for simplicity.

3. **Size to grid unit mapping** — Need to decide exact row height and how `small`/`medium`/`large`/`full` map to (w, h) grid units. Width is clear (1/2/2/3 cols), height needs testing with real content.

---

## Next Steps

1. `/plan` to create implementation tasks from this spec
2. Tasks will likely split into: (a) layout engine swap, (b) tool API + protocol update, (c) system prompt update, (d) visual polish
3. Update Beads task m7b.4.2 to reflect this design change (was "React Flow canvas" — now "Grid layout canvas")
