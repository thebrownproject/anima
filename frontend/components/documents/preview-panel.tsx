'use client'

import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VisualPreview } from '@/components/documents/visual-preview'
import { usePreviewPanel } from '@/components/preview-panel/preview-panel-context'
import * as Icons from '@/components/icons'

// Dynamic import to avoid SSR issues with react-pdf
const PdfViewer = dynamic(
  () => import('@/components/documents/pdf-viewer').then((mod) => ({ default: mod.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center">
        <Icons.Loader2 className="size-6 animate-spin text-muted-foreground/50" />
      </div>
    ),
  }
)

interface PreviewPanelProps {
  pdfUrl: string | null
  ocrText: string | null
  mimeType: string
}

export function PreviewPanel({ pdfUrl, ocrText, mimeType }: PreviewPanelProps) {
  const { activeTab, setActiveTab } = usePreviewPanel()
  const isPdf = mimeType === 'application/pdf'

  // Determine effective tab: if PDF not available and tab is 'pdf', show text
  const effectiveTab = (activeTab === 'pdf' && !isPdf) ? 'text' : activeTab

  return (
    <Tabs value={effectiveTab} onValueChange={(v) => setActiveTab(v as 'pdf' | 'text')} className="flex flex-col h-full">
      {/* Header bar - matches table header height */}
      <div className="flex h-[40.5px] shrink-0 items-center px-4 border-b">
        <TabsList className="h-7 p-0.5 bg-muted/50">
          <TabsTrigger
            value="pdf"
            disabled={!isPdf}
            className="h-6 px-2.5 text-xs rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            PDF
          </TabsTrigger>
          <TabsTrigger
            value="text"
            className="h-6 px-2.5 text-xs rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Text
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Content area */}
      <TabsContent value="pdf" className="flex-1 mt-0 overflow-hidden">
        {isPdf && pdfUrl ? (
          <PdfViewer key={pdfUrl} url={pdfUrl} />
        ) : isPdf && !pdfUrl ? (
          // PDF loading - signed URL being fetched client-side
          <div className="flex h-[600px] items-center justify-center">
            <Icons.Loader2 className="size-6 animate-spin text-muted-foreground/50" />
          </div>
        ) : (
          <div className="flex h-[600px] items-center justify-center">
            <p className="text-sm text-muted-foreground">PDF preview not available</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="text" className="flex-1 mt-0 overflow-hidden">
        <VisualPreview markdown={ocrText} />
      </TabsContent>
    </Tabs>
  )
}
