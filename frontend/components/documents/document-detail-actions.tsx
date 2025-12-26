'use client'

import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { ActionButton } from '@/components/layout/action-button'
import { Edit, Download } from 'lucide-react'

interface DocumentDetailActionsProps {
  assignedStacks: Array<{ id: string; name: string }>
}

export function DocumentDetailActions({ assignedStacks }: DocumentDetailActionsProps) {
  return (
    <>
      <StacksDropdown assignedStacks={assignedStacks} />
      <ActionButton icon={<Edit />}>
        Edit
      </ActionButton>
      <ActionButton icon={<Download />}>
        Export
      </ActionButton>
    </>
  )
}
