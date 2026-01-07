# Preview Panel Redesign - Implementation Plan

**Date:** 2026-01-07
**Design Doc:** `2026-01-07-preview-panel-design.md`
**Related Issue:** #36

---

## Overview

This plan breaks down the preview panel redesign into small, testable tasks. The approach is:
1. Create new component structure in `preview-panel/` folder
2. Build components bottom-up (leaf components first)
3. Integrate incrementally, keeping the app functional throughout
4. Remove old components after full integration

---

## Pre-Implementation Checklist

Before starting, verify:
- [ ] `npm run build` passes on main branch
- [ ] Design doc reviewed and understood
- [ ] shadcn Dialog component available (`components/ui/dialog.tsx`)

---

## Phase 1: Foundation (Tasks 1-3)

### Task 1: Create folder structure and barrel export

**Goal:** Set up the new `preview-panel/` directory with proper exports.

**Files to create:**
```
frontend/components/documents/preview-panel/
├── index.tsx              # Barrel export
└── (empty files for now)
```

**Implementation:**
1. Create `frontend/components/documents/preview-panel/` directory
2. Create `index.tsx` with placeholder export:
   ```tsx
   // Barrel export for preview-panel components
   // Components will be added as implemented
   export {}
   ```

**Test:** Build passes, no runtime changes.

---

### Task 2: Add missing icons to barrel export

**Goal:** Ensure all required icons are available.

**Required icons (check if already exported):**
- `IconMaximize` or `IconArrowsMaximize` for expand button
- `IconDownload` (already have)
- `IconChevronLeft` / `IconChevronRight` (already have)

**File:** `frontend/components/icons/index.ts`

**Implementation:**
1. Check which icons are missing
2. Add exports:
   ```tsx
   IconArrowsMaximize as Maximize,
   ```

**Test:** Import works in a test file, build passes.

---

### Task 3: Extend SelectedDocumentContext with additional metadata

**Goal:** Add `pageCount` and `fileSize` to context for metadata display.

**File:** `frontend/components/documents/selected-document-context.tsx`

**Implementation:**
1. Add to `DocumentMetadata` interface:
   ```tsx
   pageCount: number | null
   fileSize: number | null  // bytes
   ```
2. Add state and setter for these fields
3. Update `setDocumentMetadata` to accept new fields
4. Clear them on document deselection

**Test:** Context compiles, no runtime changes yet (data populated later).

---

## Phase 2: Leaf Components (Tasks 4-7)

### Task 4: Create `preview-metadata.tsx`

**Goal:** Component displaying filename and document details below preview.

**File:** `frontend/components/documents/preview-panel/preview-metadata.tsx`

**Props:**
```tsx
interface PreviewMetadataProps {
  filename: string
  mimeType: string
  fileSize: number | null      // bytes
  pageCount: number | null
  fieldCount: number | null    // from extractedFields
}
```

**Implementation:**
1. Format file size (bytes to KB/MB)
2. Determine file type label from mimeType (PDF, Image, etc.)
3. Build dot-separated metadata string:
   - `PDF . 69 KB . 3 pages . 12 fields` (when extracted)
   - `PDF . 69 KB . 3 pages . Not extracted` (when not extracted)
4. Render two lines:
   ```tsx
   <div className="px-4 py-3">
     <p className="font-medium text-foreground truncate">{filename}</p>
     <p className="text-sm text-muted-foreground">{metadataString}</p>
   </div>
   ```

**Test:** Render in isolation with mock props, verify display.

---

### Task 5: Create `page-navigation.tsx`

**Goal:** Reusable prev/next navigation for PDF pages.

**File:** `frontend/components/documents/preview-panel/page-navigation.tsx`

**Props:**
```tsx
interface PageNavigationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  variant?: 'overlay' | 'default'  // overlay = white text for gradient bg
  className?: string
}
```

**Implementation:**
1. Prev button (disabled when page <= 1)
2. Page indicator: `1 / 3` with `tabular-nums`
3. Next button (disabled when page >= total)
4. Variant styling:
   - `default`: standard button variants
   - `overlay`: ghost buttons with `text-white` for gradient background
5. Add keyboard event handler (passed from parent) for arrow keys

**Test:** Render with mock props, click buttons, verify state updates.

---

### Task 6: Create `preview-controls.tsx`

**Goal:** Top bar with tabs and action buttons (expand, download).

**File:** `frontend/components/documents/preview-panel/preview-controls.tsx`

**Props:**
```tsx
interface PreviewControlsProps {
  activeTab: 'pdf' | 'text'
  onTabChange: (tab: 'pdf' | 'text') => void
  isPdfAvailable: boolean
  onExpand: () => void
  onDownload: () => void
}
```

**Implementation:**
1. TabsList with PDF/Text triggers (PDF disabled if not available)
2. Action buttons group (expand icon, download icon)
3. Button styling for overlay:
   ```tsx
   <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
   ```

**Test:** Render in isolation, verify tab switching and button clicks.

---

### Task 7: Create `text-content.tsx`

**Goal:** Refactored text/markdown display component.

**File:** `frontend/components/documents/preview-panel/text-content.tsx`

**Implementation:**
1. Move logic from existing `visual-preview.tsx`
2. Same markdown rendering with sanitized links
3. Continuous scroll, no pagination
4. Handle null/empty text gracefully

**Test:** Render with sample markdown, verify display.

---

## Phase 3: Container Components (Tasks 8-10)

### Task 8: Create `pdf-content.tsx`

**Goal:** PDF rendering component that lifts page state to parent.

**File:** `frontend/components/documents/preview-panel/pdf-content.tsx`

**Props:**
```tsx
interface PdfContentProps {
  url: string
  currentPage: number
  onPageChange: (page: number) => void
  onLoadSuccess: (info: { numPages: number }) => void
  onLoadError?: (error: Error) => void
}
```

**Implementation:**
1. Refactor from existing `pdf-viewer.tsx`
2. Remove internal page state (lifted to parent)
3. Keep ResizeObserver scaling logic
4. Keep react-pdf Document/Page with same config
5. Remove the bottom navigation bar (now separate component)

**Key difference from current:** Page state controlled by parent, not internal.

**Test:** Render with mock props, verify PDF loads and scales.

---

### Task 9: Create `preview-container.tsx`

**Goal:** Rounded container with hover-reveal controls.

**File:** `frontend/components/documents/preview-panel/preview-container.tsx`

**Props:**
```tsx
interface PreviewContainerProps {
  // Tab state
  activeTab: 'pdf' | 'text'
  onTabChange: (tab: 'pdf' | 'text') => void
  isPdfAvailable: boolean

  // PDF state
  pdfUrl: string | null
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onPdfLoad: (info: { numPages: number }) => void

  // Text content
  ocrText: string | null

  // Actions
  onExpand: () => void
  onDownload: () => void
}
```

**Implementation:**
1. Outer container with `group` class for hover detection
2. Rounded corners: `rounded-lg overflow-hidden bg-muted`
3. Top gradient overlay (opacity-0 group-hover:opacity-100):
   - `PreviewControls` component (tabs + buttons)
   - Gradient: `bg-gradient-to-b from-black/60 via-black/30 to-transparent`
4. Content area with TabsContent (Tabs wrapper)
5. Bottom gradient overlay (PDF only, multi-page only):
   - `PageNavigation` component
   - Gradient: `bg-gradient-to-t from-black/60 via-black/30 to-transparent`
6. Add keyboard handler for arrow key navigation

**Test:** Render with mock props, hover to reveal controls.

---

### Task 10: Create `expand-modal.tsx`

**Goal:** Full-size document viewing modal.

**File:** `frontend/components/documents/preview-panel/expand-modal.tsx`

**Props:**
```tsx
interface ExpandModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // PDF props
  pdfUrl: string | null
  activeTab: 'pdf' | 'text'
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  // Text props
  ocrText: string | null
  // Metadata
  filename: string
  onDownload: () => void
}
```

**Implementation:**
1. Use shadcn `Dialog` and `DialogContent`
2. Size: `max-w-4xl h-[90vh]`
3. Visually hidden `DialogTitle` for accessibility
4. Content area with PDF or Text based on activeTab
5. Footer: filename + page nav (if PDF) + download button
6. Keyboard: Escape closes, arrow keys navigate pages
7. Focus trap handled by Dialog

**Test:** Open modal, navigate pages, close with Escape.

---

## Phase 4: Main Component (Task 11)

### Task 11: Create new `preview-panel.tsx`

**Goal:** Main orchestrator component tying everything together.

**File:** `frontend/components/documents/preview-panel/preview-panel.tsx`

**Props:**
```tsx
interface PreviewPanelProps {
  pdfUrl: string | null
  ocrText: string | null
  mimeType: string
  // Additional metadata from context
  filename: string | null
  fileSize: number | null
  pageCount: number | null
  extractedFields: Record<string, unknown> | null
}
```

**Implementation:**
1. State management:
   - `currentPage` (lifted from PDF component)
   - `totalPages` (set on PDF load)
   - `activeTab` (from context via `usePreviewPanel`)
   - `isModalOpen` (local state)
2. Tab rename: `visual` -> `text` in PreviewPanelContext
3. Empty state when no document selected
4. Download handler (create signed URL download)
5. Compose components:
   ```tsx
   <div className="flex flex-col h-full">
     <PreviewContainer ... />
     <PreviewMetadata ... />
     <ExpandModal ... />
   </div>
   ```

**Test:** Integration test with real data flow.

---

## Phase 5: Context Updates (Tasks 12-13)

### Task 12: Update PreviewPanelContext tab naming

**Goal:** Rename tab values from `pdf | visual` to `pdf | text`.

**File:** `frontend/components/documents/preview-panel-context.tsx`

**Implementation:**
1. Change type from `'pdf' | 'visual'` to `'pdf' | 'text'`
2. Update DEFAULT_STATE
3. Migration: Map old 'visual' to 'text' when reading from localStorage

**Test:** Tab switching works, localStorage persists correctly.

---

### Task 13: Add localStorage persistence for selected document

**Goal:** Persist `selectedDocId` so last-viewed document shows on refresh.

**File:** `frontend/components/documents/selected-document-context.tsx`

**Implementation:**
1. Add STORAGE_KEY constant: `'stackdocs-last-document'`
2. On mount: Read from localStorage, set as initial state
3. On selectedDocId change: Write to localStorage
4. Handle edge case: If stored document doesn't exist in fetched data, clear gracefully

**Test:** Select document, refresh page, same document selected.

---

## Phase 6: Integration (Tasks 14-16)

### Task 14: Update documents layout to use new PreviewPanel

**Goal:** Swap old PreviewPanel for new one in documents layout.

**File:** `frontend/app/(app)/documents/layout.tsx`

**Implementation:**
1. Import from new location
2. Pass additional props (filename, fileSize, etc. from context)
3. Remove old PreviewPanel import

**Test:** Documents page works with new preview panel.

---

### Task 15: Populate metadata in document data fetching

**Goal:** Set pageCount and fileSize when document is selected.

**Files:**
- Where document data is fetched (likely hooks or page components)
- May need to update Supabase query to include these fields

**Implementation:**
1. Find where `setDocumentMetadata` is called
2. Add pageCount and fileSize from document record
3. If not stored in DB, consider:
   - pageCount from PDF load callback
   - fileSize from documents table (should already exist)

**Test:** Metadata displays correctly below preview.

---

### Task 16: Update barrel export and clean up old files

**Goal:** Final integration and cleanup.

**Implementation:**
1. Update `preview-panel/index.tsx` to export main component
2. Delete or mark deprecated:
   - `frontend/components/documents/preview-panel.tsx` (old)
   - `frontend/components/documents/visual-preview.tsx` (moved)
   - Consider keeping `pdf-viewer.tsx` if used elsewhere, or deprecate
3. Update any remaining imports

**Test:** Full app works, no broken imports, build passes.

---

## Phase 7: Polish (Tasks 17-19)

### Task 17: Add keyboard navigation

**Goal:** Arrow keys navigate PDF pages in preview and modal.

**Implementation:**
1. Add `useEffect` with keyboard listener in preview-container
2. Only active when preview is focused/hovered
3. Left arrow: previous page
4. Right arrow: next page
5. Same for expand-modal (Dialog handles focus)

**Test:** Focus preview, use arrow keys to navigate.

---

### Task 18: Dark theme gradient adjustment

**Goal:** Ensure gradient overlays work in dark mode.

**Implementation:**
1. Test current gradients in dark mode
2. If needed, adjust: `from-black/60` might need `dark:from-background/80`
3. Ensure button text remains visible in both themes

**Test:** Toggle theme, verify controls visible on both.

---

### Task 19: Final review and edge cases

**Goal:** Test all edge cases and polish.

**Checklist:**
- [ ] Empty state displays correctly
- [ ] Loading state while PDF fetches
- [ ] Non-PDF documents (images) handled
- [ ] Single-page PDF hides page navigation
- [ ] Modal syncs page with preview
- [ ] localStorage persistence works
- [ ] Deleted document fallback works
- [ ] ResizeObserver scaling on panel resize
- [ ] Accessibility: focus states, ARIA labels
- [ ] Build passes: `npm run build`

---

## Task Dependency Graph

```
Phase 1 (Foundation)
  Task 1 ─────┬─────> Phase 2
  Task 2 ─────┤
  Task 3 ─────┘

Phase 2 (Leaf Components)
  Task 4 (metadata) ──────┐
  Task 5 (page-nav) ──────┼──> Phase 3
  Task 6 (controls) ──────┤
  Task 7 (text-content) ──┘

Phase 3 (Container Components)
  Task 8 (pdf-content) ───┐
  Task 9 (container) ─────┼──> Phase 4
  Task 10 (modal) ────────┘

Phase 4 (Main Component)
  Task 11 (preview-panel) ──> Phase 5

Phase 5 (Context Updates)
  Task 12 (tab naming) ───┬──> Phase 6
  Task 13 (persistence) ──┘

Phase 6 (Integration)
  Task 14 (layout) ───────┐
  Task 15 (metadata) ─────┼──> Phase 7
  Task 16 (cleanup) ──────┘

Phase 7 (Polish)
  Task 17 (keyboard) ─────┐
  Task 18 (dark mode) ────┼──> Done
  Task 19 (final review) ─┘
```

---

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Foundation | 3 | 30 min |
| Phase 2: Leaf Components | 4 | 2 hours |
| Phase 3: Container Components | 3 | 2.5 hours |
| Phase 4: Main Component | 1 | 1.5 hours |
| Phase 5: Context Updates | 2 | 45 min |
| Phase 6: Integration | 3 | 1.5 hours |
| Phase 7: Polish | 3 | 1.5 hours |
| **Total** | **19** | **~10 hours** |

---

## Review Checkpoints

After each phase, verify:
1. `npm run build` passes
2. No TypeScript errors
3. App runs without console errors
4. Existing functionality not broken

Major checkpoints for user review:
- **After Phase 3:** Show preview container with hover controls (not integrated)
- **After Phase 6:** Full integration, all features working
- **After Phase 7:** Polished, ready for production
