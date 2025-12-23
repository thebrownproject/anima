import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ExtractedDataTable } from '@/components/documents/extracted-data-table'
import { PreviewPanel } from '@/components/documents/preview-panel'
import { AiChatBar } from '@/components/documents/ai-chat-bar'

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
      {/* Main content - asymmetric layout */}
      <div className="flex-1 flex gap-6 min-h-0 overflow-auto">
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
      <div className="shrink-0 mt-6 pt-4">
        <AiChatBar documentId={document.id} />
      </div>
    </div>
  )
}
