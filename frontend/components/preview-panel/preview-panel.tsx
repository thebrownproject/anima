'use client'

import { useState, useCallback, useEffect } from 'react'
import { PreviewContainer } from './preview-container'
import { PreviewMetadata } from './preview-metadata'
import { ExpandModal } from './expand-modal'
import { usePreviewPanel } from './preview-panel-context'
import { useSelectedDocument } from '@/components/documents/selected-document-context'

interface PreviewPanelProps {
  pdfUrl: string | null
  ocrText: string | null
  isLoading?: boolean
  mimeType: string
  filename: string | null
  fileSize: number | null
  pageCount: number | null
  extractedFields: Record<string, unknown> | null
  onDownload?: () => void
}

export function PreviewPanel({
  pdfUrl,
  ocrText,
  isLoading,
  mimeType,
  filename,
  fileSize,
  pageCount,
  extractedFields,
  onDownload,
}: PreviewPanelProps) {
  const { activeTab, setActiveTab } = usePreviewPanel()
  const { selectedDocId } = useSelectedDocument()

  // Local state for PDF page and modal
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(pageCount ?? 0)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Track which URL's content is ready - compare with current pdfUrl to determine visibility
  // This ensures metadata and PDF appear in the same render cycle
  const [contentReadyForUrl, setContentReadyForUrl] = useState<string | null>(null)

  const isPdf = mimeType === 'application/pdf'

  // Derive content ready state based on ACTIVE TAB, not document type
  // For PDF tab: wait until the rendered URL matches current URL (and URL exists)
  // For Text tab: wait until loading is complete (isLoading is false)
  const isContentReady = activeTab === 'pdf' && isPdf
    ? pdfUrl !== null && contentReadyForUrl === pdfUrl
    : !isLoading

  // Reset page to 1 when document changes - intentional synchronization with URL
  useEffect(() => {
    setCurrentPage(1) // eslint-disable-line react-hooks/set-state-in-effect
  }, [pdfUrl])

  // Calculate field count for metadata
  const fieldCount = extractedFields ? Object.keys(extractedFields).length : null

  const handlePdfLoad = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages)
  }, [])

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload()
    } else if (pdfUrl) {
      // Fallback: open PDF URL in new tab
      window.open(pdfUrl, '_blank')
    }
  }, [onDownload, pdfUrl])

  // Only show download when we have a PDF URL (text download not implemented)
  const canDownload = !!pdfUrl

  // Empty state - show placeholder only when truly no document is selected
  // (not during hydration/loading when selectedDocId exists but filename hasn't loaded yet)
  if (!filename && !selectedDocId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a document to preview</p>
      </div>
    )
  }

  // Document selected but still loading - show nothing to prevent flash
  if (!filename) {
    return null
  }

  return (
    <div className="flex flex-col h-full p-8 pb-[85px]">
      <PreviewContainer
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isPdfAvailable={isPdf}
        pdfUrl={pdfUrl}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onPdfLoad={handlePdfLoad}
        onContentReady={setContentReadyForUrl}
        ocrText={ocrText}
        isTextLoading={isLoading}
        onExpand={() => setIsModalOpen(true)}
        onDownload={handleDownload}
        canDownload={canDownload}
      />

      {isContentReady && (
        <PreviewMetadata
          filename={filename}
          mimeType={mimeType}
          fileSize={fileSize}
          pageCount={totalPages > 0 ? totalPages : pageCount}
          fieldCount={fieldCount}
        />
      )}

      <ExpandModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        pdfUrl={pdfUrl}
        activeTab={activeTab}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onPdfLoad={handlePdfLoad}
        ocrText={ocrText}
        filename={filename}
        onDownload={handleDownload}
      />
    </div>
  )
}
