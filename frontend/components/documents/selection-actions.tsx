'use client'

import { Trash2, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
      <span className="text-sm text-muted-foreground">
        {selectedCount} selected
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onAddToStack} disabled>
            <FolderPlus className="mr-2 size-4" />
            Add to Stack
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            disabled
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
