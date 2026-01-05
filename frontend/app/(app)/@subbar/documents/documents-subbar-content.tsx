'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { FilterButton } from '@/components/layout/filter-button'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { SelectionActions } from '@/components/layout/selection-actions'
import { ActionButton } from '@/components/layout/action-button'
import { useAgentStore, initialUploadData } from '@/components/agent'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'
import * as Icons from '@/components/icons'
import type { StackSummary } from '@/types/stacks'

interface DocumentsSubBarContentProps {
  stacks: StackSummary[]
}

/**
 * Client component for documents subbar.
 * Renders search, filter, selection actions, and upload button.
 * Consumes filter state from DocumentsFilterContext (shared with DocumentsTable).
 */
export function DocumentsSubBarContent({ stacks }: DocumentsSubBarContentProps) {
  const { filterValue, setFilterValue, selectedCount } = useDocumentsFilter()
  const openFlow = useAgentStore((state) => state.openFlow)

  return (
    <SubBar
      left={
        <>
          <FilterButton stacks={stacks} />
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
