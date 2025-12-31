import { PageHeader } from '@/components/layout/page-header'
import { PreviewToggle } from '@/components/documents/preview-toggle'
import { UploadButton } from '@/components/agent'

/**
 * Header slot for documents list page.
 * Shows breadcrumb with upload button and preview toggle actions.
 */
export default function DocumentsHeaderSlot() {
  return (
    <PageHeader
      actions={
        <div className="flex items-center gap-2">
          <UploadButton />
          <PreviewToggle />
        </div>
      }
    />
  )
}
