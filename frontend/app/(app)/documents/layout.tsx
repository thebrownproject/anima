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
  const { panelRef, isCollapsed, setIsCollapsed, panelWidth, setPanelWidth } = usePreviewPanel()
  const { signedUrl, ocrText, mimeType, aiChatBarContent, selectedDocId, signedUrlDocId } = useSelectedDocument()

  // Show loading when URL is stale (document changed but URL not yet fetched)
  const isUrlStale = selectedDocId !== null && selectedDocId !== signedUrlDocId
  const effectivePdfUrl = isUrlStale ? null : signedUrl
  const effectiveOcrText = isUrlStale ? null : ocrText

  const mainPanelSize = 100 - panelWidth

  const handleLayoutChange = (sizes: number[]) => {
    if (sizes[1] !== undefined) {
      setPanelWidth(sizes[1])
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* SubBar is now rendered by @subbar parallel route in app layout */}

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

        <ResizableHandle
          className={isCollapsed ? "bg-transparent" : ""}
          disabled={isCollapsed}
        />

        {/* Preview panel - persists across navigation */}
        <ResizablePanel
          ref={panelRef}
          defaultSize={panelWidth}
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
              mimeType={mimeType}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* AI Chat Bar - rendered from context, full width below panels */}
      {aiChatBarContent}
    </div>
  )
}
