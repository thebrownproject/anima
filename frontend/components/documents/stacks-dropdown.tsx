'use client'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { Stack } from '@/types/documents'
import * as Icons from '@/components/icons'

interface StacksDropdownProps {
  assignedStacks: Stack[]
  allStacks?: Stack[]
  onToggleStack?: (stackId: string, assigned: boolean) => void
}

export function StacksDropdown({
  assignedStacks,
  allStacks = [],
  onToggleStack,
}: StacksDropdownProps) {
  const assignedIds = new Set(assignedStacks.map((s) => s.id))

  if (assignedStacks.length === 0) {
    return (
      <span className="text-xs text-muted-foreground/60 px-2">
        No stacks
      </span>
    )
  }

  const displayText =
    assignedStacks.length === 1
      ? assignedStacks[0].name
      : `${assignedStacks[0].name} +${assignedStacks.length - 1}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Manage stacks. Currently assigned: ${assignedStacks.map(s => s.name).join(', ')}`}
          className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          {displayText}
          <Icons.ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Stacks
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allStacks.length > 0 ? (
          allStacks.map((stack) => (
            <DropdownMenuCheckboxItem
              key={stack.id}
              checked={assignedIds.has(stack.id)}
              onCheckedChange={(checked) => onToggleStack?.(stack.id, checked)}
              className="text-sm"
            >
              {stack.name}
            </DropdownMenuCheckboxItem>
          ))
        ) : (
          assignedStacks.map((stack) => (
            <DropdownMenuCheckboxItem key={stack.id} checked={true} disabled className="text-sm">
              {stack.name}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
