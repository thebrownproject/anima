# Preview Panel Code Review

**Date:** 2026-01-08
**Scope:** All components in `frontend/components/preview-panel/` and integration in `app/(app)/documents/layout.tsx`

---

## Executive Summary

| Category | Count |
|----------|-------|
| Critical Issues | 1 |
| Important Improvements | 8 |
| Minor Cleanups | 14 |

**Critical:** Missing `"use client"` directive in text-content.tsx (SSR risk)

**Most impactful improvements:**
1. Extract shared constant for magic number `299px` (duplicated in pdf-content.tsx and text-content.tsx)
2. Reduce prop drilling in PreviewContainer (14 props)
3. Extract duplicate keyboard navigation to shared hook
4. Simplify `contentReadyForUrl` state tracking (duplicated with PdfContent's `renderedUrl`)

---

## Core Components

### preview-panel.tsx

| Issue | Type | Line | Description |
|-------|------|------|-------------|
| Redundant state tracking | Important | 41 | `contentReadyForUrl` duplicates tracking in PdfContent's `renderedUrl` - two sources of truth |
| Trivial callback wrappers | Minor | 60-70 | `handlePdfLoad`, `handleContentReady`, `handlePageChange` are simple forwarding wrappers |
| Unused `pageCount` prop | Minor | 14 | Only used as fallback for `totalPages` initialization, overwritten by `handlePdfLoad` |
| Complex derived state | Minor | 48-50 | `isContentReady` branching logic could be clearer |

**Suggested fixes:**
- Consider boolean `isPdfReady` that resets on URL change instead of URL comparison
- Inline trivial callbacks or pass state setters directly
- Re-evaluate `pageCount` prop necessity

### preview-container.tsx

| Issue | Type | Line | Description |
|-------|------|------|-------------|
| Prop drilling | Important | 20-36 | 14 props passed through - many could be derived or provided via context |
| Global keyboard listener | Minor | 70-73 | Page navigation triggers even when focus is elsewhere in app |
| `effectiveTab` vs `activeTab` confusion | Minor | 76 | Visual tab differs from context state when PDF unavailable |

**Suggested fixes:**
- Create `PreviewContentContext` to reduce prop drilling for PDF state
- Consider scoping keyboard navigation to focused panel
- Document `effectiveTab` vs `activeTab` distinction

### preview-panel-context.tsx

| Issue | Type | Line | Description |
|-------|------|------|-------------|
| Unnecessary useMemo dependencies | Minor | 66 | `setIsCollapsed` and `panelRef` are stable refs, don't need to be dependencies |
| Migration code | Minor | 36-40 | Old 'visual' to 'text' tab migration - add removal date comment |

---

## Content Components

### pdf-content.tsx

| Issue | Type | Line | Description |
|-------|------|------|-------------|
| Redundant null check | Minor | 129 | `if (url) onContentReady?.(url)` - already inside `{url && ...}` block |
| Error state persists across URLs | Important | 73-82 | Error doesn't reset when URL changes - stale error may show |
| Magic number 299px | Important | 88 | Duplicated with text-content.tsx, no shared constant |
| Trivial wrapper function | Minor | 57-59 | `handleLoadSuccess` just forwards to `onLoadSuccess` |

**Suggested fixes:**
```tsx
// Reset error on URL change
useEffect(() => {
  setError(null);
}, [url]);
```

### text-content.tsx

| Issue | Type | Line | Description |
|-------|------|------|-------------|
| Missing "use client" | Critical | - | No client directive but uses react-markdown (client component) |
| Magic number 299px | Important | 27 | Duplicated with pdf-content.tsx |
| No error handling | Minor | - | Markdown rendering errors would crash - consider error boundary |

**Suggested fixes:**
- Add `"use client";` at top of file
- Extract shared constant:
```tsx
// preview-panel/constants.ts
export const LOADING_MIN_HEIGHT = "min-h-[calc(100vh-299px)]";
```

---

## Supporting Components

### expand-modal.tsx

| Issue | Type | Line | Description |
|-------|------|------|-------------|
| Duplicate keyboard navigation | Important | 51-68 | Identical to preview-container.tsx lines 56-73 |
| Missing `onContentReady` prop | Minor | 84-88 | PdfContent in modal doesn't receive callback (intentional?) |
| Inconsistent download logic | Minor | 109-114 | Uses different check than main panel's `canDownload` prop |

### page-navigation.tsx

✅ **No issues found** - Well-structured, clean variant pattern

### preview-controls.tsx

✅ **No issues found** - Clean, single responsibility

### preview-metadata.tsx

✅ **No issues found** - Pure presentation logic

### index.tsx (barrel)

| Issue | Type | Line | Description |
|-------|------|------|-------------|
| Exports SSR-risky component | Important | 5-11 | `PdfContent` exported directly but must be dynamically imported |

**Suggested fix:** Remove `PdfContent` from exports or add warning comment

---

## Integration (layout.tsx)

| Issue | Type | Line | Description |
|-------|------|------|-------------|
| Data transformation in layout | Minor | 25-27 | `isUrlStale` logic could be in context or hook |
| Many props to PreviewPanel | Minor | 65-74 | 8 props - consider grouping into objects |
| No memoization | Minor | 25-27 | `isUrlStale`, `effectivePdfUrl`, `effectiveOcrText` recalculated every render |

---

## Cross-Cutting Concerns

### 1. Duplicate Keyboard Navigation
**Files:** expand-modal.tsx, preview-container.tsx

Extract to shared hook:
```tsx
// hooks/use-page-keyboard-nav.ts
export function usePageKeyboardNav(
  activeTab: 'pdf' | 'text',
  currentPage: number,
  totalPages: number,
  onPageChange: (page: number) => void
) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (activeTab !== 'pdf' || totalPages <= 1) return
    if (e.key === 'ArrowLeft' && currentPage > 1) {
      onPageChange(currentPage - 1)
    } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }, [activeTab, currentPage, totalPages, onPageChange])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
```

### 2. Magic Number Duplication
**Files:** pdf-content.tsx, text-content.tsx

Both have `min-h-[calc(100vh-299px)]` with "keep in sync" comments. Extract to shared constant.

### 3. Dynamic Import Pattern Repeated
**Files:** expand-modal.tsx, preview-container.tsx

Identical dynamic import for PdfContent. Consider:
- Pre-wrapped dynamic export
- Or accept duplication as necessary evil for SSR

### 4. Inconsistent Loading State Patterns
- **pdf-content:** Uses `showLoading` derived from `renderedUrl !== url`
- **text-content:** Uses `isLoading` prop from parent

Intentional but could benefit from documentation explaining why.

---

## Recommended Cleanup Order

### Phase 1: Critical + Quick Wins
1. ✅ Add `"use client"` to text-content.tsx
2. ✅ Extract `LOADING_MIN_HEIGHT` constant
3. ✅ Remove redundant null check in pdf-content.tsx line 129
4. ✅ Add error reset effect in pdf-content.tsx

### Phase 2: Refactoring
5. Extract `usePageKeyboardNav` hook
6. Remove `PdfContent` from barrel exports (or add warning)
7. Remove trivial callback wrappers in preview-panel.tsx

### Phase 3: Architecture (Optional)
8. Create `PreviewContentContext` to reduce prop drilling
9. Simplify `contentReadyForUrl` tracking
10. Group related props in layout.tsx

---

## Files Modified Summary

| File | Issues |
|------|--------|
| preview-panel.tsx | 4 |
| preview-container.tsx | 3 |
| preview-panel-context.tsx | 2 |
| pdf-content.tsx | 4 |
| text-content.tsx | 3 |
| expand-modal.tsx | 3 |
| index.tsx | 1 |
| layout.tsx | 3 |
