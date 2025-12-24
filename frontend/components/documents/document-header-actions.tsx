'use client'

import { Button } from '@/components/ui/button'
import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { PreviewToggle } from './preview-toggle'
import { Edit, Download } from 'lucide-react'

interface DocumentHeaderActionsProps {
  assignedStacks: Array<{ id: string; name: string }>
}

export function DocumentHeaderActions({ assignedStacks }: DocumentHeaderActionsProps) {
  return (
    <>
      <StacksDropdown assignedStacks={assignedStacks} />
      <PreviewToggle />
      <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs">
        <Edit className="mr-1.5 size-3.5" />
        Edit
      </Button>
      <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs">
        <Download className="mr-1.5 size-3.5" />
        Export
      </Button>
    </>
  )
}
