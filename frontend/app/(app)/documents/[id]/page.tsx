import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { ExtractedDataTable } from '@/components/documents/extracted-data-table'
import { PreviewPanel } from '@/components/documents/preview-panel'
import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { Edit, Download, FileText } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  if (!document) {
    notFound()
  }

  // Get signed URL for PDF viewing
  let signedUrl: string | null = null
  if (document.file_path) {
    try {
      const supabase = await createServerSupabaseClient()
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 3600) // 1 hour expiry

      signedUrl = data?.signedUrl || null
    } catch {
      // Gracefully degrade - page still renders without PDF preview
      signedUrl = null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with breadcrumbs and actions */}
      <PageHeader
        title={document.filename}
        actions={
          <>
            <StacksDropdown assignedStacks={document.stacks} />
            <Button variant="outline" size="sm" disabled>
              <Edit className="mr-2 size-4" />
              Edit
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Download className="mr-2 size-4" />
              Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Extracted Data */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Extracted Data</h2>
          <ExtractedDataTable
            fields={document.extracted_fields}
            confidenceScores={document.confidence_scores}
          />
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Preview</h2>
          <PreviewPanel
            pdfUrl={signedUrl}
            ocrText={document.ocr_raw_text}
            mimeType={document.mime_type}
          />
        </div>
      </div>

      {/* AI Chat Bar - placeholder for now */}
      <div className="fixed bottom-0 left-0 right-0 pb-4 pt-6 bg-gradient-to-t from-background via-background to-transparent pointer-events-none z-50">
        <div className="mx-auto w-full max-w-2xl px-4 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-xl border bg-background/95 backdrop-blur-sm p-3 shadow-lg">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 shrink-0">
              <FileText className="size-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground flex-1">
              AI Chat Bar - coming soon
            </p>
          </div>
        </div>
      </div>

      {/* Spacer for fixed chat bar */}
      <div className="h-24" />
    </div>
  )
}
