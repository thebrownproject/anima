'use client'

import dynamic from 'next/dynamic'
import { useEffect, useCallback } from 'react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { PreviewControls } from './preview-controls'
import { PageNavigation } from './page-navigation'
import { TextContent } from './text-content'
import { cn } from '@/lib/utils'
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

interface PreviewContainerProps {
  // Tab state
  activeTab: 'pdf' | 'text'
  onTabChange: (tab: 'pdf' | 'text') => void
  isPdfAvailable: boolean
  // PDF state
  pdfUrl: string | null
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onPdfLoad: (info: { numPages: number }) => void
  // Text content
  ocrText: string | null
  // Actions
  onExpand: () => void
  onDownload: () => void
  canDownload: boolean
}

export function PreviewContainer({
  activeTab,
  onTabChange,
  isPdfAvailable,
  pdfUrl,
  currentPage,
  totalPages,
  onPageChange,
  onPdfLoad,
  ocrText,
  onExpand,
  onDownload,
  canDownload,
}: PreviewContainerProps) {
  // Keyboard navigation for pages
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't navigate pages when user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (activeTab !== 'pdf' || totalPages <= 1) return
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        onPageChange(currentPage - 1)
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        onPageChange(currentPage + 1)
      }
    },
    [activeTab, currentPage, totalPages, onPageChange]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Determine effective tab when PDF not available
  const effectiveTab = activeTab === 'pdf' && !isPdfAvailable ? 'text' : activeTab
  const showPageNav = effectiveTab === 'pdf' && totalPages > 1

  return (
    <Tabs value={effectiveTab} onValueChange={(v) => onTabChange(v as 'pdf' | 'text')} className="flex-1 min-h-0">
      <div className="group relative h-full rounded-lg overflow-hidden bg-muted">
        {/* Top controls - fade in on hover */}
        <div
          className={cn(
            'absolute inset-x-0 top-0 z-10',
            'flex items-center p-3',
            'bg-gradient-to-b from-black/60 via-black/30 to-transparent',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
          )}
        >
          <PreviewControls
            isPdfAvailable={isPdfAvailable}
            onExpand={onExpand}
            onDownload={onDownload}
            canDownload={canDownload}
          />
        </div>

        {/* Content area */}
        <TabsContent value="pdf" className="h-full m-0 data-[state=inactive]:hidden">
          {isPdfAvailable && pdfUrl ? (
            <PdfContent
              key={pdfUrl}
              url={pdfUrl}
              currentPage={currentPage}
              onLoadSuccess={onPdfLoad}
            />
          ) : isPdfAvailable && !pdfUrl ? (
            <div className="flex h-full items-center justify-center">
              <Icons.Loader2 className="size-6 animate-spin text-muted-foreground/50" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">PDF preview not available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="text" className="h-full m-0 data-[state=inactive]:hidden">
          <TextContent text={ocrText} />
        </TabsContent>

        {/* Bottom controls - PDF only, fade in on hover */}
        {showPageNav && (
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 z-10',
              'flex items-center justify-center py-3',
              'bg-gradient-to-t from-black/60 via-black/30 to-transparent',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
            )}
          >
            <PageNavigation
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              variant="overlay"
            />
          </div>
        )}
      </div>
    </Tabs>
  )
}
