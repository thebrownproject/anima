'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useExtractionRealtime, ExtractionUpdate } from '@/hooks/use-extraction-realtime'
import { ExtractedDataTable } from './extracted-data-table'
import { PreviewPanel } from './preview-panel'
import { AiChatBar } from './ai-chat-bar'
import type { DocumentWithExtraction } from '@/types/documents'

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
      {/* Main content - asymmetric layout */}
      <div className="flex-1 flex gap-6 min-h-0 overflow-auto">
        {/* Left: Extracted Data - narrow fixed width */}
        <div className="w-80 shrink-0">
          <ExtractedDataTable
            fields={document.extracted_fields}
            confidenceScores={document.confidence_scores}
            changedFields={changedFields}
          />
        </div>

        {/* Right: Preview - takes remaining space */}
        <div className="flex-1 min-w-0">
          <PreviewPanel
            pdfUrl={signedUrl}
            ocrText={document.ocr_raw_text}
            mimeType={document.mime_type}
          />
        </div>
      </div>

      {/* AI Chat Bar - inline at bottom */}
      <div className="shrink-0 mt-6">
        <AiChatBar documentId={document.id} />
      </div>
    </div>
  )
}
