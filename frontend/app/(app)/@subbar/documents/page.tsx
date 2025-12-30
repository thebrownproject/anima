'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { FilterButton } from '@/components/layout/filter-button'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { SelectionActions } from '@/components/layout/selection-actions'
import { UploadDialogTrigger } from '@/components/layout/upload-dialog/upload-dialog-trigger'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'

/**
 * SubBar for documents list page.
 * Renders search, filter, selection actions, and upload button.
 * Consumes filter state from DocumentsFilterContext (shared with DocumentsTable).
 */
export default function DocumentsSubBar() {
  const { filterValue, setFilterValue, selectedCount } = useDocumentsFilter()

  return (
    <SubBar
      left={
        <>
          <FilterButton />
          <ExpandableSearch
            value={filterValue}
            onChange={setFilterValue}
            placeholder="Search documents..."
          />
        </>
      }
      right={
        <>
          <SelectionActions selectedCount={selectedCount} />
          <UploadDialogTrigger />
        </>
      }
    />
  )
}
