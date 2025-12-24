import { PageHeader } from '@/components/layout/page-header'
import { UploadDialogTrigger } from '@/components/documents/upload-dialog'

/**
 * Header slot for documents list page.
 * Shows breadcrumb with Upload action.
 */
export default function DocumentsHeaderSlot() {
  return (
    <PageHeader
      actions={<UploadDialogTrigger variant="header" />}
    />
  )
}
