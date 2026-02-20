# Feature: Canvas Card Template System

**Goal:** Replace the current "dump everything" card model with a 5-template system where canvas cards show summaries and full content opens in a full-screen overlay.

## Overview

The current canvas renders every card as a generic container that shows all extracted blocks inline. This creates a cluttered, hard-to-scan desktop. The redesign introduces:

- **5 card templates** (Document, Metric, Table, Article, Data) with distinct visual treatments
- **Summary-only canvas cards** that show title, key info, and a CTA
- **Full-screen overlay** that renders all blocks when a card is clicked
- **Template-default colors with agent override** from a 9-color palette
- **Editorial card aesthetic** (40px radius, p-8 padding, oversized typography)

**Styling source of truth:** `docs/references/canvas-card-prototype/` (Vite+React). This is a Gemini-generated prototype with exact hex colors, font sizes, spacing, and component structure. All card components MUST be ported from these files, matching their styling exactly:
- `src/components/cards/BaseCard.tsx` - color palette, 40px radius, p-8, shadow
- `src/components/cards/DocumentCard.tsx` - report card layout
- `src/components/cards/MetricCard.tsx` - stat card with decorative bars
- `src/components/cards/TableCard.tsx` - dark data table
- `src/components/cards/LongTextCard.tsx` - article/long-form card
- `src/components/cards/DataCard.tsx` - key-value record card

Read each prototype file BEFORE implementing its equivalent. Do not improvise styling.

## Tasks

### Task: Add card template fields to protocol

**Goal:** Extend the WebSocket protocol across all 3 codebases with card_type, summary, tags, color, and template-specific fields.
**Files:** Modify `bridge/src/protocol.ts`, `frontend/types/ws-protocol.ts`, `sprite/src/protocol.py`
**Depends on:** None

**Steps:**
1. Add `CardType` union type and `CARD_TYPES` constant to bridge protocol
2. Add new optional fields to `CanvasUpdate.payload` and `CardInfo` interfaces: `card_type`, `summary`, `tags`, `color`, `type_badge`, `date`, `value`, `trend`, `trend_direction`, `author`, `read_time`, `headers`, `preview_rows`
3. Update `isCanvasUpdate` type guard to validate `card_type` when present (reject invalid values, accept undefined for backward compat)
4. Copy identical changes to `frontend/types/ws-protocol.ts`
5. Update Python `protocol.py`: add `CardType` literal, update `CanvasUpdatePayload` and `CardInfo` dataclasses, update `is_canvas_update` validator
6. Run bridge tests to confirm no regressions (all 136 should pass)

**Tests:**
- [ ] Bridge TypeScript compiles, all 136 tests pass
- [ ] `isCanvasUpdate` validates messages with new fields
- [ ] `isCanvasUpdate` still validates messages without new fields (backward compat)
- [ ] Python `to_json()` serializes new fields correctly

### Task: Update Sprite canvas tools and database for templates

**Goal:** Make the Sprite agent able to create cards with template fields, persist them in SQLite, and include them in state sync.
**Files:** Modify `sprite/src/tools/canvas.py`, `sprite/src/database.py`, `sprite/src/state_sync.py`
**Depends on:** Add card template fields to protocol

**Steps:**
1. Add ALTER TABLE migration in WorkspaceDB for new columns: `card_type`, `summary`, `tags`, `color`, `type_badge`, `date`, `value`, `trend`, `trend_direction`, `author`, `read_time`, `headers`, `preview_rows` (follow existing `_migrate_card_position_columns` pattern)
2. Update `upsert_card()` to accept and persist new fields (tags/headers/preview_rows stored as JSON strings)
3. Rewrite `create_card` tool: accept `card_type` (required from menu of 5), `summary`, `tags`, `color`, plus template-specific fields. Validate card_type against allowed values.
4. Update `state_sync.py` to include new fields when building `CardInfo` objects from DB rows (json.loads for tags/headers/preview_rows)
5. Smoke test with in-memory SQLite to verify round-trip

**Tests:**
- [ ] `create_card` tool accepts `card_type="document"` and includes it in WebSocket message
- [ ] New DB columns created on fresh init and via ALTER TABLE on existing DBs
- [ ] `state_sync` includes template fields in card payloads
- [ ] JSON fields (tags, headers, preview_rows) round-trip correctly through DB

### Task: Update frontend store and ws-provider for card fields

**Goal:** Extend DesktopCard interface with template fields, update message handlers, bump Zustand persist version.
**Files:** Modify `frontend/lib/stores/desktop-store.ts`, `frontend/components/desktop/ws-provider.tsx`
**Depends on:** Add card template fields to protocol

**Steps:**
1. Add `CardType` type and new optional fields to `DesktopCard` interface: `cardType`, `summary`, `tags`, `color`, `typeBadge`, `date`, `value`, `trend`, `trendDirection`, `author`, `readTime`, `headers`, `previewRows`
2. Bump persist version from 1 to 2 (migration is no-op since all new fields are optional)
3. Update ws-provider `canvas_update` handler to map snake_case protocol fields to camelCase store fields
4. Update ws-provider `state_sync` handler to map CardInfo template fields
5. Verify via debug panel that new fields flow through and persist in localStorage

**Tests:**
- [ ] DesktopCard type includes all new fields
- [ ] ws-provider maps `card_type` to `cardType`, `trend_direction` to `trendDirection`, etc.
- [ ] localStorage migration from v1 to v2 preserves existing cards
- [ ] Cards without card_type get `cardType: undefined` (renders legacy fallback)

### Task: Build BaseCard wrapper and color system

**Goal:** Create shared card wrapper with 40px radius, p-8 padding, color palette, and text-adapts-to-background logic.
**Files:** Create `frontend/components/desktop/cards/base-card.tsx`, `frontend/components/desktop/cards/colors.ts`
**Depends on:** Update frontend store and ws-provider for card fields

**Steps:**
1. Create `colors.ts` with 9-color palette (cream, white, yellow, green, pink, blue, orange, purple, dark), each with bg/text/textMuted hex values
2. Add `DEFAULT_TEMPLATE_COLORS` map and `getCardColor(cardType, colorOverride)` helper
3. Create `BaseCard` component: rounded-[40px], p-8, background from palette, dark text on light / light text on dark, shadow, top-edge highlight for light cards
4. Add click discrimination to `desktop-card.tsx`: track pointer distance between down/up, call `onCardClick` if < 5px (must be in desktop-card.tsx because of pointer capture, not in BaseCard)

**Tests:**
- [ ] BaseCard renders correct background for each of 9 palette colors
- [ ] Dark cards get light text, light cards get dark text
- [ ] 40px border radius and p-8 padding applied
- [ ] Click discrimination: < 5px movement triggers onCardClick, >= 5px triggers drag

### Task: Build 5 template card components

**Goal:** Create Document, Metric, Table, Article, Data components that render summary-only content.
**Files:** Create 5 files in `frontend/components/desktop/cards/` plus barrel `index.ts`
**Depends on:** Build BaseCard wrapper and color system

**Steps:**
1. **DocumentCard** (400px, cream): type badge + date header, 4xl title, summary text, tags array, "Read Report" CTA button with arrow icon
2. **MetricCard** (300px, green): title badge, 6xl value, trend with up/down icon, decorative static bar chart (7 bars, fixed heights)
3. **TableCard** (600px, dark): 2xl title with expand arrow, table with headers + first 4 preview_rows, entry count + sync footer
4. **ArticleCard** (500px, white): "Article" badge + read time, 4xl title, subtitle, truncated summary as body, author with avatar placeholder
5. **DataCard** (400px, yellow): title with arrow, record table from headers + preview_rows, Export CSV + Edit Data buttons
6. Create barrel export `index.ts`
7. Each component receives `card: DesktopCard` and `onCardClick` callback

**Tests:**
- [ ] Each template renders its summary slots correctly
- [ ] All gracefully handle missing optional fields (no crash if summary undefined)
- [ ] CTA buttons call onCardClick with stopPropagation
- [ ] Visual fidelity matches prototype reference

### Task: Rewrite desktop-card as template dispatcher

**Goal:** Replace spike if/else branches with a switch on cardType. Remove spike imports.
**Files:** Modify `frontend/components/desktop/desktop-card.tsx`, `frontend/app/(desktop)/desktop/page.tsx`
**Depends on:** Build 5 template card components

**Steps:**
1. Define `TEMPLATE_WIDTHS` map: document=400, metric=300, table=600, article=500, data=400
2. Replace card body rendering with switch on `card.cardType`: route to DocumentCard/MetricCard/TableCard/ArticleCard/DataCard wrapped in BaseCard
3. Cards without cardType fall back to legacy GlassCard + BlockRenderer (backward compat)
4. Remove all spike imports (SPIKE_CARDS_ENABLED, palette, font-switcher)
5. Update page.tsx: remove FontSwitcher, remove spike font style prop
6. Add `onCardClick` prop to DesktopCard, wire through to template components

**Tests:**
- [ ] Card with cardType="document" renders DocumentCard
- [ ] Card with no cardType renders legacy GlassCard fallback
- [ ] No spike imports remain in desktop-card.tsx or page.tsx
- [ ] Cards still draggable, canvas zoom/pan still works
- [ ] Template-specific widths applied correctly

### Task: Build card overlay for full-screen content view

**Goal:** Full-screen overlay that renders all blocks when a card is clicked.
**Files:** Create `frontend/components/desktop/card-overlay.tsx`, modify `frontend/app/(desktop)/desktop/page.tsx`
**Depends on:** Rewrite desktop-card as template dispatcher

**Steps:**
1. Create overlay context at page level (React.createContext for `setOverlayCardId`) so cards inside the viewport can open the overlay outside the viewport
2. Create `CardOverlay` component: fixed inset-0 z-50, dark backdrop with blur, content panel with card's palette color, title header with close button, scrollable BlockRenderer area (max-w-3xl centered)
3. Wire into page.tsx: overlay renders as SIBLING of DesktopViewport (not inside it, to avoid zoom/pan transforms). Use AnimatePresence for enter/exit animation.
4. Add Escape key handler to close overlay
5. Add backdrop click to close overlay

**Tests:**
- [ ] Clicking a template card opens overlay with that card's blocks
- [ ] Close button, Escape key, and backdrop click all close the overlay
- [ ] Overlay scrolls for long content
- [ ] Canvas is not interactive while overlay is open
- [ ] Card deletion while overlay open closes the overlay automatically

### Task: Clean block-renderer and delete spike code

**Goal:** Remove all SPIKE_CARDS_ENABLED branches. Single rendering path. Delete spike directory.
**Files:** Modify `frontend/components/desktop/block-renderer.tsx`, delete `frontend/spike/card-redesign/`
**Depends on:** Build card overlay for full-screen content view

**Steps:**
1. Add `variant` prop to BlockRenderer: 'light' (default, for overlays) or 'glass' (for legacy cards)
2. Remove all `if (SPIKE_CARDS_ENABLED)` conditionals from every block function. Keep the spike styling as the 'light' variant. Keep glass styling as the 'glass' variant.
3. Remove spike config import
4. Update legacy card fallback in desktop-card.tsx to pass `variant="glass"` to BlockRenderer
5. Delete `frontend/spike/card-redesign/` directory (config.ts, palette.ts, font-switcher.tsx)
6. Grep for any remaining spike references across the codebase and remove
7. Verify build passes with no dead imports

**Tests:**
- [ ] BlockRenderer has no SPIKE_CARDS_ENABLED references
- [ ] Overlay renders blocks correctly with light variant
- [ ] Legacy glass cards render correctly with glass variant
- [ ] No file in codebase imports from `@/spike/`
- [ ] Frontend builds with zero TypeScript errors

## Sequence

1. Add card template fields to protocol (no dependencies)
2. Update Sprite canvas tools and database (depends on 1)
3. Update frontend store and ws-provider (depends on 1, parallel with 2)
4. Build BaseCard wrapper and color system (depends on 3)
5. Build 5 template card components (depends on 4)
6. Rewrite desktop-card as template dispatcher (depends on 5)
7. Build card overlay (depends on 6)
8. Clean block-renderer and delete spike code (depends on 7)

```
1 → [2, 3] → 4 → 5 → 6 → 7 → 8
```

Tasks 2 and 3 can run in parallel. All others are sequential.

**MVP Slices for incremental shipping:**
- Slice 1 (Tasks 1-3): Data plumbing. Zero visual change. New fields flow through silently.
- Slice 2 (Tasks 4-6): Template rendering. Cards look like prototype. No overlay yet.
- Slice 3 (Tasks 7-8): Overlay + cleanup. Feature-complete.

## Success Criteria

- [ ] All 5 card templates render on canvas with summary-only content
- [ ] Clicking a card opens full-screen overlay showing all blocks
- [ ] Agent can create each card type via updated create_card tool
- [ ] Cards are draggable on canvas (existing behavior preserved)
- [ ] Canvas zoom/pan works with new card components
- [ ] Spike code fully removed (no if/else branching)
- [ ] Protocol types consistent across bridge, frontend, and sprite
- [ ] Card colors follow template-default-with-override system
- [ ] Visual fidelity matches prototype reference (40px radius, p-8, typography scale)
