# Agent UI Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the new agent components into the Documents layout and header.

**Architecture:** AgentContainer replaces AiChatBar in documents layout. UploadButton in header triggers agent popup.

**Tech Stack:** Next.js App Router, Zustand, shadcn/ui

---

## Task 3.1: Replace AiChatBar in Documents Layout

**Files:**
- Modify: `frontend/app/(app)/documents/layout.tsx`
- Modify: `frontend/components/documents/selected-document-context.tsx`

**Step 1: Update documents layout to use AgentContainer**

```typescript
// frontend/app/(app)/documents/layout.tsx
'use client'

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { PreviewPanel } from '@/components/documents/preview-panel'
import { usePreviewPanel } from '@/components/documents/preview-panel-context'
import { useSelectedDocument } from '@/components/documents/selected-document-context'
import { AgentContainer } from '@/components/agent'

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { panelRef, setIsCollapsed, panelWidth, setPanelWidth } = usePreviewPanel()
  const { signedUrl, ocrText, mimeType, showAgentBar } = useSelectedDocument()

  const mainPanelSize = 100 - panelWidth

  const handleLayoutChange = (sizes: number[]) => {
    if (sizes[1] !== undefined) {
      setPanelWidth(sizes[1])
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 overflow-hidden"
        onLayout={handleLayoutChange}
      >
        {/* Main content panel */}
        <ResizablePanel
          defaultSize={mainPanelSize}
          minSize={40}
          className="overflow-hidden min-w-0 flex flex-col"
        >
          {children}
        </ResizablePanel>

        <ResizableHandle />

        {/* Preview panel */}
        <ResizablePanel
          ref={panelRef}
          defaultSize={panelWidth}
          minSize={30}
          maxSize={50}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className="overflow-hidden"
        >
          <div className="h-full">
            <PreviewPanel
              pdfUrl={signedUrl}
              ocrText={ocrText}
              mimeType={mimeType}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Agent Container - full width below panels */}
      {showAgentBar && (
        <div className="p-4">
          <AgentContainer />
        </div>
      )}
    </div>
  )
}
```

**Step 2: Update selected-document-context to expose showAgentBar flag**

Read the current context file and add a `showAgentBar` boolean instead of `aiChatBarContent` ReactNode:

```typescript
// Add to SelectedDocumentContext interface:
showAgentBar: boolean

// Replace aiChatBarContent with:
showAgentBar: !!documentId  // Show on detail pages
```

**Step 3: Verify compiles**

Run: `npx tsc --noEmit frontend/app/(app)/documents/layout.tsx`
Expected: No errors

**Step 4: Test locally**

Run: `npm run dev`
Navigate to `/documents` and verify:
- AgentBar appears at bottom
- Focus reveals action buttons
- Clicking Upload opens popup with dropzone

**Step 5: Commit**

```bash
git add frontend/app/(app)/documents/layout.tsx frontend/components/documents/selected-document-context.tsx
git commit -m "feat(agent): integrate AgentContainer into documents layout"
```

---

## Task 3.2: Add Upload Button to Header Actions

**Files:**
- Modify: `frontend/app/(app)/@header/documents/page.tsx`
- Create: `frontend/components/agent/upload-button.tsx`

**Step 1: Create UploadButton component**

```typescript
// frontend/components/agent/upload-button.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useAgentStore, type UploadFlowData } from './stores/agent-store'

const initialUploadData: UploadFlowData = {
  file: null,
  documentId: null,
  documentName: '',
  extractionMethod: 'auto',
  customFields: [],
  uploadStatus: 'idle',
  uploadError: null,
  extractionError: null,
}

export function UploadButton() {
  const openFlow = useAgentStore((s) => s.openFlow)

  const handleClick = () => {
    openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })
  }

  return (
    <Button size="sm" onClick={handleClick}>
      <Icons.Upload className="size-4 mr-1.5" />
      Upload
    </Button>
  )
}
```

**Step 2: Add to barrel export**

```typescript
// frontend/components/agent/index.ts
export { UploadButton } from './upload-button'
```

**Step 3: Update documents list header**

```typescript
// frontend/app/(app)/@header/documents/page.tsx
import { PageHeader } from '@/components/layout/page-header'
import { PreviewToggle } from '@/components/documents/preview-toggle'
import { UploadButton } from '@/components/agent/upload-button'

export default function DocumentsHeaderSlot() {
  return (
    <PageHeader
      actions={
        <div className="flex items-center gap-2">
          <UploadButton />
          <PreviewToggle />
        </div>
      }
    />
  )
}
```

**Step 4: Verify compiles**

Run: `npx tsc --noEmit frontend/app/(app)/@header/documents/page.tsx frontend/components/agent/upload-button.tsx`
Expected: No errors

**Step 5: Test locally**

Run: `npm run dev`
- Click Upload button in header
- Verify popup opens with dropzone
- Complete full upload flow

**Step 6: Commit**

```bash
git add frontend/app/(app)/@header/documents/page.tsx frontend/components/agent/upload-button.tsx frontend/components/agent/index.ts
git commit -m "feat(agent): add Upload button to documents header"
```

---

## Task 3.3: End-to-End Flow Testing

**Files:** None (manual testing)

**Step 1: Test upload flow end-to-end**

Run: `npm run dev`

Test cases:
1. Upload button in header opens popup
2. Dropzone accepts PDF/JPG/PNG files
3. File validation rejects invalid types/sizes
4. Document rename field works
5. Auto Extract → Extract triggers SSE streaming
6. Custom Fields → Next → Fields step works
7. Popup collapses during extraction
8. Bar shows dynamic status during extraction
9. Complete step shows success + actions
10. View Document navigates correctly
11. Upload Another resets flow
12. Close mid-flow shows confirmation
13. Focus on bar reveals action buttons
14. Actions change based on route

**Step 2: Fix any issues found**

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix(agent): address issues found during e2e testing"
```
