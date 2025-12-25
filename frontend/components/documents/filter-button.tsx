'use client'

import { Filter } from 'lucide-react'
import { ActionButton } from '@/components/layout/action-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function FilterButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton icon={<Filter />}>
          Filter
        </ActionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem disabled>
          <span className="text-muted-foreground">Coming soon</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
