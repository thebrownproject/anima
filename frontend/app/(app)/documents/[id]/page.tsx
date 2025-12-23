import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DocumentDetailClient } from '@/components/documents/document-detail-client'

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

  return <DocumentDetailClient initialDocument={document} signedUrl={signedUrl} />
}
