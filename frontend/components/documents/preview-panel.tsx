'use client'

import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VisualPreview } from '@/components/visual-preview'
import { Loader2 } from 'lucide-react'

// Dynamic import to avoid SSR issues with react-pdf
const PdfViewer = dynamic(
  () => import('@/components/pdf-viewer').then((mod) => ({ default: mod.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground/50" />
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
  const isPdf = mimeType === 'application/pdf'

  return (
    <Tabs defaultValue={isPdf ? 'pdf' : 'visual'} className="flex flex-col h-full">
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
            value="visual"
            className="h-6 px-2.5 text-xs rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Visual
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Content area */}
      <TabsContent value="pdf" className="flex-1 mt-0 overflow-hidden">
        {isPdf && pdfUrl ? (
          <PdfViewer url={pdfUrl} />
        ) : (
          <div className="flex h-[600px] items-center justify-center">
            <p className="text-sm text-muted-foreground">PDF preview not available</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="visual" className="flex-1 mt-0 overflow-hidden">
        <VisualPreview markdown={ocrText} />
      </TabsContent>
    </Tabs>
  )
}
