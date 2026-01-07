'use client'

import dynamic from 'next/dynamic'
import { useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { PageNavigation } from './page-navigation'
import { TextContent } from './text-content'
import * as Icons from '@/components/icons'

// Dynamic import to avoid SSR issues with react-pdf
const PdfContent = dynamic(
  () => import('./pdf-content').then((mod) => ({ default: mod.PdfContent })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Icons.Loader2 className="size-6 animate-spin text-muted-foreground/50" />
      </div>
    ),
  }
)

interface ExpandModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdfUrl: string | null
  activeTab: 'pdf' | 'text'
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onPdfLoad: (info: { numPages: number }) => void
  ocrText: string | null
  filename: string
  onDownload: () => void
}

export function ExpandModal({
  open,
  onOpenChange,
  pdfUrl,
  activeTab,
  currentPage,
  totalPages,
  onPageChange,
  onPdfLoad,
  ocrText,
  filename,
  onDownload,
}: ExpandModalProps) {
  // Keyboard navigation for pages
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't navigate pages when user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!open || activeTab !== 'pdf' || totalPages <= 1) return
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        onPageChange(currentPage - 1)
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        onPageChange(currentPage + 1)
      }
    },
    [open, activeTab, currentPage, totalPages, onPageChange]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const isPdf = activeTab === 'pdf'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col gap-0 p-0">
        {/* Visually hidden but accessible title - using Radix VisuallyHidden
            for better cross-browser support vs Tailwind sr-only */}
        <VisuallyHidden asChild>
          <DialogTitle>Document Preview</DialogTitle>
        </VisuallyHidden>

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-t-lg bg-muted m-4 mb-0">
          {isPdf && pdfUrl ? (
            <PdfContent
              url={pdfUrl}
              currentPage={currentPage}
              onLoadSuccess={onPdfLoad}
            />
          ) : (
            <TextContent text={ocrText} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm font-medium truncate max-w-[200px]" title={filename}>
            {filename}
          </span>

          {isPdf && totalPages > 1 && (
            <PageNavigation
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              variant="default"
            />
          )}

          {activeTab === 'pdf' && pdfUrl && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Icons.Download className="size-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
