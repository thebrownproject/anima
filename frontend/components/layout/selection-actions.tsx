'use client'

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

interface SelectionActionsProps {
  selectedCount: number
  onDelete?: () => void
  onAddToStack?: () => void
}

export function SelectionActions({
  selectedCount,
  onDelete,
  onAddToStack,
}: SelectionActionsProps) {
  if (selectedCount === 0) return null

  return (
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
          <DropdownMenuItem onClick={onAddToStack} disabled>
            <Icons.FolderPlus className="mr-2 size-4" />
            Add to Stack
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            disabled
            className="text-destructive focus:text-destructive"
          >
            <Icons.Trash className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
