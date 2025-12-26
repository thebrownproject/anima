import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { PageHeader } from '@/components/layout/page-header'
import { DocumentHeaderActions } from '@/components/documents/document-header-actions'
import { FileTypeIcon } from '@/components/file-type-icon'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Header slot for document detail page.
 * Renders PageHeader with document title and preview toggle.
 * Stacks/Edit/Export moved to sub-bar in page content.
 */
export default async function DocumentHeaderSlot({ params }: PageProps) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  if (!document) {
    notFound()
  }

  return (
    <PageHeader
      title={document.filename}
      icon={<FileTypeIcon mimeType={document.mime_type} />}
      actions={<DocumentHeaderActions />}
    />
  )
}
