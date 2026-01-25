# Phase 4: Frontend Cleanup

**Parent:** `2026-01-13-documents-redesign-design.md`
**Scope:** Delete `/documents/[id]` route, simplify document name interaction, update preview panel, deprecate extract flow
**Estimated Time:** 1-2 hours

---

## Overview

This phase removes the per-document extraction UI by:
1. Deleting the `/documents/[id]` detail page and related routes
2. Changing document name from a navigating Link to a plain span
3. Updating preview panel metadata (remove "X fields" indicator)
4. Deprecating the `extract-document` agent flow

---

## Task 1: Delete Document Detail Route (Conditional)

**Note:** These routes may already be deleted. Check if they exist before attempting removal.

**Step 1a: Check if routes exist**

```bash
# Check which directories exist
ls -la frontend/app/\(app\)/documents/\[id\]/ 2>/dev/null && echo "EXISTS" || echo "ALREADY DELETED"
ls -la frontend/app/\(app\)/@header/documents/\[id\]/ 2>/dev/null && echo "EXISTS" || echo "ALREADY DELETED"
ls -la frontend/app/\(app\)/@subbar/documents/\[id\]/ 2>/dev/null && echo "EXISTS" || echo "ALREADY DELETED"
```

**Step 1b: Delete if they exist**

```bash
# Delete only if directories exist
[ -d "frontend/app/(app)/documents/[id]" ] && git rm -r frontend/app/\(app\)/documents/\[id\]/
[ -d "frontend/app/(app)/@header/documents/[id]" ] && git rm -r frontend/app/\(app\)/@header/documents/\[id\]/
[ -d "frontend/app/(app)/@subbar/documents/[id]" ] && git rm -r frontend/app/\(app\)/@subbar/documents/\[id\]/
```

**Expected files (if they exist):**
- `frontend/app/(app)/documents/[id]/page.tsx`
- `frontend/app/(app)/@header/documents/[id]/page.tsx`
- `frontend/app/(app)/@header/documents/[id]/default.tsx`
- `frontend/app/(app)/@header/documents/[id]/error.tsx`
- `frontend/app/(app)/@subbar/documents/[id]/page.tsx`
- `frontend/app/(app)/@subbar/documents/[id]/default.tsx`

**If routes don't exist:** Skip to Task 2. The routes may have been removed in a previous refactor.

---

## Task 2: Change Document Name from Link to Span

**File:** `frontend/components/documents/columns.tsx`

**Current code (lines 94-115):**
```tsx
cell: ({ row }) => {
  const doc = row.original;
  return (
    <div className="flex items-center gap-2 max-w-full -ml-px">
      <FileTypeIcon mimeType={doc.mime_type} className="shrink-0" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/documents/${doc.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium hover:underline truncate"
          >
            {doc.filename}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Open {doc.filename}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
},
```

**New code:**
```tsx
cell: ({ row }) => {
  const doc = row.original;
  return (
    <div className="flex items-center gap-2 max-w-full -ml-px">
      <FileTypeIcon mimeType={doc.mime_type} className="shrink-0" />
      <span className="font-medium truncate" title={doc.filename}>
        {doc.filename}
      </span>
    </div>
  );
},
```

**Step 2b: Remove Link import (line 3)**

Change from:
```tsx
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
```

To:
```tsx
import type { ColumnDef } from "@tanstack/react-table";
```

**Note:** The `Tooltip`, `TooltipContent`, `TooltipTrigger` imports (lines 8-12) should STAY - they're still used by header checkbox tooltips.

---

## Task 3: Update Preview Panel Metadata

**File:** `frontend/components/preview-panel/preview-metadata.tsx`

**Current display:**
```
file-sample_150kB.pdf
PDF . 139 KB . 4 pages . 6 fields
```

**New display:**
```
file-sample_150kB.pdf
PDF . 139 KB . 4 pages
```

**Change required:**
Remove `fieldCount` from the details array and component props.

**Current code (lines 1-49):**
```tsx
interface PreviewMetadataProps {
  filename: string
  mimeType: string
  fileSize: number | null
  pageCount: number | null
  fieldCount: number | null  // <-- Remove this
}
// ...
if (fieldCount !== null) {
  details.push(`${fieldCount} fields`)
} else {
  details.push('Not extracted')
}
```

**New code:**
```tsx
interface PreviewMetadataProps {
  filename: string
  mimeType: string
  fileSize: number | null
  pageCount: number | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.startsWith('image/')) return 'Image'
  return 'Document'
}

export function PreviewMetadata({
  filename,
  mimeType,
  fileSize,
  pageCount,
}: PreviewMetadataProps) {
  const fileTypeLabel = getFileTypeLabel(mimeType)

  const details: string[] = [fileTypeLabel]
  if (fileSize !== null) details.push(formatFileSize(fileSize))
  if (pageCount !== null && pageCount > 1) details.push(`${pageCount} pages`)

  return (
    <div className="pr-4 py-3 shrink-0">
      <p className="font-medium text-foreground truncate" title={filename}>
        {filename}
      </p>
      <p className="text-sm text-muted-foreground">
        {details.join(' · ')}
      </p>
    </div>
  )
}
```

---

## Task 3b: Add New Metadata Display to Preview Panel

**Design requirement:**
```
Invoice - Acme Corp - March 2026        ← display_name (or original if not set)
PDF · 139 KB · 4 pages
[invoice] [acme-corp] [$1,250]          ← tags as badges
"Monthly consulting invoice from..."     ← summary (truncated, expand on hover)
```

**File:** `frontend/components/preview-panel/preview-metadata.tsx`

**Updated interface:**
```tsx
interface PreviewMetadataProps {
  filename: string
  mimeType: string
  fileSize: number | null
  pageCount: number | null
  displayName: string | null      // NEW
  tags: string[] | null           // NEW
  summary: string | null          // NEW
}
```

**Updated component:**
```tsx
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.startsWith('image/')) return 'Image'
  return 'Document'
}

export function PreviewMetadata({
  filename,
  mimeType,
  fileSize,
  pageCount,
  displayName,
  tags,
  summary,
}: PreviewMetadataProps) {
  const fileTypeLabel = getFileTypeLabel(mimeType)
  const title = displayName || filename

  const details: string[] = [fileTypeLabel]
  if (fileSize !== null) details.push(formatFileSize(fileSize))
  if (pageCount !== null && pageCount > 1) details.push(`${pageCount} pages`)

  return (
    <div className="pr-4 py-3 shrink-0 space-y-1">
      {/* Title: display_name or filename fallback */}
      <p className="font-medium text-foreground truncate" title={title}>
        {title}
      </p>

      {/* File details */}
      <p className="text-sm text-muted-foreground">
        {details.join(' · ')}
      </p>

      {/* Tags as badges */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Summary with truncation and hover expand */}
      {summary && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-sm text-muted-foreground italic truncate cursor-help">
              "{summary}"
            </p>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm">
            <p>{summary}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
```

**Verification:** The `Tooltip` component requires a `TooltipProvider` ancestor. Before implementing, verify it exists in the app layout:

```bash
grep -r "TooltipProvider" frontend/app/
```

If not found, add `<TooltipProvider>` to `frontend/app/(app)/layout.tsx`.

---

## Task 3c: Update useSelectedDocument Hook

**File:** `frontend/components/documents/selected-document-context.tsx`

Add the new metadata fields to the context and hook.

**Update SelectedDocumentContextType interface:**
```tsx
interface SelectedDocumentContextType {
  // ... existing fields ...
  displayName: string | null      // NEW
  tags: string[] | null           // NEW
  summary: string | null          // NEW
  setDisplayName: (name: string | null) => void    // NEW
  setTags: (tags: string[] | null) => void         // NEW
  setSummary: (summary: string | null) => void     // NEW
}
```

**Add state and setters to provider (follow existing pattern with `useCallback` wrappers):**

```tsx
// Add state declarations (after existing state, ~line 64)
const [displayName, setDisplayNameState] = useState<string | null>(null)
const [tags, setTagsState] = useState<string[] | null>(null)
const [summary, setSummaryState] = useState<string | null>(null)

// Add useCallback wrappers (after existing setters, ~line 130)
const setDisplayName = useCallback((name: string | null) => {
  setDisplayNameState(name)
}, [])

const setTags = useCallback((tags: string[] | null) => {
  setTagsState(tags)
}, [])

const setSummary = useCallback((summary: string | null) => {
  setSummaryState(summary)
}, [])
```

**CRITICAL:** The `useCallback` wrappers are required. Without them, the context value changes on every render, causing infinite re-render loops.

**Also update `setSelectedDocId` to clear new fields on deselect (~line 89-97):**
```tsx
if (id === null) {
  // ... existing clears ...
  setDisplayNameState(null)
  setTagsState(null)
  setSummaryState(null)
}
```

**Add to `contextValue` useMemo (~line 132):**
```tsx
const contextValue = useMemo(() => ({
  // ... existing ...
  displayName,
  tags,
  summary,
  setDisplayName,
  setTags,
  setSummary,
}), [
  // ... existing deps ...
  displayName,
  tags,
  summary,
  setDisplayName,
  setTags,
  setSummary,
])
```

**Export in useSelectedDocument (return statement):**
```tsx
return {
  // ... existing ...
  displayName,
  tags,
  summary,
  setDisplayName,
  setTags,
  setSummary,
}
```

---

## Task 3d: Update Document Type and Data Flow

The new metadata fields come from the `documents` table, so they're already fetched with the documents list. No separate query needed.

**Step 3d-1: Update Document interface**

**File:** `frontend/types/documents.ts`

```tsx
export interface Document {
  id: string
  filename: string
  mime_type: string
  file_size_bytes: number
  file_path: string | null
  status: DocumentStatus
  uploaded_at: string
  stacks: StackSummary[]
  display_name: string | null    // NEW
  tags: string[] | null          // NEW
  summary: string | null         // NEW
}
```

**Step 3d-2: Update server-side documents query**

**File:** `frontend/lib/queries/documents.ts`

Find the `getDocuments` function and ensure it selects the new columns. The exact location depends on how the query is structured, but add:
```tsx
.select('*, display_name, tags, summary, ...')
```

**Step 3d-3: Update documents-table.tsx destructuring to get new setters**

**File:** `frontend/components/documents/documents-table.tsx`

First, add the new setters to the destructuring from `useSelectedDocument` (around lines 49-61):

```tsx
// Add to existing destructuring from useSelectedDocument()
const {
  selectedDocId,
  setSelectedDocId,
  setSignedUrl,
  setSignedUrlDocId,
  setMimeType,
  setOcrText,
  setDocumentMetadata,
  setExtractedFields,
  setIsLoadingExtraction,
  setDisplayName,    // NEW
  setTags,           // NEW
  setSummary,        // NEW
} = useSelectedDocument();
```

**Step 3d-4: Set new metadata in useEffect**

In the `useEffect` that runs when `selectedDoc` changes (around line 163), add:

```tsx
// Set document metadata immediately from local document data
if (selectedDoc) {
  setDocumentMetadata({
    filename: selectedDoc.filename,
    filePath: selectedDoc.file_path,
    assignedStacks: selectedDoc.stacks || [],
    fileSize: selectedDoc.file_size_bytes,
    pageCount: null,
  });
  // NEW: Set metadata fields from document
  setDisplayName(selectedDoc.display_name ?? null);
  setTags(selectedDoc.tags ?? null);
  setSummary(selectedDoc.summary ?? null);
}
```

**Why no separate query?** The metadata is on the `documents` table, already fetched in the initial page load. Reading from `selectedDoc` is instant - no network round-trip needed.

---

## Task 3e: Update Documents Layout to Pass New Props

**File:** `frontend/app/(app)/documents/layout.tsx`

**Update destructuring:**
```tsx
const {
  signedUrl,
  ocrText,
  mimeType,
  selectedDocId,
  signedUrlDocId,
  filename,
  fileSize,
  pageCount,
  displayName,    // NEW
  tags,           // NEW
  summary,        // NEW
} = useSelectedDocument();
```

**Update metadata prop:**
```tsx
metadata={{
  mimeType,
  filename,
  fileSize,
  pageCount,
  displayName,    // NEW
  tags,           // NEW
  summary,        // NEW
}}
```

---

## Task 3f: Update Documents Header Breadcrumb for Selected Document

**Purpose:** Show the selected document name in the breadcrumb when a document is being previewed. This replaces the UX from the removed `/documents/[id]` route.

**Behavior:**
```
No document selected:
📄 Documents

Document selected (preview open):
📄 Documents  >  📎 Invoice - Acme Corp - March 2026.pdf
                    ↑ display_name (fallback to filename)
```

**Step 3f-1: Extend PageHeader to accept extra breadcrumb**

**File:** `frontend/components/layout/page-header.tsx`

Add to `PageHeaderProps` interface (~line 50):
```tsx
interface PageHeaderProps {
  title?: string
  icon?: ReactNode
  actions?: ReactNode
  /** Optional extra breadcrumb to append (e.g., selected document) */
  extraBreadcrumb?: {
    label: string
    icon?: ReactNode
  }
}
```

Update the component to render the extra breadcrumb after the pathname breadcrumbs (~line 117, before closing `</BreadcrumbList>`):

```tsx
{/* Extra breadcrumb for selected item (e.g., document preview) */}
{extraBreadcrumb && (
  <>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage className="flex items-center gap-1.5">
        {extraBreadcrumb.icon}
        <span className="max-w-[200px] truncate">{extraBreadcrumb.label}</span>
      </BreadcrumbPage>
    </BreadcrumbItem>
  </>
)}
```

**Step 3f-2: Update documents header to show selected document**

**File:** `frontend/app/(app)/@header/documents/page.tsx`

Replace entire file with client component:

```tsx
'use client'

import { PageHeader } from '@/components/layout/page-header'
import { PreviewToggle } from '@/components/documents/preview-toggle'
import { useSelectedDocument } from '@/components/documents/selected-document-context'
import { FileTypeIcon } from '@/components/shared/file-type-icon'

/**
 * Header slot for documents list page.
 * Shows breadcrumb with selected document name when preview is open.
 */
export default function DocumentsHeaderSlot() {
  const { selectedDocId, displayName, filename, mimeType } = useSelectedDocument()

  // Show selected document in breadcrumb when preview is open
  const extraBreadcrumb = selectedDocId
    ? {
        label: displayName || filename || 'Document',
        icon: <FileTypeIcon mimeType={mimeType || 'application/pdf'} className="size-4" />,
      }
    : undefined

  return (
    <PageHeader
      extraBreadcrumb={extraBreadcrumb}
      actions={<PreviewToggle />}
    />
  )
}
```

**Step 3f-3: Update default.tsx to match**

**File:** `frontend/app/(app)/@header/documents/default.tsx`

If this file exists and differs from page.tsx, update it to use the same client component pattern, or re-export from page.tsx:

```tsx
export { default } from './page'
```

**Acceptance criteria:**
- [ ] Breadcrumb shows just "Documents" when no document selected
- [ ] Breadcrumb shows "Documents > [document name]" when document selected
- [ ] Uses `display_name` if available, falls back to `filename`
- [ ] Shows file type icon (PDF, image, etc.) before document name
- [ ] Long document names are truncated with ellipsis
- [ ] Breadcrumb updates immediately when selection changes

---

## Task 4: Update PreviewPanel Props

**File:** `frontend/components/preview-panel/preview-panel.tsx`

**Changes:**
1. Remove `extractedFields` from `MetadataProps` interface
2. Add `displayName`, `tags`, `summary` to `MetadataProps` interface
3. Remove `fieldCount` calculation
4. Update `<PreviewMetadata>` call with new props

**Updated MetadataProps interface:**
```tsx
interface MetadataProps {
  mimeType: string;
  filename: string | null;
  fileSize: number | null;
  pageCount: number | null;
  displayName: string | null;    // NEW
  tags: string[] | null;         // NEW
  summary: string | null;        // NEW
}
```

**Remove fieldCount calculation (delete these lines):**
```tsx
// Calculate field count for metadata
const fieldCount = extractedFields
  ? Object.keys(extractedFields).length
  : null;
```

**Updated PreviewMetadata call:**
```tsx
<PreviewMetadata
  filename={filename}
  mimeType={mimeType}
  fileSize={fileSize}
  pageCount={totalPages > 0 ? totalPages : pageCount}
  displayName={displayName}    // NEW
  tags={tags}                  // NEW
  summary={summary}            // NEW
/>
```

---

## Task 5: Update Documents Layout (PreviewPanel Consumer)

**File:** `frontend/app/(app)/documents/layout.tsx`

The documents layout passes props to PreviewPanel. Need to remove `extractedFields` from metadata prop.

**Changes:**

1. Remove `extractedFields` from useSelectedDocument destructuring (line 28):
```tsx
// Current (lines 19-29)
const {
  signedUrl,
  ocrText,
  mimeType,
  selectedDocId,
  signedUrlDocId,
  filename,
  fileSize,
  pageCount,
  extractedFields,  // <-- Remove this line
} = useSelectedDocument();
```

2. Remove `extractedFields` from metadata prop (line 90):
```tsx
// Current (lines 85-91)
metadata={{
  mimeType,
  filename,
  fileSize,
  pageCount,
  extractedFields,  // <-- Remove this line
}}
```

---

## Task 5b: Remove Extractions Query from Documents Table

**File:** `frontend/components/documents/documents-table.tsx`

The `fetchPreviewData` function (lines 180-223) fetches extraction data that is no longer needed.

**Step 5b-1: Remove extraction query from Promise.all (lines 199-203)**

```tsx
// REMOVE this query from the Promise.all array:
supabase
  .from("extractions")
  .select("extracted_fields")
  .eq("document_id", selectedDocId)
  .maybeSingle(),
```

**Step 5b-2: Update destructuring (line 188)**

Change from:
```tsx
const [urlResult, ocrResult, extractionResult] = await Promise.all([
```

To:
```tsx
const [urlResult, ocrResult] = await Promise.all([
```

**Step 5b-3: Remove setExtractedFields call (line 210)**

Remove:
```tsx
setExtractedFields(extractionResult.data?.extracted_fields ?? null);
```

**Step 5b-4: Update error handling (line 219)**

Remove:
```tsx
setExtractedFields(null);
```

**Step 5b-5: Remove setIsLoadingExtraction calls (optional)**

These lines reference extraction loading state. Either remove or keep with deprecation:
- Line 185: `setIsLoadingExtraction(true);`
- Line 211: `setIsLoadingExtraction(false);`
- Line 220: `setIsLoadingExtraction(false);`

**Recommendation:** Keep for now - context may still track this state for compatibility.

---

## Task 6: Deprecate Extract Document Flow

**Files to deprecate:**

The extract-document flow is incomplete (uses placeholders). We'll keep the files but add deprecation comments and remove from active use.

### 6a. Remove from Agent Actions

**File:** `frontend/components/agent/agent-actions.tsx`

**Remove this entry from ACTION_CONFIG (lines 35-43):**
```tsx
'/documents/[id]': [
  {
    id: 're-extract',
    label: 'Re-extract',
    icon: Icons.Refresh,
    flow: { type: 'extract-document', documentId: '', step: 'select' },
    tooltip: 'Re-extract data from this document',
  },
],
```

**Remove route matching logic (lines 130-132):**
```tsx
if (pathname.startsWith('/documents/') && pathname !== '/documents') {
  return ACTION_CONFIG['/documents/[id]'] || []
}
```

### 6b. Remove from Flow Registry

**File:** `frontend/components/agent/flows/registry.ts`

**Remove import (line 7):**
```tsx
import { extractFlowMetadata, useExtractFlow, type ExtractFlowStep } from './documents/extract'
```

**Remove registry entry (lines 30-33):**
```tsx
'extract-document': {
  metadata: extractFlowMetadata,
  useHook: useExtractFlow,
} as FlowRegistration<ExtractFlowStep>,
```

### 6c. Remove from AgentFlow Type

**File:** `frontend/components/agent/stores/agent-store.ts`

**Remove from AgentFlow union (line 16):**
```tsx
| { type: 'extract-document'; documentId: string; step: string }
```

**Remove from getFlowStatusText (line 168):**
```tsx
case 'extract-document': return 'Re-extract document'
```

### 6d. Add Deprecation Notice to Flow Files

**File:** `frontend/components/agent/flows/documents/extract/index.ts`

Add deprecation comment at top:
```tsx
/**
 * @deprecated This flow is deprecated as of Documents Redesign (2026-01).
 * Per-document extraction has been removed. Use Stacks for structured data extraction.
 * These files are kept for reference but not registered in the flow system.
 */
export { extractFlowMetadata, type ExtractFlowStep } from './metadata'
export { useExtractFlow } from './use-extract-flow'
```

---

## Task 7: Clean Up Document Detail Components

These components are only used by the deleted `/documents/[id]` route. Mark as deprecated but keep for now (may be useful for Stacks detail views).

**Files to add deprecation comments:**
- `frontend/components/documents/document-detail-client.tsx`
- `frontend/components/documents/document-detail-sub-bar.tsx`
- `frontend/components/documents/document-detail-filter-context.tsx`
- `frontend/components/documents/document-detail-actions.tsx`
- `frontend/components/documents/extracted-data-table.tsx`
- `frontend/components/documents/extracted-columns.tsx`
- `frontend/components/documents/bulk-delete-fields-dialog.tsx`

Add this comment at top of each file:
```tsx
/**
 * @deprecated This component was used by /documents/[id] which has been removed.
 * Kept for potential reuse in Stack detail views or future features.
 * See: docs/plans/in-progress/documents-redesign/
 */
```

---

## Task 8: Clean Up Context Providers

The `DocumentDetailFilterProvider` is no longer needed in the app layout since the document detail route is deleted.

**File:** `frontend/app/(app)/layout.tsx`

**Option A (Recommended):** Keep the provider for now - it's harmless and the context may be useful for future Stack detail views.

**Option B:** Remove the provider wrapping. This requires:
1. Removing the import (line 17)
2. Removing `<DocumentDetailFilterProvider>` and its closing tag (lines 45, 69)

**Recommendation:** Keep provider (Option A) to avoid risk and maintain flexibility.

---

## Task 9: Clean Up Queries File

**File:** `frontend/lib/queries/documents.ts`

The `getDocumentWithExtraction` function is no longer called by the deleted routes. Add deprecation comment:

```tsx
/**
 * @deprecated This query was used by /documents/[id] which has been removed.
 * Kept for potential reuse in future features.
 */
export const getDocumentWithExtraction = cache(async function getDocumentWithExtraction(
```

Note: `getDocumentStacks` is still used by other parts of the app.

**Also deprecate the associated type:**

**File:** `frontend/types/documents.ts`

Add deprecation comment to `DocumentWithExtraction` (lines 16-22):

```tsx
/**
 * @deprecated This type was used by /documents/[id] and getDocumentWithExtraction.
 * Both have been removed. Kept for potential reuse in future features.
 */
export interface DocumentWithExtraction extends Document {
  extraction_id: string | null
  extracted_fields: Record<string, unknown> | null
  confidence_scores: Record<string, number> | null
  session_id: string | null
  ocr_raw_text: string | null
}
```

---

## Task 9b: Deprecate streamAgentExtraction Function

**File:** `frontend/lib/agent-api.ts`

The `streamAgentExtraction` function (around lines 199-281) calls `POST /api/agent/extract` for per-document extraction. This flow is deprecated in favor of Stack-based extraction.

Add deprecation comment:

```tsx
/**
 * @deprecated This function was used for per-document extraction which has been removed.
 * Use Stack-based extraction instead. The extract-document agent flow is deprecated.
 * Kept for reference but may be removed in a future cleanup.
 */
export async function streamAgentExtraction(
```

---

## Task 10: Clean Up Selected Document Context

**File:** `frontend/components/documents/selected-document-context.tsx`

The `extractedFields`, `setExtractedFields`, and `isLoadingExtraction` state is no longer needed since we removed the document detail page. However, the documents table still fetches and sets these for the preview panel compatibility.

**Decision:** Keep for now - Task 5b removes the extraction query, but the context state can be cleaned up in a future pass.

---

## Task 11: Update CLAUDE.md Documentation

**File:** `frontend/components/documents/CLAUDE.md`

Update the file list and data flow diagram to reflect removed/deprecated components.

**Remove or mark deprecated:**
- `document-detail-client.tsx` - (deprecated)
- `document-detail-sub-bar.tsx` - (deprecated)
- `document-detail-filter-context.tsx` - (deprecated)
- `document-detail-actions.tsx` - (deprecated)
- `extracted-data-table.tsx` - (deprecated)
- `extracted-columns.tsx` - (deprecated)
- `bulk-delete-fields-dialog.tsx` - (deprecated)

---

## Task 12: Verify Build

After all changes, run:

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no import errors or type errors.

**Common issues to check:**
1. Broken imports referencing deleted files
2. Type errors from removed props (fieldCount, extractedFields)
3. Missing route fallbacks (default.tsx files)

---

## Task 13: Manual Testing Checklist

Test in browser after build succeeds:

- [ ] Navigate to `/documents` - page loads without errors
- [ ] Click a document row - row becomes selected, preview panel opens
- [ ] Click document name - same behavior as clicking row (no navigation)
- [ ] Breadcrumb shows "Documents" when no document selected
- [ ] Breadcrumb shows "Documents > [document name]" when document selected
- [ ] Breadcrumb uses display_name if available, falls back to filename
- [ ] Breadcrumb updates when clicking different documents
- [ ] Preview panel shows metadata WITHOUT "X fields" or "Not extracted"
- [ ] Preview panel shows display_name (or filename if null) as title
- [ ] Preview panel shows tags as badges (if present)
- [ ] Preview panel shows summary with hover expand (if present)
- [ ] Try to navigate to `/documents/[any-id]` directly - should 404
- [ ] Agent card on documents page shows only "Upload" and "Create Stack" actions

---

## Summary

| Task | Action | Files |
|------|--------|-------|
| 1 | Delete | `/documents/[id]/`, `@header/documents/[id]/`, `@subbar/documents/[id]/` |
| 2 | Modify | `columns.tsx` - Link to span |
| 3 | Modify | `preview-metadata.tsx` - remove fieldCount |
| 3b | Modify | `preview-metadata.tsx` - add displayName, tags, summary display |
| 3c | Modify | `selected-document-context.tsx` - add new metadata state |
| 3d | Modify | `documents-table.tsx` - fetch new metadata fields |
| 3e | Modify | `documents/layout.tsx` - pass new metadata props |
| 3f | Modify | `page-header.tsx`, `@header/documents/page.tsx` - breadcrumb for selected doc |
| 4 | Modify | `preview-panel.tsx` - update MetadataProps interface |
| 5 | Modify | `documents/layout.tsx` - remove extractedFields from metadata |
| 5b | Remove | `documents-table.tsx` - remove extractions query |
| 6 | Modify | `agent-actions.tsx`, `registry.ts`, `agent-store.ts` - remove extract flow |
| 7 | Deprecate | Document detail components (add comments) |
| 8 | Keep | `DocumentDetailFilterProvider` in layout |
| 9 | Deprecate | `getDocumentWithExtraction` query + `DocumentWithExtraction` type |
| 9b | Deprecate | `streamAgentExtraction` function in agent-api.ts |
| 10 | Keep | Selected document context extraction state (cleanup later) |
| 11 | Update | `components/documents/CLAUDE.md` |
| 12 | Verify | `npm run build` |
| 13 | Test | Manual browser testing |

---

## Rollback Plan

If issues arise, revert the commit:
```bash
git revert HEAD
```

All deleted files are tracked in git and can be restored.
