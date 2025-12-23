import { PageHeader } from '@/components/layout/page-header'
import { UploadButton } from '@/components/documents/upload-button'

/**
 * Header slot for documents list page.
 * Shows breadcrumb with Upload action.
 */
export default function DocumentsHeaderSlot() {
  return (
    <PageHeader
      actions={<UploadButton variant="header" />}
    />
  )
}
