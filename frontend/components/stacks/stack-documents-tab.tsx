'use client'

import type { StackDocument } from '@/types/stacks'

interface StackDocumentsTabProps {
  documents: StackDocument[]
  stackId: string
  searchFilter: string
}

/**
 * Documents tab for stack detail page.
 * Shows documents linked to a stack with search filtering.
 * TODO: Full implementation in Task 5
 */
export function StackDocumentsTab({
  documents,
  stackId,
  searchFilter,
}: StackDocumentsTabProps) {
  const filteredDocuments = searchFilter
    ? documents.filter((doc) =>
        doc.document.filename.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : documents

  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground mb-4">
        {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} in stack
      </p>
      <div className="space-y-2">
        {filteredDocuments.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 p-3 rounded-md border bg-card"
          >
            <span className="text-sm font-medium">{doc.document.filename}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {doc.document.status}
            </span>
          </div>
        ))}
        {filteredDocuments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchFilter ? 'No documents match your search' : 'No documents in this stack'}
          </p>
        )}
      </div>
    </div>
  )
}
