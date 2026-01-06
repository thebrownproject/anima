'use client'

import { useState } from 'react'
import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BulkDeleteDialog } from '@/components/documents/bulk-delete-dialog'

interface SelectionActionsProps {
  selectedCount: number
  selectedIds: string[]
  onClearSelection: () => void
  onAddToStack?: () => void  // PLACEHOLDER: Not implemented yet (see Deferred Work in main plan)
}

export function SelectionActions({
  selectedCount,
  selectedIds,
  onClearSelection,
  onAddToStack,
}: SelectionActionsProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  if (selectedCount === 0) return null

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {selectedCount} selected
        </span>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <ActionButton icon={<Icons.ChevronDown />}>
                  Actions
                </ActionButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Bulk operations</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
            {/* Add to Stack: disabled placeholder - see Deferred Work in main plan */}
            <DropdownMenuItem onClick={onAddToStack} disabled className="gap-2">
              <Icons.FolderPlus className="size-4" />
              <span>Add to Stack</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              disabled={selectedIds.length === 0}
              className="gap-2"
            >
              <Icons.Trash className="size-4" />
              <span>Delete {selectedCount === 1 ? 'document' : 'documents'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <BulkDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        documentIds={selectedIds}
        onComplete={onClearSelection}
      />
    </>
  )
}
