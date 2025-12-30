'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { FilterButton } from '@/components/layout/filter-button'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { SelectionActions } from '@/components/layout/selection-actions'
import { DocumentDetailActions } from '@/components/documents/document-detail-actions'
import { useDocumentDetailFilter } from '@/components/documents/document-detail-filter-context'
import type { StackSummary } from '@/types/stacks'

interface DocumentDetailSubBarProps {
  assignedStacks: StackSummary[]
}

/**
 * Client component for document detail SubBar.
 * Receives server-fetched data (assignedStacks) as props.
 * Uses context for client-side state (fieldSearch, selectedFieldCount).
 */
export function DocumentDetailSubBar({ assignedStacks }: DocumentDetailSubBarProps) {
  const { fieldSearch, setFieldSearch, selectedFieldCount } = useDocumentDetailFilter()

  return (
    <SubBar
      left={
        <>
          <FilterButton />
          <ExpandableSearch
            value={fieldSearch}
            onChange={setFieldSearch}
            placeholder="Search fields..."
          />
        </>
      }
      right={
        <>
          <SelectionActions selectedCount={selectedFieldCount} />
          <DocumentDetailActions assignedStacks={assignedStacks} />
        </>
      }
    />
  )
}
