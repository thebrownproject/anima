'use client'

import { useState, useEffect } from 'react'
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

// Read saved panel layout from localStorage synchronously to avoid flash
function getInitialPanelSizes(): [number, number] {
  if (typeof window === 'undefined') return [DEFAULT_MAIN_SIZE, DEFAULT_PREVIEW_SIZE]

  try {
    const saved = localStorage.getItem('react-resizable-panels:stackdocs-preview-panel')
    if (saved) {
      const state = JSON.parse(saved)
      // The library uses a panel key based on panel structure - get the first (only) layout
      const panelKey = Object.keys(state)[0]
      if (panelKey && state[panelKey]?.layout) {
        const layout = state[panelKey].layout as number[]
        if (layout.length === 2) {
          return [layout[0], layout[1]]
        }
      }
    }
  } catch {
    // Invalid JSON, use defaults
  }

  return [DEFAULT_MAIN_SIZE, DEFAULT_PREVIEW_SIZE]
}

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Wait for client mount to avoid SSR flash
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Initialize panel sizes from localStorage (runs on client only)
  const [[mainSize, previewSize]] = useState(getInitialPanelSizes)

  const { panelRef, isCollapsed, setIsCollapsed } = usePreviewPanel()
  const { signedUrl, ocrText, mimeType, selectedDocId, signedUrlDocId, filename, fileSize, pageCount, extractedFields } = useSelectedDocument()

  // Show loading when URL is stale (document changed but URL not yet fetched)
  const isUrlStale = selectedDocId !== null && selectedDocId !== signedUrlDocId
  const effectivePdfUrl = isUrlStale ? null : signedUrl
  const effectiveOcrText = isUrlStale ? null : ocrText

  // Before mount, render just children to avoid SSR flash of wrong panel sizes
  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    )
  }

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
          defaultSize={mainSize}
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
          defaultSize={previewSize}
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
