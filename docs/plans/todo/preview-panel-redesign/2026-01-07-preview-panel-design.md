# Preview Panel Redesign - Design Document

**Date:** 2026-01-07
**Status:** Design Complete
**Related Issue:** #36

---

## Overview

Redesign the document preview panel to be cleaner, more informative, and inspired by Apple Finder's preview panel. Move all controls inside the preview container with hover-reveal behavior.

## Goals

1. Cleaner visual design with rounded preview container
2. More document metadata visible at a glance
3. Better PDF navigation for multi-page documents
4. Persistent state so last-viewed document shows on refresh
5. Expand modal for full-size viewing

---

## Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Controls location | Inside preview container | Cleaner, more immersive, Apple-style |
| Control visibility | Hover to reveal with gradient overlay | Clean default, discoverable on interaction |
| Tab naming | `PDF \| Text` | "Text" clearer than "Visual" or "OCR" |
| PDF navigation | Carousel with prev/next arrows | shadcn Carousel component, Apple-style hover arrows |
| Text view | Continuous scroll (no pagination) | Simpler for reading extracted text |
| Metadata | 2 lines below preview | Concise, Apple Finder inspired |
| Expand action | Modal dialog | Keeps user in context |
| Persistence | localStorage for last document ID | Consistent experience across refreshes |

---

## Component Structure

### Preview Panel Layout

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │                                 │ │  ← Default: clean preview
│ │                                 │ │
│ │      PDF or Text content        │ │
│ │      (scrollable)               │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │  ← Rounded container
│                                     │
│ invoice_march.pdf                   │  ← Line 1: filename
│ PDF · 69 KB · 3 pages · 12 fields   │  ← Line 2: metadata
└─────────────────────────────────────┘
```

### On Hover State

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │  ← Gradient overlay (top)
│ │ PDF │ Text           [⤢] [↓]   │ │  ← Tabs + Expand + Download
│ │                                 │ │
│ │      PDF or Text content        │ │
│ │                                 │ │
│ │      [←]      1/3      [→]      │ │  ← Page nav (PDF only)
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │  ← Gradient overlay (bottom)
│ └─────────────────────────────────┘ │
│                                     │
│ invoice_march.pdf                   │
│ PDF · 69 KB · 3 pages · 12 fields   │
└─────────────────────────────────────┘
```

---

## Hover Controls

### Top Bar (inside preview)
- **Left:** Tab switcher (`PDF | Text`)
- **Right:** Expand button `[⤢]`, Download button `[↓]`

### Bottom Bar (inside preview, PDF only)
- **Center:** Page navigation `[←] 1/3 [→]`

### Gradient Overlay
Semi-transparent gradient from edges to transparent center. Ensures controls are readable regardless of PDF content.

```css
/* Top gradient */
background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);

/* Bottom gradient */
background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
```

---

## Tab Views

### PDF Tab
- Uses shadcn Carousel component with `embla-carousel-react`
- Each page is a carousel item
- Prev/next arrows appear on hover
- Content scrollable within each page (for tall PDFs)
- Responsive to ResizablePanel width changes

### Text Tab
- Continuous scroll of all extracted text
- No page navigation (single scrollable block)
- Same expand/download buttons available
- Monospace or readable font for text content

---

## Metadata Section

Two lines below the preview container:

**Line 1:** Filename
- `font-medium` weight
- `text-foreground` color
- Truncate with ellipsis if too long

**Line 2:** Document details
- `text-sm text-muted-foreground`
- Dot-separated: `PDF · 69 KB · 3 pages · 12 fields`
- When not extracted: `PDF · 69 KB · 3 pages · Not extracted`

### Extraction Status Display
- **When extracted:** Show field count (e.g., "12 fields")
- **When not extracted:** Show "Not extracted" (potentially styled as clickable to trigger extraction)

---

## Expand Modal

Full-screen modal for larger document viewing.

```
┌─────────────────────────────────────────────────────────┐
│                                                     [X] │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  │                                                   │  │
│  │                  PDF Content                      │  │
│  │                  (scrollable)                     │  │
│  │                                                   │  │
│  │                [←]  1 / 3  [→]                    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  invoice_march.pdf                              [↓]     │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- 90vh height, responsive width (max-w-4xl or similar)
- Same carousel/page navigation as preview
- Filename at bottom for context
- Download button available
- Close: Click outside, X button, or Escape key
- Keyboard navigation: ← → for pages

---

## Persistent State

### Last Viewed Document
Persist `selectedDocId` to localStorage so the last viewed document shows on page refresh.

**Implementation approach:** Extend `SelectedDocumentContext` with localStorage (same pattern as `PreviewPanelContext`).

```typescript
// On mount - restore last selected doc
useEffect(() => {
  const lastDocId = localStorage.getItem('stackdocs-last-document')
  if (lastDocId) setSelectedDocId(lastDocId)
}, [])

// On change - save to localStorage
useEffect(() => {
  if (selectedDocId) {
    localStorage.setItem('stackdocs-last-document', selectedDocId)
  }
}, [selectedDocId])
```

**Edge case:** If stored document was deleted, gracefully fall back to empty state.

---

## Empty State

When no document is selected (first-time user or deleted document fallback):

Simple text: "Select a document to preview"

**Future:** Reusable `EmptyState` component (tracked in issue #41)

---

## Loading State

Spinner while PDF loads (existing implementation sufficient for now).

---

## Technical Notes

### shadcn Components Used
- `Carousel` (with `CarouselPrevious`, `CarouselNext`) - PDF page navigation
- `Tabs` / `TabsList` / `TabsTrigger` - PDF/Text switcher
- `Dialog` - Expand modal
- `Button` - Action buttons (expand, download)

### Responsive Behavior
- Preview container fills available width in ResizablePanel
- Carousel adapts to panel resize (embla-carousel `watchResize`)
- Metadata truncates gracefully on narrow panels

### Accessibility
- Keyboard navigation for carousel (← →)
- Escape to close modal
- Focus management in modal
- ARIA labels on icon buttons

---

## Inspiration References

- **Apple Finder preview panel** - Rounded container, metadata below, hover controls
- **Linear sidebar** - Clean property display
- **shadcn File Manager example** - Info panel pattern

---

## Out of Scope

- Thumbnail strip for page navigation (saves vertical space)
- Extracted fields in expand modal (keep simple)
- Text tab download as .txt (users want CSV/JSON exports)
- Complex empty state illustrations (future #41)
