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
import { SubBar } from './sub-bar'
import { FilterButton } from './filter-button'
import { DocumentDetailActions } from './document-detail-actions'
import { SelectionActions } from './selection-actions'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import type { DocumentWithExtraction } from '@/types/documents'

const LAYOUT_STORAGE_KEY = 'stackdocs-document-layout'

interface DocumentDetailClientProps {
  initialDocument: DocumentWithExtraction
  signedUrl: string | null
}

export function DocumentDetailClient({
  initialDocument,
  signedUrl,
}: DocumentDetailClientProps) {
  const [document, setDocument] = useState(initialDocument)
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set())
  const [fieldSearch, setFieldSearch] = useState('')
  const [selectedFieldCount, setSelectedFieldCount] = useState(0)

  // Preview panel collapse/expand
  const { panelRef, setIsCollapsed } = usePreviewPanel()

  // Persist panel sizes to localStorage
  const [defaultLayout] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (saved) {
        try {
          return JSON.parse(saved) as number[]
        } catch {
          return [60, 40]
        }
      }
    }
    return [60, 40]
  })

  const handleLayoutChange = useCallback((sizes: number[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(sizes))
    }
  }, [])

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
          <>
            <SelectionActions selectedCount={selectedFieldCount} />
            <DocumentDetailActions assignedStacks={document.stacks ?? []} />
          </>
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
          defaultSize={defaultLayout[0]}
          minSize={30}
          className="overflow-auto"
        >
          <div className="h-full">
            <ExtractedDataTable
              fields={document.extracted_fields}
              confidenceScores={document.confidence_scores}
              changedFields={changedFields}
              searchFilter={fieldSearch}
              onSelectionChange={setSelectedFieldCount}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Preview - collapsible sidebar */}
        <ResizablePanel
          ref={panelRef}
          defaultSize={defaultLayout[1]}
          minSize={35}
          maxSize={60}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className="overflow-auto"
        >
          <div className="h-full">
            <PreviewPanel
              pdfUrl={signedUrl}
              ocrText={document.ocr_raw_text}
              mimeType={document.mime_type}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* AI Chat Bar - inline at bottom */}
      <div className="shrink-0">
        <AiChatBar documentId={document.id} />
      </div>
    </div>
  )
}
