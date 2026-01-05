'use client'

import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'
import type { StackSummary } from '@/types/stacks'

interface FilterButtonProps {
  stacks: StackSummary[]
}

export function FilterButton({ stacks }: FilterButtonProps) {
  const {
    dateRange,
    setDateRange,
    stackFilter,
    toggleStackFilter,
    activeFilterCount,
    clearFilters,
  } = useDocumentsFilter()

  const label = activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ActionButton icon={<Icons.Filter />}>
              {label}
            </ActionButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Filter documents</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
        {/* Date sub-menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Icons.Calendar className="size-4" />
            <span>Date</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setDateRange('all')}>
              <Icons.Clock className="size-4" />
              <span>All time</span>
              {dateRange === 'all' && <Icons.Check className="ml-auto size-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDateRange('today')}>
              <Icons.Calendar className="size-4" />
              <span>Today</span>
              {dateRange === 'today' && <Icons.Check className="ml-auto size-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDateRange('yesterday')}>
              <Icons.CalendarMinus className="size-4" />
              <span>Yesterday</span>
              {dateRange === 'yesterday' && <Icons.Check className="ml-auto size-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDateRange('last7')}>
              <Icons.CalendarWeek className="size-4" />
              <span>Last 7 days</span>
              {dateRange === 'last7' && <Icons.Check className="ml-auto size-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDateRange('last30')}>
              <Icons.CalendarMonth className="size-4" />
              <span>Last 30 days</span>
              {dateRange === 'last30' && <Icons.Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Stacks sub-menu - only show if stacks exist */}
        {stacks.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Icons.Stack className="size-4" />
              <span>Stacks</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {stacks.map((stack) => (
                <DropdownMenuItem key={stack.id} onClick={() => toggleStackFilter(stack.id)}>
                  <Icons.Stack className="size-4" />
                  <span>{stack.name}</span>
                  {stackFilter.has(stack.id) && <Icons.Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Clear all filters - shown when filters are active */}
        {activeFilterCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={clearFilters} className="text-muted-foreground">
              Clear all filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
