'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { FilterBar } from '@/components/layout/filter-bar'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { SelectionActions } from '@/components/layout/selection-actions'
import { ActionButton } from '@/components/layout/action-button'
import { useAgentStore, initialUploadData } from '@/components/agent'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'
import { useStacks } from '@/hooks/use-stacks'
import * as Icons from '@/components/icons'

/**
 * SubBar for documents list page.
 * Renders search, filter, selection actions, and upload button.
 * Consumes filter state from DocumentsFilterContext (shared with DocumentsTable).
 */
export default function DocumentsSubBar() {
  const { filterValue, setFilterValue, selectedCount } = useDocumentsFilter()
  const { stacks } = useStacks()
  const openFlow = useAgentStore((state) => state.openFlow)

  return (
    <SubBar
      left={
        <>
          <ExpandableSearch
            value={filterValue}
            onChange={setFilterValue}
            placeholder="Search documents..."
          />
          <FilterBar stacks={stacks} />
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
