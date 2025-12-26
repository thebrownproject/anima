import { PageHeader } from '@/components/layout/page-header'
import { DocumentHeaderActions } from '@/components/documents/document-header-actions'

/**
 * Header slot for documents list page.
 * Shows breadcrumb with preview toggle action.
 */
export default function DocumentsHeaderSlot() {
  return <PageHeader actions={<DocumentHeaderActions />} />
}
