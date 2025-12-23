import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { Edit, Download } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Header slot for document detail page.
 * Renders PageHeader with document title and actions in the layout's header bar.
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
  )
}
