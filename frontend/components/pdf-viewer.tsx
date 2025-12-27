'use client'

import { useState, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import * as Icons from '@/components/icons'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker - use import.meta.url for Next.js compatibility
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfViewerProps {
  url: string
}

const BASE_WIDTH = 600 // Fixed PDF render width for quality

export function PdfViewer({ url }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Scale PDF to fit container width (no re-renders, just CSS transform)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries
      if (!entry) return

      const containerWidth = entry.contentRect.width - 32 // Account for p-4 padding (16px each side)
      const newScale = Math.min(containerWidth / BASE_WIDTH, 1) // Don't scale up beyond 100%
      setScale(newScale)
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setLoading(false)
  }

  function onDocumentLoadError(error: Error) {
    setError(error.message)
    setLoading(false)
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full overflow-hidden">
      {error ? (
        <div className="flex h-full items-center justify-center text-destructive p-4 text-center">
          <div>
            <p className="font-medium">Failed to load PDF</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto flex justify-center px-4">
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                width: `${BASE_WIDTH}px`,
              }}
            >
              <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex h-[600px] items-center justify-center">
                    <Icons.Loader2 className="size-8 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={BASE_WIDTH}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            </div>
          </div>

          {!loading && numPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-3 border-t shrink-0">
              <Button
                variant="outline"
                size="sm"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => p - 1)}
                aria-label="Previous page"
              >
                <Icons.ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {pageNumber} of {numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber((p) => p + 1)}
                aria-label="Next page"
              >
                <Icons.ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
