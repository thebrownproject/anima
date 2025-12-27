'use client'

import * as Icons from '@/components/icons'
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
        <ActionButton icon={<Icons.Filter />}>
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
