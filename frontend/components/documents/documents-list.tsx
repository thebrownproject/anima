'use client'

import { DocumentsTable } from './documents-table'
import { UploadButton } from './upload-button'
import type { Document } from '@/types/documents'

interface DocumentsListProps {
  documents: Document[]
}

export function DocumentsList({ documents }: DocumentsListProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <UploadButton />
      </div>
      <DocumentsTable documents={documents} />
    </div>
  )
}
