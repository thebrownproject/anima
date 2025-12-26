'use client'

import { DocumentsTable } from './documents-table'
import type { Document } from '@/types/documents'

interface DocumentsListProps {
  documents: Document[]
}

export function DocumentsList({ documents }: DocumentsListProps) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <DocumentsTable documents={documents} />
    </div>
  )
}
