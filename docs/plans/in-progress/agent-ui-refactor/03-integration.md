# Agent UI Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the new agent components into the app layout (app-wide) and header.

**Architecture:** AgentContainer lives in root layout with self-managed visibility. It shows on `/documents` and `/stacks` routes. UploadButton in header triggers agent popup.

**Tech Stack:** Next.js App Router, Zustand, shadcn/ui

---

## Task 3.1: Add AgentContainer to Root Layout

**Files:**
- Modify: `frontend/app/(app)/layout.tsx`
- Modify: `frontend/app/(app)/documents/layout.tsx` (remove old aiChatBarContent)
- Modify: `frontend/components/documents/selected-document-context.tsx` (remove aiChatBarContent)
- Modify: `frontend/components/agent/agent-container.tsx` (add visibility logic)

**Step 1: Update AgentContainer with self-managed visibility**

The AgentContainer checks the current route and only renders on supported pages:

```typescript
// frontend/components/agent/agent-container.tsx
'use client'

import { usePathname } from 'next/navigation'
import { AgentBar } from './agent-bar'
import { AgentPopup } from './agent-popup'
import { cn } from '@/lib/utils'

const AGENT_ROUTES = ['/documents', '/stacks']

export function AgentContainer({ className }: { className?: string }) {
  const pathname = usePathname()

  // Only show on supported routes
  const shouldShow = AGENT_ROUTES.some(route => pathname.startsWith(route))

  if (!shouldShow) return null

  return (
    <div className={cn('relative w-full max-w-[640px] mx-auto', className)}>
      <AgentPopup />
      <AgentBar />
    </div>
  )
}
```

**Step 2: Add AgentContainer to root layout**

```typescript
// frontend/app/(app)/layout.tsx
import { cookies } from "next/headers";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar-server";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PreviewPanelProvider } from "@/components/documents/preview-panel-context";
import { SelectedDocumentProvider } from "@/components/documents/selected-document-context";
import { DocumentsFilterProvider } from "@/components/documents/documents-filter-context";
import { DocumentDetailFilterProvider } from "@/components/documents/document-detail-filter-context";
import { StacksFilterProvider } from "@/components/stacks/stacks-filter-context";
import { StackDetailFilterProvider } from "@/components/stacks/stack-detail-filter-context";
import { AgentContainer } from "@/components/agent";

export default async function AppLayout({
  children,
  header,
  subbar,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  subbar: React.ReactNode;
}) {
  // Sidebar state persistence
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh overflow-hidden"
    >
      <AppSidebar />
      <SidebarInset>
        <PreviewPanelProvider>
          <SelectedDocumentProvider>
            <DocumentsFilterProvider>
              <DocumentDetailFilterProvider>
                <StacksFilterProvider>
                  <StackDetailFilterProvider>
                    <header className="flex h-12 shrink-0 items-center gap-2 px-4 border-b">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarTrigger className="ml-2.5" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Toggle sidebar
                        </TooltipContent>
                      </Tooltip>
                      <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                      />
                      {header}
                    </header>
                    {/* SubBar slot - rendered between header and content */}
                    {subbar}
                    <div className="flex flex-1 flex-col min-h-0">{children}</div>

                    {/* Agent Container - app-wide, self-manages visibility */}
                    <AgentContainer className="p-4" />
                  </StackDetailFilterProvider>
                </StacksFilterProvider>
              </DocumentDetailFilterProvider>
            </DocumentsFilterProvider>
          </SelectedDocumentProvider>
        </PreviewPanelProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

**Step 3: Remove aiChatBarContent from documents layout**

Update documents layout to remove the old chat bar slot:

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

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { panelRef, setIsCollapsed, panelWidth, setPanelWidth } = usePreviewPanel()
  const { signedUrl, ocrText, mimeType } = useSelectedDocument()

  const mainPanelSize = 100 - panelWidth

  const handleLayoutChange = (sizes: number[]) => {
    if (sizes[1] !== undefined) {
      setPanelWidth(sizes[1])
    }
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="flex-1 min-h-0 overflow-hidden"
      onLayout={handleLayoutChange}
    >
      {/* Main content panel - pages render here */}
      <ResizablePanel
        defaultSize={mainPanelSize}
        minSize={40}
        className="overflow-hidden min-w-0 flex flex-col"
      >
        {children}
      </ResizablePanel>

      <ResizableHandle />

      {/* Preview panel - persists across navigation */}
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
  )
}
```

**Step 4: Clean up SelectedDocumentContext**

Remove `aiChatBarContent` and `setAiChatBarContent` from the context - they're no longer needed.

```typescript
// In frontend/components/documents/selected-document-context.tsx
// Remove these from the interface and implementation:
// - aiChatBarContent: ReactNode
// - setAiChatBarContent: (content: ReactNode) => void
```

**Step 5: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Test locally**

Run: `npm run dev`
- Navigate to `/documents` - AgentBar should appear at bottom
- Navigate to `/stacks` - AgentBar should appear at bottom
- Navigate to `/settings` or other pages - AgentBar should NOT appear
- Focus on bar reveals action buttons

**Step 7: Commit**

```bash
git add frontend/app/(app)/layout.tsx frontend/app/(app)/documents/layout.tsx frontend/components/documents/selected-document-context.tsx frontend/components/agent/agent-container.tsx
git commit -m "feat(agent): add AgentContainer to root layout with self-managed visibility"
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
14. **AgentBar only visible on /documents and /stacks routes**
15. **AgentBar hidden on other routes (settings, etc.)**

**Step 2: Fix any issues found**

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix(agent): address issues found during e2e testing"
```
