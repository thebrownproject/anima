'use client'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Stack } from '@/types/documents'
import { ChevronDown } from 'lucide-react'

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
      <Badge variant="outline" className="text-muted-foreground cursor-not-allowed">
        No stacks
      </Badge>
    )
  }

  const displayText =
    assignedStacks.length === 1
      ? assignedStacks[0].name
      : `${assignedStacks[0].name} +${assignedStacks.length - 1}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 transition-colors gap-1"
        >
          {displayText}
          <ChevronDown className="size-3" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Assign to Stacks</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allStacks.length > 0 ? (
          allStacks.map((stack) => (
            <DropdownMenuCheckboxItem
              key={stack.id}
              checked={assignedIds.has(stack.id)}
              onCheckedChange={(checked) => onToggleStack?.(stack.id, checked)}
            >
              {stack.name}
            </DropdownMenuCheckboxItem>
          ))
        ) : (
          assignedStacks.map((stack) => (
            <DropdownMenuCheckboxItem key={stack.id} checked={true} disabled>
              {stack.name}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
