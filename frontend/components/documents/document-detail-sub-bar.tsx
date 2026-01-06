'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { SelectionActions } from '@/components/layout/selection-actions'
import { DocumentDetailActions } from '@/components/documents/document-detail-actions'
import { useDocumentDetailFilter } from '@/components/documents/document-detail-filter-context'
import type { StackSummary } from '@/types/stacks'

interface DocumentDetailSubBarProps {
  documentId: string
  assignedStacks: StackSummary[]
}

/**
 * Client component for document detail SubBar.
 * Receives server-fetched data (assignedStacks) as props.
 * Uses context for client-side state (fieldSearch, selectedFieldCount).
 */
export function DocumentDetailSubBar({ documentId, assignedStacks }: DocumentDetailSubBarProps) {
  const { fieldSearch, setFieldSearch, selectedFieldCount } = useDocumentDetailFilter()

  return (
    <SubBar
      left={
        <ExpandableSearch
          value={fieldSearch}
          onChange={setFieldSearch}
          placeholder="Search fields..."
        />
      }
      right={
        <>
          <SelectionActions selectedCount={selectedFieldCount} />
          <DocumentDetailActions documentId={documentId} assignedStacks={assignedStacks} />
        </>
      }
    />
  )
}
