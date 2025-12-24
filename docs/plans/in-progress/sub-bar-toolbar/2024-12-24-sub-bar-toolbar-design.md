# Linear-Style Sub-bar Toolbar Design

**Date:** 2024-12-24
**Status:** Design Complete
**Feature:** Sub-bar toolbar for documents pages

---

## Overview

Add a Linear-style sub-bar below the main header on both documents list and document detail pages. Creates clear separation between navigation/layout controls (main header) and view options/data actions (sub-bar).

---

## Layout Structure

**Pattern:**
- Main header = Navigation + layout controls
- Sub-bar = View options (left) + data actions (right)
- Both bars are `h-12` (48px)

### Documents List Page

```
┌─────────────────────────────────────────────────────────────┐
│ Documents                                                   │ ← Main Header (h-12)
├─────────────────────────────────────────────────────────────┤
│ [Filter] [🔍]                    [2 selected ▾] [Upload]    │ ← Sub-bar (h-12)
├─────────────────────────────────────────────────────────────┤
│ □ Name                          Stacks    Size    Date      │
│ ☐ invoice.pdf                   —         224 KB  Today     │
│ ☐ receipt.pdf                   —         83 KB   Yesterday │
└─────────────────────────────────────────────────────────────┘
```

- **Main header left:** "Documents" title
- **Main header right:** Empty (clean, consistent pattern)
- **Sub-bar left:** Filter button (fixed) + Search pill (expandable)
- **Sub-bar right:** Selection count + Actions (when selected) + Upload button

### Document Detail Page

```
┌─────────────────────────────────────────────────────────────┐
│ Documents > invoice.pdf                          [Preview]  │ ← Main Header (h-12)
├─────────────────────────────────────────────────────────────┤
│ [Filter] [🔍]                    [Stacks ▾] [Edit] [Export] │ ← Sub-bar (h-12)
├─────────────────────────────────────────────────────────────┤
│ Field          Value                        Conf.  │ Preview│
│ Doc Name       invoice.pdf                  100%   │  PDF   │
└─────────────────────────────────────────────────────────────┘
```

- **Main header left:** Breadcrumbs (Documents > filename.pdf)
- **Main header right:** Preview toggle only (layout control)
- **Sub-bar left:** Filter button (fixed) + Search pill (expandable)
- **Sub-bar right:** Stacks dropdown, Edit button, Export button

---

## Components

### Expandable Search Pill

Icon-only pill that expands on click to reveal text input.

```
Collapsed:        Expanded:
┌────┐            ┌─────────────────────────┐
│ 🔍 │     →      │ 🔍  Search...           │
└────┘            └─────────────────────────┘
```

**Behavior:**
- Default: Search icon in rounded pill (`w-10`)
- On click: Expands to show text input (`w-52`)
- CSS transition on width (`transition-[width] duration-200`)
- Click outside or ESC to collapse (if input is empty)
- Filter positioned left so search expands into free space

**Implementation pattern (from Perplexity research):**
```tsx
<div
  className={cn(
    "flex items-center rounded-full border border-input bg-background px-2 transition-[width] duration-200",
    open ? "w-52" : "w-10"
  )}
>
  <Search className="h-4 w-4 cursor-pointer" onClick={() => setOpen(true)} />
  <input
    className={cn("ml-2 bg-transparent text-sm outline-none w-full", !open && "w-0 opacity-0")}
    placeholder="Search..."
  />
</div>
```

### Filter Button

Placeholder button for future filter functionality.

**Current:** Opens shadcn DropdownMenu with "Coming soon" or empty state

**Future filter options:**

| Page | Potential Filters |
|------|-------------------|
| Documents List | By stack, document type, date range, file size |
| Document Detail | By confidence level, field type |

### Row Selection (Documents List)

Linear-style checkbox selection with bulk actions.

**Behavior:**
- Checkboxes hidden by default
- Checkboxes appear on row hover
- Select a row → right side reveals selection count + Actions
- Deselect all → right side hides selection UI

```
Nothing selected:              2 rows selected:
[Filter] [🔍]      [Upload]    [Filter] [🔍]   [2 selected ▾] [Upload]
```

**Actions dropdown:**
- Delete
- Add to Stack
- (future: Export selected)

### Document Detail Actions

Always visible in sub-bar right:

- **Stacks dropdown:** Assign/remove document from stacks
- **Edit button:** Enable inline editing of extracted fields
- **Export button:** Download as JSON/CSV

---

## Bug Fix: Table Scroll

**Issue:** Cannot scroll in document detail TanStack table (possibly documents list too)

**Investigation needed:**
- Check container overflow settings
- Ensure table scrolls within its container, not the whole page
- May need `overflow-auto` on table container with fixed height

---

## Skeleton Updates

Update loading skeletons to match new layout:

**Documents list skeleton:**
- Add sub-bar skeleton row
- Adjust table skeleton position

**Document detail skeleton:**
- Add sub-bar skeleton row
- Adjust content skeleton position

---

## Files to Create/Modify

### New Components
- `frontend/components/ui/expandable-search.tsx` - Reusable search pill
- `frontend/components/documents/sub-bar.tsx` - Sub-bar container component
- `frontend/components/documents/filter-dropdown.tsx` - Filter button + dropdown
- `frontend/components/documents/selection-actions.tsx` - Selection count + actions

### Modified Files
- `frontend/app/(app)/@header/documents/page.tsx` - Remove Upload from header
- `frontend/app/(app)/@header/documents/[id]/page.tsx` - Keep only Preview toggle
- `frontend/components/documents/documents-list.tsx` - Add sub-bar, checkboxes on hover
- `frontend/components/documents/document-detail-client.tsx` - Add sub-bar, move actions
- `frontend/components/documents/documents-table.tsx` - Add row selection checkboxes
- `frontend/components/documents/extracted-data-table.tsx` - Fix scroll, add search filter

---

## Design Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Actions in sub-bar vs header | Sub-bar | Clear separation: header = navigation/layout, sub-bar = data actions |
| Filter then Search order | Filter first | Search expands into free space, doesn't push other elements |
| Checkboxes on hover | Yes | Cleaner UI, matches Linear pattern |
| Selection UI location | Sub-bar right | No floating elements, consistent placement |
| Search pill style | Single expanding container | Cleaner than button + separate input |
| Upload button location | Sub-bar | It's a data action, belongs with other actions |

---

## Out of Scope

- Actual filter functionality (placeholder only)
- Saved views / view tabs
- Keyboard shortcuts for search (Cmd+K)
- Bulk export functionality
