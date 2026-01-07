# Preview Panel Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the document preview panel with Apple Finder-inspired aesthetics, hover-reveal controls, metadata display, expand modal, and localStorage persistence.

**Architecture:** Refactor existing `preview-panel.tsx` into modular components under `preview-panel/` folder. Build leaf components first (metadata, page-nav, controls), then container components, then integrate. TDD approach with frequent commits.

**Tech Stack:** React, TypeScript, shadcn/ui (Tabs, Dialog, Button), Tailwind CSS, react-pdf, localStorage

---

## Plan Overview

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| [Phase 1](./phase-1-foundation.md) | Foundation + Context updates | 1-4 | Pending |
| [Phase 2](./phase-2-components.md) | Leaf + Container components | 5-12 | Pending |
| [Phase 3](./phase-3-integration.md) | Integration + Cleanup + Polish | 13-18 | Pending |

**Total Effort:** ~2-3 days

---

## Architecture Summary

### File Structure (After)

```
frontend/components/documents/preview-panel/
├── index.tsx                 # Barrel export
├── preview-panel.tsx         # Main orchestrator component
├── preview-container.tsx     # Rounded container with hover-reveal logic
├── preview-controls.tsx      # Top bar: tabs + expand + download buttons
├── preview-metadata.tsx      # Filename + details below preview
├── page-navigation.tsx       # Bottom bar: prev/page/next (reusable)
├── pdf-content.tsx           # PDF rendering (wraps react-pdf)
├── text-content.tsx          # Text/markdown rendering
└── expand-modal.tsx          # Full-size dialog
```

### Component Hierarchy

```
PreviewPanel
├── PreviewContainer
│   ├── PreviewControls (tabs, expand, download)
│   ├── PdfContent / TextContent
│   └── PageNavigation (PDF only, hover)
├── PreviewMetadata
└── ExpandModal
    ├── PdfContent / TextContent
    └── PageNavigation
```

---

## Success Criteria

From design doc:

- [ ] Clean visual design with rounded preview container
- [ ] Controls inside preview with hover-reveal behavior
- [ ] PDF/Text tab switching inside preview
- [ ] Page navigation for multi-page PDFs (hover, bottom)
- [ ] Metadata display below preview (filename, type, size, pages, fields)
- [ ] Expand modal for full-size viewing
- [ ] localStorage persistence for last-viewed document
- [ ] Keyboard navigation (arrow keys for pages)
- [ ] Responsive to ResizablePanel width changes

---

## Related Documents

- Design: `./2026-01-07-preview-panel-design.md`
- Current implementation: `frontend/components/documents/preview-panel.tsx`
- Context providers: `frontend/components/documents/preview-panel-context.tsx`, `selected-document-context.tsx`
