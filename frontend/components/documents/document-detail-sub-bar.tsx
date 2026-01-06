'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { SelectionActions } from '@/components/layout/selection-actions'
import { SearchFilterButton } from '@/components/layout/search-filter-button'
import { FilterPill } from '@/components/layout/filter-pill'
import { DocumentDetailActions } from '@/components/documents/document-detail-actions'
import { useDocumentDetailFilter } from '@/components/documents/document-detail-filter-context'
import * as Icons from '@/components/icons'
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
        <>
          <SearchFilterButton
            value={fieldSearch}
            onChange={setFieldSearch}
            placeholder="Search fields..."
          />
          {fieldSearch && (
            <FilterPill
              icon={<Icons.Search className="size-full" />}
              label={`"${fieldSearch}"`}
              onRemove={() => setFieldSearch('')}
            />
          )}
        </>
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
