'use client'

import { DocumentsTable } from './documents-table'
import type { Document } from '@/types/documents'

interface DocumentsListProps {
  documents: Document[]
}

export function DocumentsList({ documents }: DocumentsListProps) {
  return <DocumentsTable documents={documents} />
}
