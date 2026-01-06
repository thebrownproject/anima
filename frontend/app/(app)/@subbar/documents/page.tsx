'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { FilterBar } from '@/components/layout/filter-bar'
import { SelectionActions } from '@/components/layout/selection-actions'
import { ActionButton } from '@/components/layout/action-button'
import { useAgentStore, initialUploadData } from '@/components/agent'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'
import { useStacks } from '@/hooks/use-stacks'
import * as Icons from '@/components/icons'

/**
 * SubBar for documents list page.
 * Renders filter bar, selection actions, and upload button.
 * Search is now integrated into FilterButton dropdown.
 */
export default function DocumentsSubBar() {
  const { selectedCount } = useDocumentsFilter()
  const { stacks } = useStacks()
  const openFlow = useAgentStore((state) => state.openFlow)

  return (
    <SubBar
      left={<FilterBar stacks={stacks} />}
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
