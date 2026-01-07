'use client'

import { useState, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import * as Icons from '@/components/icons'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfContentProps {
  url: string
  currentPage: number
  onLoadSuccess: (info: { numPages: number }) => void
  onLoadError?: (error: Error) => void
}

export function PdfContent({
  url,
  currentPage,
  onLoadSuccess,
  onLoadError,
}: PdfContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Track container width for responsive PDF sizing
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries
      if (!entry) return
      setContainerWidth(entry.contentRect.width)
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  function handleLoadSuccess({ numPages }: { numPages: number }) {
    onLoadSuccess({ numPages })
  }

  function handleLoadError(error: Error) {
    setError(error.message)
    onLoadError?.(error)
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive p-4 text-center">
        <div>
          <p className="font-medium">Failed to load PDF</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full overflow-auto">
      {containerWidth && (
        <Document
          file={url}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          loading={
            <div className="flex h-[600px] items-center justify-center">
              <Icons.Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            width={containerWidth}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      )}
    </div>
  )
}
