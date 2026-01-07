'use client'

import { useState, useCallback, useEffect } from 'react'
import { PreviewContainer } from './preview-container'
import { PreviewMetadata } from './preview-metadata'
import { ExpandModal } from './expand-modal'
import { usePreviewPanel } from './preview-panel-context'

interface PreviewPanelProps {
  pdfUrl: string | null
  ocrText: string | null
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
  mimeType,
  filename,
  fileSize,
  pageCount,
  extractedFields,
  onDownload,
}: PreviewPanelProps) {
  const { activeTab, setActiveTab } = usePreviewPanel()

  // Local state for PDF page and modal
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(pageCount ?? 0)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const isPdf = mimeType === 'application/pdf'

  // Reset page to 1 when document changes
  useEffect(() => {
    setCurrentPage(1)
  }, [pdfUrl])

  // Calculate field count for metadata
  const fieldCount = extractedFields ? Object.keys(extractedFields).length : null

  const handlePdfLoad = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handleExpand = useCallback(() => {
    setIsModalOpen(true)
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

  // Empty state
  if (!filename) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a document to preview</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-8 pb-20 gap-0">
      <PreviewContainer
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isPdfAvailable={isPdf}
        pdfUrl={pdfUrl}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onPdfLoad={handlePdfLoad}
        ocrText={ocrText}
        onExpand={handleExpand}
        onDownload={handleDownload}
        canDownload={canDownload}
      />

      <PreviewMetadata
        filename={filename}
        mimeType={mimeType}
        fileSize={fileSize}
        pageCount={totalPages > 0 ? totalPages : pageCount}
        fieldCount={fieldCount}
      />

      <ExpandModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        pdfUrl={pdfUrl}
        activeTab={activeTab}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onPdfLoad={handlePdfLoad}
        ocrText={ocrText}
        filename={filename}
        onDownload={handleDownload}
      />
    </div>
  )
}
