'use client'

import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { VisualPreview } from '@/components/visual-preview'
import { Loader2 } from 'lucide-react'

// Dynamic import to avoid SSR issues with react-pdf
const PdfViewer = dynamic(
  () => import('@/components/pdf-viewer').then((mod) => ({ default: mod.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
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
    <Tabs defaultValue={isPdf ? 'pdf' : 'visual'} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="pdf" disabled={!isPdf}>
          PDF
        </TabsTrigger>
        <TabsTrigger value="visual">Visual</TabsTrigger>
      </TabsList>
      <TabsContent value="pdf">
        <Card>
          <CardContent className="p-0">
            {isPdf && pdfUrl ? (
              <PdfViewer url={pdfUrl} />
            ) : (
              <div className="flex h-[600px] items-center justify-center text-muted-foreground">
                PDF preview not available for this file type
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="visual">
        <Card>
          <CardContent className="p-0">
            <VisualPreview markdown={ocrText} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
