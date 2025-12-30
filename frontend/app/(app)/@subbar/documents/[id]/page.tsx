'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { FilterButton } from '@/components/layout/filter-button'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { SelectionActions } from '@/components/layout/selection-actions'
import { DocumentDetailActions } from '@/components/documents/document-detail-actions'
import { useDocumentDetailFilter } from '@/components/documents/document-detail-filter-context'

/**
 * SubBar for document detail page.
 * Renders field search, filter, selection actions, and document actions.
 * Consumes filter state from DocumentDetailFilterContext (shared with ExtractedDataTable).
 */
export default function DocumentDetailSubBar() {
  const { fieldSearch, setFieldSearch, selectedFieldCount, assignedStacks } = useDocumentDetailFilter()

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
