# Documents Sub-bar Completion

**Date:** 2026-01-01
**Status:** Design Complete
**Feature:** Complete the documents sub-bar with functional Filter, Edit, Export, and selection actions

---

## Overview

The documents sub-bar has placeholder components that need implementation. This feature completes the toolbar functionality for both the documents list view and document detail view.

### Scope

**In scope:**
- Filter dropdown (date range, stacks, extraction status)
- Edit button → opens agent flow
- Export button → opens agent flow (CSV/JSON)
- SelectionActions: Delete → agent confirmation, Add to Stack → agent flow
- Stack dropdown: display assigned stacks + "Add to stack" trigger
- 4 new agent flows: `edit`, `export`, `delete`, `add-to-stack`

**Out of scope (tracked in issues):**
- Preview panel redesign (#36)
- Persist selected document (#37)
- Scroll padding bug (#38)
- Tooltip bug (#39)

### Success Criteria

- Filter dropdown filters documents by date/stack/status
- Edit opens agent with field editing + re-extract capability
- Export opens agent with CSV/JSON download
- Bulk selection actions work for both documents and fields
- Stack dropdown shows assigned stacks and triggers add-to-stack flow

---

## Architecture

### Sub-bar Component Structure

The sub-bar uses Next.js parallel routes (`@subbar/`) with context-aware rendering:

```
@subbar/documents/
├── page.tsx              # Documents list sub-bar
├── [id]/page.tsx         # Document detail sub-bar (server wrapper)
└── default.tsx           # Fallback for route transitions
```

### Agent Flow Integration

New flows follow the existing Config + Hook Hybrid pattern in `components/agent/flows/`:

```
flows/documents/
├── upload/               # Exists - file upload wizard
├── extract/              # Exists (stub) - re-extraction
├── edit/                 # NEW - edit fields + re-extract
├── export/               # NEW - CSV/JSON download
├── delete/               # NEW - confirmation dialog
└── add-to-stack/         # NEW - assign document to stacks
```

Each flow has:
- `metadata.tsx` - Static config (steps, icons, title)
- `use-[name]-flow.ts` - Dynamic logic hook
- `index.ts` - Barrel export

### State Management

| State | Location | Purpose |
|-------|----------|---------|
| Selection (docs) | `DocumentsFilterContext` | Track selected document IDs |
| Selection (fields) | `DocumentDetailFilterContext` | Track selected field IDs |
| Filter values | `DocumentsFilterContext` extension | Date/stack/status filters |
| Agent flow | `agent-store.ts` (Zustand) | Current flow type/step/data |

### Data Flow

1. User clicks action → `openFlow()` called with flow type + initial data
2. Agent card renders flow via registry lookup
3. Flow hook manages state, calls APIs
4. On completion, flow calls `close()` and triggers data refresh

---

## Components

### 1. Filter Dropdown

**Location:** `components/layout/filter-button.tsx` (update existing stub)

**Filters:**
| Filter | Type | Options |
|--------|------|---------|
| Date range | Select | Today, Yesterday, Last 7 days, Last 30 days, All time |
| Stacks | Multi-select | List of user's stacks + "No stack" option |
| Extraction status | Multi-select | Extracted, Not extracted, Processing, Failed |

**Behavior:**
- Dropdown with sections for each filter type
- Active filters shown as count badge on button: "Filter (2)"
- Clear all option at bottom
- Filters apply immediately (no "Apply" button)

**State:** Extends `DocumentsFilterContext` with filter values

### 2. Edit Flow

**Location:** `components/agent/flows/documents/edit/`

**Trigger:** Edit button in document detail sub-bar

**Steps:**
1. `fields` - Display editable field list with current values
2. `confirm` - Review changes before saving

**Capabilities:**
- Edit field values (text input for each field)
- Delete selected fields
- Trigger re-extraction (calls existing extraction agent)

**Data required:** Document ID, current extraction data, selected field IDs (if any)

### 3. Export Flow

**Location:** `components/agent/flows/documents/export/`

**Trigger:** Export button in document detail sub-bar

**Steps:**
1. `format` - Choose export format (CSV, JSON)
2. `download` - Generate and download file

**MVP scope:** CSV and JSON formats only. Future: integrations (Xero, QuickBooks).

**Data required:** Document ID, extraction data

### 4. Delete Flow

**Location:** `components/agent/flows/documents/delete/`

**Trigger:** Delete action in SelectionActions dropdown

**Steps:**
1. `confirm` - Confirmation dialog with item count

**Behavior:**
- Shows count of items to delete
- "Delete X documents" or "Delete X fields" based on context
- Destructive action styling (red button)
- On confirm: calls delete API, closes flow, refreshes data

**Data required:** Selected document IDs or field IDs, context (list vs detail)

### 5. Add to Stack Flow

**Location:** `components/agent/flows/documents/add-to-stack/`

**Triggers:**
- "Add to Stack" in SelectionActions dropdown (bulk)
- "+ Add to stack" in Stack dropdown (single document)

**Steps:**
1. `select` - Show stack list with checkboxes, search/filter
2. `confirm` - Summary of assignment

**Behavior:**
- Multi-select stacks
- Shows which stacks document is already in (pre-checked, toggleable)
- Option to create new stack (future, not MVP)

**Data required:** Document ID(s), user's stacks list, current assignments

### 6. Stack Dropdown

**Location:** `components/documents/stacks-dropdown.tsx` (update existing)

**Structure:**
```
[Button: "2 Stacks" or "No stacks"]
  └─ Receipts Q4           → click navigates to /stacks/[id]
  └─ Invoice Processing    → click navigates to /stacks/[id]
  └─ ────────────────────  (divider)
  └─ + Add to stack        → opens add-to-stack agent flow
```

**Behavior:**
- Button label shows count or "No stacks"
- Clicking stack name navigates to stack page
- "Add to stack" triggers agent flow

### 7. SelectionActions Updates

**Location:** `components/layout/selection-actions.tsx` (update existing)

**Current state:** Disabled placeholders for "Add to Stack" and "Delete"

**Updates needed:**
- Enable "Add to Stack" → calls `openFlow({ type: 'add-to-stack', ... })`
- Enable "Delete" → calls `openFlow({ type: 'delete', ... })`
- Pass selected IDs and context to flows

---

## Context-Specific Behavior

### Documents List View (multi-document selection)

| Action | Available | Behavior |
|--------|-----------|----------|
| Filter | Yes | Filters document list |
| Search | Yes | Searches by filename |
| Add to Stack | Yes | Opens agent, assigns selected docs to stacks |
| Delete | Yes | Opens agent, confirms deletion of selected docs |
| Edit | No | Disabled (can't bulk edit) |
| Export | No | Disabled (can't bulk export) |

### Document Detail View (multi-field selection)

| Action | Available | Behavior |
|--------|-----------|----------|
| Filter | Yes | Filters extracted fields |
| Search | Yes | Searches field names |
| Add to Stack | Yes | For whole document (not field-specific) |
| Delete | Yes | Opens agent, confirms deletion of selected fields |
| Edit | Yes | Opens agent with selected fields for editing |
| Export | Yes | Opens agent, exports document data |
| Stack dropdown | Yes | Shows assigned stacks, add to stack trigger |

---

## API Endpoints

### Existing (no changes needed)
- `GET /documents` - List documents (supports filtering)
- `GET /documents/:id` - Get document with extraction
- `DELETE /documents/:id` - Delete document
- `POST /agent/extract` - Trigger extraction

### New/Updated Supabase Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| Update extraction | Supabase direct | Update field values in `extractions` table |
| Delete fields | Supabase direct | Remove fields from extraction JSONB |
| Assign to stack | Supabase direct | Insert into `stack_documents` junction table |
| Remove from stack | Supabase direct | Delete from `stack_documents` |

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Delete fails | Show error toast, keep flow open for retry |
| Export fails | Show error in agent, allow retry |
| Stack assignment fails | Show error toast, don't close flow |
| Filter returns empty | Show "No documents match filters" empty state |
| Network error | Generic error toast with retry option |

---

## File Changes Summary

### New Files
```
components/agent/flows/documents/
├── edit/
│   ├── metadata.tsx
│   ├── use-edit-flow.ts
│   └── index.ts
├── export/
│   ├── metadata.tsx
│   ├── use-export-flow.ts
│   └── index.ts
├── delete/
│   ├── metadata.tsx
│   ├── use-delete-flow.ts
│   └── index.ts
└── add-to-stack/
    ├── metadata.tsx
    ├── use-add-to-stack-flow.ts
    └── index.ts
```

### Modified Files
```
components/layout/filter-button.tsx      # Implement filter dropdown
components/layout/selection-actions.tsx  # Enable and wire up actions
components/documents/stacks-dropdown.tsx # Add navigation + flow trigger
components/agent/flows/registry.ts       # Register new flows
components/documents/documents-filter-context.tsx  # Add filter state
```

---

## Implementation Order

1. **Filter dropdown** - Self-contained, no agent dependency
2. **Delete flow** - Simplest agent flow (single step confirmation)
3. **Add to Stack flow** - Reused by SelectionActions and Stack dropdown
4. **Export flow** - Two steps, file generation logic
5. **Edit flow** - Most complex, field editing + re-extract
6. **Wire up SelectionActions** - Connect to delete and add-to-stack flows
7. **Update Stack dropdown** - Navigation + flow trigger

---

## Open Questions

None - design is complete and validated.

---

## Related Documentation

- `frontend/CLAUDE.md` - Agent system patterns
- `docs/ARCHITECTURE.md` - System architecture
- `docs/SCHEMA.md` - Database schema (extractions, stack_documents tables)
