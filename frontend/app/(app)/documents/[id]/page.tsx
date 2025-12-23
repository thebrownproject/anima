import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ExtractedDataTable } from '@/components/documents/extracted-data-table'
import { PreviewPanel } from '@/components/documents/preview-panel'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { Edit, Download } from 'lucide-react'

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
    <div className="flex flex-1 flex-col min-h-0">
      {/* Page header with title and actions */}
      <PageHeader
        title={document.filename}
        actions={
          <>
            <StacksDropdown assignedStacks={document.stacks} />
            <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs">
              <Edit className="mr-1.5 size-3.5" />
              Edit
            </Button>
            <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs">
              <Download className="mr-1.5 size-3.5" />
              Export
            </Button>
          </>
        }
      />

      {/* Main content - asymmetric layout */}
      <div className="flex-1 flex gap-6 min-h-0 overflow-auto mt-6">
        {/* Left: Extracted Data - narrow fixed width */}
        <div className="w-80 shrink-0">
          <ExtractedDataTable
            fields={document.extracted_fields}
            confidenceScores={document.confidence_scores}
          />
        </div>

        {/* Right: Preview - takes remaining space */}
        <div className="flex-1 min-w-0">
          <PreviewPanel
            pdfUrl={signedUrl}
            ocrText={document.ocr_raw_text}
            mimeType={document.mime_type}
          />
        </div>
      </div>

      {/* AI Chat Bar - inline at bottom */}
      <div className="shrink-0 mt-6 border-t pt-4">
        <div className="flex items-center gap-3 px-1">
          <input
            type="text"
            placeholder="Ask AI to correct or refine extraction..."
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
            disabled
          />
          <kbd className="text-[11px] text-muted-foreground/40 font-mono px-1.5 py-0.5 rounded border border-border/50">
            Enter
          </kbd>
        </div>
      </div>
    </div>
  )
}
