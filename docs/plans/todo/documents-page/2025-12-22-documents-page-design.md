# Documents Page Design

**Date:** 2025-12-22
**Status:** Ready for implementation

---

## Overview

Build the documents list page and document detail page - the core UI for viewing, managing, and editing extracted document data.

**Key Features:**
- Documents list with TanStack Table
- Document detail page with extracted data, preview panel, and AI editing
- Shared page header system (breadcrumbs + actions)

---

## Documents List Page (`/documents`)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Workspace / Documents                        [+ Upload]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Name                    │ Stacks        │ Date      │   │
│  ├─────────────────────────┼───────────────┼───────────┤   │
│  │ 📄 invoice_acme.pdf     │ Q1 Expenses   │ Jan 15    │   │
│  │ 📄 receipt_starbucks.jpg│ Travel        │ Jan 14    │   │
│  │ 📄 contract_client.pdf  │ Vendor +1     │ Jan 13    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Table Columns

| Column | Source | Notes |
|--------|--------|-------|
| Name | `documents.filename` | With file type icon (PDF/image) based on `mime_type` |
| Stacks | `stack_documents` join | Badge chips, "+N" overflow if many |
| Date | `documents.uploaded_at` | Relative or formatted date |

**Status handling:** No dedicated column. Show inline indicator (spinner/error icon) on affected rows only - most documents will be "completed".

### Interactions

- **Click row** → Navigate to `/documents/[id]`
- **Upload button** → Opens upload dialog/flow (separate feature)

### Data Fetching

Server component fetches documents with stacks join, passes to client table component.

```typescript
// documents/page.tsx (Server Component)
const documents = await getDocumentsWithStacks(userId)
return <DocumentsTable documents={documents} />
```

### Deferred for MVP

- Search bar
- Filter by stack dropdown
- Grid view toggle
- Sorting controls

---

## Document Detail Page (`/documents/[id]`)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Documents / invoice_acme.pdf    [Stacks ▼] [Export]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Extracted Data                    Preview                  │
│  ┌──────────────────────────┐     ┌────────────────────┐   │
│  │ FIELD    VALUE    CONF.  │     │ [PDF] [Visual]     │   │
│  ├──────────────────────────┤     ├────────────────────┤   │
│  │ vendor   Acme Corp  98%  │     │                    │   │
│  │ invoice  INV-2024   99%  │     │   Document         │   │
│  │ date     2024-01-15 95%  │     │   Preview          │   │
│  │ total    $1,320.00  98%  │     │   Here             │   │
│  │ line_items [2 items] 94% │     │                    │   │
│  └──────────────────────────┘     └────────────────────┘   │
│  [Edit]                                                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ✨ Ask agent to filter, edit, or analyze data...      [>]  │
└─────────────────────────────────────────────────────────────┘
```

### Header Actions

| Action | Behavior |
|--------|----------|
| Stacks dropdown | Checkbox list of user's stacks, toggle to assign/unassign |
| Export button | Export extracted data (format TBD - likely CSV/JSON) |

### Extracted Data Panel (Left)

**Table columns:** Field, Value, Confidence

- Field names from `extractions.extracted_fields` keys
- Values rendered based on type (strings, numbers, expandable for arrays/objects)
- Confidence from `extractions.confidence_scores` (green checkmark + percentage)

**Edit button:** Opens edit dialog (see below)

### Preview Panel (Right)

**Tabs:**
- **PDF** - Render original document using PDF viewer library
- **Visual** - Render OCR markdown as formatted text

### Edit Dialog

Simple key-value editor for MVP:

```
┌─────────────────────────────────────────────────────┐
│ Edit Extraction                               [X]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  vendor        [Acme Corporation    ] [🗑]          │
│  invoice_number[INV-2024-0847       ] [🗑]          │
│  date          [2024-01-15          ] [🗑]          │
│  total         [$1,320.00           ] [🗑]          │
│                                                     │
│  [+ Add Field]                                      │
│                                                     │
├─────────────────────────────────────────────────────┤
│                          [Cancel]  [Save Changes]   │
└─────────────────────────────────────────────────────┘
```

**Save flow:**
1. User edits fields, adds/removes as needed
2. Clicks "Save Changes"
3. Frontend generates instruction for agent (e.g., "Update vendor to 'Acme Corp', delete field 'notes', add field 'po_number' with value '12345'")
4. Sends to `/api/agent/correct` endpoint
5. Agent processes, updates database
6. UI shows streaming response in agent panel

### AI Chat Bar (Bottom)

Floating input bar at bottom of page:
- Sparkle icon + placeholder "Ask agent to filter, edit, or analyze data..."
- Submit button
- On submit → calls `/api/agent/correct` with natural language instruction

### Agent Response Panel

Collapsible overlay showing agent activity:

```
┌─────────────────────────────────────────────────────┐
│ ✓ Update complete                        [▼] [X]   │
├─────────────────────────────────────────────────────┤
│  ✓ Reviewing table structure                        │
│  ✓ Checking 12 rows                                 │
│  ✓ Updating records                                 │
│                                                     │
│  • I'm taking a look at the data now...            │
│  • I see the 'Vendor' column has inconsistent...   │
│  • I'll standardize those to 'Acme Corp Inc'...    │
│  • Found 3 variations that need fixing.            │
│  • Applying the changes...                          │
│  • All done. I've updated 12 rows.                 │
└─────────────────────────────────────────────────────┘
```

**States:**
- Collapsed (shows summary bar only)
- Expanded (shows full streaming output)
- Dismissable after completion

---

## Page Header System

### Architecture

Breadcrumbs set via React Context hook, actions rendered via portal/slot.

```typescript
// Layout provides the header structure
<header>
  <Breadcrumbs />        {/* From context */}
  <PageActions />        {/* Portal target */}
</header>

// Pages set breadcrumbs and render actions
useBreadcrumbs([
  { label: 'Documents', href: '/documents' },
  { label: doc.filename }
])

<PageActions>
  <StacksDropdown documentId={id} />
  <ExportButton extractionId={extraction.id} />
</PageActions>
```

### Breadcrumb Examples

| Route | Breadcrumbs |
|-------|-------------|
| `/documents` | Workspace / Documents |
| `/documents/[id]` | Documents / {filename} |
| `/extractions` | Workspace / Extractions |
| `/stacks/[id]` | Stacks / {stack name} |

---

## Data Requirements

### Documents List Query

```sql
SELECT
  d.id,
  d.filename,
  d.mime_type,
  d.status,
  d.uploaded_at,
  COALESCE(
    json_agg(json_build_object('id', s.id, 'name', s.name))
    FILTER (WHERE s.id IS NOT NULL),
    '[]'
  ) as stacks
FROM documents d
LEFT JOIN stack_documents sd ON d.id = sd.document_id
LEFT JOIN stacks s ON sd.stack_id = s.id
WHERE d.user_id = $1
GROUP BY d.id
ORDER BY d.uploaded_at DESC
```

### Document Detail Query

```sql
-- Document with latest extraction
SELECT
  d.*,
  e.id as extraction_id,
  e.extracted_fields,
  e.confidence_scores,
  e.session_id,
  ocr.raw_text
FROM documents d
LEFT JOIN extractions e ON d.id = e.document_id
LEFT JOIN ocr_results ocr ON d.id = ocr.document_id
WHERE d.id = $1 AND d.user_id = $2
ORDER BY e.created_at DESC
LIMIT 1
```

---

## Components Needed

### New Components

| Component | Purpose |
|-----------|---------|
| `DocumentsTable` | TanStack Table for documents list |
| `DocumentsTableColumns` | Column definitions |
| `StackBadges` | Render stack chips with overflow |
| `FileTypeIcon` | PDF/image icon based on mime type |
| `PageHeader` | Layout header with breadcrumbs + actions slot |
| `BreadcrumbsProvider` | Context for setting breadcrumbs |
| `PageActions` | Portal component for header actions |
| `ExtractedDataTable` | Field/Value/Confidence table |
| `PreviewPanel` | PDF + Visual tabs |
| `PdfViewer` | PDF rendering (react-pdf or similar) |
| `VisualPreview` | Rendered markdown from OCR |
| `EditExtractionDialog` | Key-value field editor |
| `AiChatBar` | Floating input for agent instructions |
| `AgentResponsePanel` | Collapsible streaming output display |
| `StacksDropdown` | Assign/unassign stacks to document |
| `ExportButton` | Export extraction data |

### shadcn Components to Install

- `table` - for TanStack Table styling
- `dialog` - for edit dialog
- `badge` - for stack chips
- `tabs` - for PDF/Visual toggle
- `popover` or `dropdown-menu` - for stacks dropdown

---

## Future Enhancements (Not MVP)

- **Search** - filter documents by name
- **Stack filter** - dropdown to filter by stack
- **Grid view** - card-based layout with previews
- **Field types** - Text, Number, Date, List type selection in edit dialog
- **Inline editing** - click cell to edit directly in table
- **Bulk actions** - select multiple documents, bulk assign to stack
- **Re-extract button** - trigger fresh extraction

---

## Related Documentation

| Doc | Purpose |
|-----|---------|
| `SCHEMA.md` | Database tables |
| `ARCHITECTURE.md` | System design |
| `extraction-agent/` | Agent implementation details |
