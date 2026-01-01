'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { FilterButton } from '@/components/layout/filter-button'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { SelectionActions } from '@/components/layout/selection-actions'
import { ActionButton } from '@/components/layout/action-button'
import { useAgentStore, initialUploadData } from '@/components/agent'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'
import * as Icons from '@/components/icons'

/**
 * SubBar for documents list page.
 * Renders search, filter, selection actions, and upload button.
 * Consumes filter state from DocumentsFilterContext (shared with DocumentsTable).
 */
export default function DocumentsSubBar() {
  const { filterValue, setFilterValue, selectedCount } = useDocumentsFilter()
  const openFlow = useAgentStore((state) => state.openFlow)

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
          <ActionButton
            icon={<Icons.Upload />}
            onClick={() => openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })}
          >
            Upload
          </ActionButton>
        </>
      }
    />
  )
}
