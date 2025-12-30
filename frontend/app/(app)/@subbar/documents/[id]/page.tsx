import { getDocumentStacks } from '@/lib/queries/documents'
import { DocumentDetailSubBar } from '@/components/documents/document-detail-sub-bar'

interface DocumentDetailSubBarPageProps {
  params: Promise<{ id: string }>
}

/**
 * Server component for document detail SubBar.
 * Fetches stacks data (cached) and renders the client SubBar component.
 */
export default async function DocumentDetailSubBarPage({ params }: DocumentDetailSubBarPageProps) {
  const { id } = await params
  const assignedStacks = await getDocumentStacks(id)

  return <DocumentDetailSubBar assignedStacks={assignedStacks} />
}
