'use client'

import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { ActionButton } from '@/components/layout/action-button'
import * as Icons from '@/components/icons'

interface DocumentDetailActionsProps {
  assignedStacks: Array<{ id: string; name: string }>
}

export function DocumentDetailActions({ assignedStacks }: DocumentDetailActionsProps) {
  return (
    <>
      <StacksDropdown assignedStacks={assignedStacks} />
      <ActionButton icon={<Icons.Edit />} tooltip="Edit document and extractions">
        Edit
      </ActionButton>
      <ActionButton icon={<Icons.Download />} tooltip="Download extraction data">
        Export
      </ActionButton>
    </>
  )
}
