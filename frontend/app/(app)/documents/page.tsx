import { getDocumentsWithStacks } from '@/lib/queries/documents'
import { DocumentsList } from '@/components/documents/documents-list'

export default async function DocumentsPage() {
  const documents = await getDocumentsWithStacks()

  return <DocumentsList documents={documents} />
}
