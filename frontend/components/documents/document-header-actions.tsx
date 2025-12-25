'use client'

import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { PreviewToggle } from './preview-toggle'
import { ActionButton } from '@/components/layout/action-button'
import { Edit, Download } from 'lucide-react'

interface DocumentHeaderActionsProps {
  assignedStacks: Array<{ id: string; name: string }>
}

export function DocumentHeaderActions({ assignedStacks }: DocumentHeaderActionsProps) {
  return (
    <>
      <StacksDropdown assignedStacks={assignedStacks} />
      <PreviewToggle />
      <ActionButton icon={<Edit />} disabled>
        Edit
      </ActionButton>
      <ActionButton icon={<Download />} disabled>
        Export
      </ActionButton>
    </>
  )
}
