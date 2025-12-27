'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { useExtractionRealtime, ExtractionUpdate } from '@/hooks/use-extraction-realtime'
import { ExtractedDataTable } from './extracted-data-table'
import { PreviewPanel } from './preview-panel'
import { AiChatBar } from './ai-chat-bar'
import { usePreviewPanel } from './preview-panel-context'
import { useSelectedDocument } from './selected-document-context'
import { SubBar } from './sub-bar'
import { FilterButton } from './filter-button'
import { DocumentDetailActions } from './document-detail-actions'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { cn } from '@/lib/utils'
import type { DocumentWithExtraction } from '@/types/documents'

interface DocumentDetailClientProps {
  initialDocument: DocumentWithExtraction
  initialSignedUrl: string | null  // Renamed from signedUrl to avoid context collision
}

export function DocumentDetailClient({
  initialDocument,
  initialSignedUrl,
}: DocumentDetailClientProps) {
  const [document, setDocument] = useState(initialDocument)
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set())
  const [fieldSearch, setFieldSearch] = useState('')

  // Shared state from contexts
  const { panelRef, isCollapsed, setIsCollapsed, panelWidth, setPanelWidth } = usePreviewPanel()
  const { setSelectedDocId, setSignedUrl, signedUrl } = useSelectedDocument()

  // Panel width from context
  const mainPanelSize = 100 - panelWidth

  // Sync selected document to context on mount
  useEffect(() => {
    setSelectedDocId(initialDocument.id)
    if (initialSignedUrl) {
      setSignedUrl(initialSignedUrl)
    }
  }, [initialDocument.id, initialSignedUrl, setSelectedDocId, setSignedUrl])

  // Update panel width in context when resized
  const handleLayoutChange = useCallback((sizes: number[]) => {
    if (sizes[1] !== undefined) {
      setPanelWidth(sizes[1])
    }
  }, [setPanelWidth])

  // Fix #3: Use ref to access current document state without recreating callback
  const documentRef = useRef(document)
  useEffect(() => {
    documentRef.current = document
  }, [document])

  const handleExtractionUpdate = useCallback(
    (update: ExtractionUpdate) => {
      // Find which fields changed - use ref to avoid stale closure
      const newChangedFields = new Set<string>()
      const oldFields = documentRef.current.extracted_fields || {}
      const newFields = update.extracted_fields || {}

      for (const key of Object.keys(newFields)) {
        if (JSON.stringify(oldFields[key]) !== JSON.stringify(newFields[key])) {
          newChangedFields.add(key)
        }
      }

      // Update document state
      setDocument((prev) => ({
        ...prev,
        extracted_fields: update.extracted_fields,
        confidence_scores: update.confidence_scores,
      }))

      // Set changed fields for highlight animation
      setChangedFields(newChangedFields)
    },
    [] // Stable callback - no dependencies since we use ref
  )

  // Clear changed fields after animation (1.5s)
  useEffect(() => {
    if (changedFields.size > 0) {
      const timer = setTimeout(() => {
        setChangedFields(new Set())
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [changedFields])

  useExtractionRealtime({
    documentId: document.id,
    onUpdate: handleExtractionUpdate,
  })

  // Use context signedUrl (which was set from initialSignedUrl on mount)
  const previewUrl = signedUrl ?? initialSignedUrl

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Sub-bar */}
      <SubBar
        left={
          <>
            <FilterButton />
            <ExpandableSearch
              value={fieldSearch}
              onChange={setFieldSearch}
              placeholder="Search fields..."
            />
          </>
        }
        right={
          <DocumentDetailActions assignedStacks={document.stacks ?? []} />
        }
      />

      {/* Main content - resizable layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0"
        onLayout={handleLayoutChange}
      >
        {/* Left: Extracted Data - main content, expands */}
        <ResizablePanel
          defaultSize={mainPanelSize}
          minSize={30}
          className="overflow-auto"
        >
          <div className="h-full">
            <ExtractedDataTable
              fields={document.extracted_fields}
              confidenceScores={document.confidence_scores}
              changedFields={changedFields}
              searchFilter={fieldSearch}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Preview - collapsible sidebar */}
        <ResizablePanel
          ref={panelRef}
          defaultSize={panelWidth}
          minSize={30}
          maxSize={50}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className="overflow-auto"
        >
          <div className="h-full">
            <PreviewPanel
              pdfUrl={previewUrl}
              ocrText={document.ocr_raw_text}
              mimeType={document.mime_type}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* AI Chat Bar - floating at bottom, outside panels */}
      <div className={cn("shrink-0 px-4 py-4", !isCollapsed && "border-t")}>
        <div className="mx-auto max-w-3xl">
          <AiChatBar documentId={document.id} />
        </div>
      </div>
    </div>
  )
}
