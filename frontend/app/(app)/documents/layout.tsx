'use client'

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { PreviewPanel } from '@/components/preview-panel'
import { usePreviewPanel } from '@/components/preview-panel/preview-panel-context'
import { useSelectedDocument } from '@/components/documents/selected-document-context'

// Default panel sizes (only used when no saved state exists)
const DEFAULT_MAIN_SIZE = 60
const DEFAULT_PREVIEW_SIZE = 40

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { panelRef, isCollapsed, setIsCollapsed } = usePreviewPanel()
  const { signedUrl, ocrText, mimeType, selectedDocId, signedUrlDocId, filename, fileSize, pageCount, extractedFields } = useSelectedDocument()

  // Show loading when URL is stale (document changed but URL not yet fetched)
  const isUrlStale = selectedDocId !== null && selectedDocId !== signedUrlDocId
  const effectivePdfUrl = isUrlStale ? null : signedUrl
  const effectiveOcrText = isUrlStale ? null : ocrText

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* SubBar is now rendered by @subbar parallel route in app layout */}

      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 overflow-hidden"
        autoSaveId="stackdocs-preview-panel"
      >
        {/* Main content panel - pages render here */}
        <ResizablePanel
          defaultSize={DEFAULT_MAIN_SIZE}
          minSize={40}
          className="overflow-hidden min-w-0 flex flex-col"
        >
          {children}
        </ResizablePanel>

        <ResizableHandle
          className={isCollapsed ? "bg-transparent" : ""}
          disabled={isCollapsed}
        />

        {/* Preview panel - persists across navigation */}
        <ResizablePanel
          ref={panelRef}
          defaultSize={DEFAULT_PREVIEW_SIZE}
          minSize={30}
          maxSize={60}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className="overflow-hidden min-w-0"
        >
          <div className="h-full">
            <PreviewPanel
              pdfUrl={effectivePdfUrl}
              ocrText={effectiveOcrText}
              isLoading={isUrlStale}
              mimeType={mimeType}
              filename={filename}
              fileSize={fileSize}
              pageCount={pageCount}
              extractedFields={extractedFields}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
