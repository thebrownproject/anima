'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { PreviewContainer } from './preview-container'
import { PreviewMetadata } from './preview-metadata'
import { ExpandModal } from './expand-modal'
import { usePreviewPanel } from './preview-panel-context'

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

  // Local state for PDF page and modal
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(pageCount ?? 0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isContentReady, setIsContentReady] = useState(true)

  // Track previous filename to detect document changes
  const prevFilenameRef = useRef(filename)

  const isPdf = mimeType === 'application/pdf'

  // Reset page to 1 when document changes
  useEffect(() => {
    setCurrentPage(1)
  }, [pdfUrl])

  // Hide metadata when document changes (PDF only), show when content is ready
  // For non-PDF documents, show metadata immediately since there's no PDF to load
  useEffect(() => {
    if (prevFilenameRef.current !== filename) {
      if (isPdf) {
        setIsContentReady(false)
      } else {
        setIsContentReady(true)
      }
      prevFilenameRef.current = filename
    }
  }, [filename, isPdf])

  // Calculate field count for metadata
  const fieldCount = extractedFields ? Object.keys(extractedFields).length : null

  const handlePdfLoad = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages)
  }, [])

  const handleContentReady = useCallback(() => {
    setIsContentReady(true)
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
    <div className="flex flex-col h-full p-8 pb-[85px]">
      <PreviewContainer
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isPdfAvailable={isPdf}
        pdfUrl={pdfUrl}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onPdfLoad={handlePdfLoad}
        onContentReady={handleContentReady}
        ocrText={ocrText}
        isTextLoading={isLoading}
        onExpand={handleExpand}
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
        onPageChange={handlePageChange}
        onPdfLoad={handlePdfLoad}
        ocrText={ocrText}
        filename={filename}
        onDownload={handleDownload}
      />
    </div>
  )
}
