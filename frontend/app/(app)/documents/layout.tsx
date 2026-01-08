'use client'

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { PreviewPanel } from '@/components/preview-panel'
import { usePreviewPanel } from '@/components/preview-panel/preview-panel-context'
import { useSelectedDocument } from '@/components/documents/selected-document-context'

// Read panel sizes from localStorage synchronously to prevent flash on page load
// The library stores sizes in format: { "panel-id": { layout: [60, 40] } }
const PANEL_STORAGE_KEY = 'react-resizable-panels:stackdocs-preview-panel'
const DEFAULT_SIZES = { main: 60, preview: 40 }

function getInitialPanelSizes(): { main: number; preview: number } {
  if (typeof window === 'undefined') return DEFAULT_SIZES
  try {
    const saved = localStorage.getItem(PANEL_STORAGE_KEY)
    if (saved) {
      const state = JSON.parse(saved)
      const panelKey = Object.keys(state)[0]
      if (panelKey && state[panelKey]?.layout) {
        const layout = state[panelKey].layout as number[]
        if (layout.length === 2) {
          return { main: layout[0], preview: layout[1] }
        }
      }
    }
  } catch {
    // Invalid JSON, use defaults
  }
  return DEFAULT_SIZES
}

// Read once at module load time (before any component renders)
const initialSizes = getInitialPanelSizes()

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { panelRef, isCollapsed, setIsCollapsed } = usePreviewPanel()
  const { signedUrl, ocrText, mimeType, selectedDocId, signedUrlDocId, filename, fileSize, pageCount, extractedFields } = useSelectedDocument()

  const isUrlStale = selectedDocId !== null && selectedDocId !== signedUrlDocId
  const effectivePdfUrl = isUrlStale ? null : signedUrl
  const effectiveOcrText = isUrlStale ? null : ocrText

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 overflow-hidden"
        autoSaveId="stackdocs-preview-panel"
      >
        <ResizablePanel defaultSize={initialSizes.main} minSize={40} className="overflow-hidden min-w-0 flex flex-col">
          {children}
        </ResizablePanel>

        <ResizableHandle disabled={isCollapsed} />

        <ResizablePanel
          ref={panelRef}
          defaultSize={initialSizes.preview}
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
              content={{ pdfUrl: effectivePdfUrl, ocrText: effectiveOcrText, isLoading: isUrlStale }}
              metadata={{ mimeType, filename, fileSize, pageCount, extractedFields }}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
