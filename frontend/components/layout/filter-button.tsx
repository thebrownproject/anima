'use client'

import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import { Checkbox } from '@/components/ui/checkbox'
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
            <DropdownMenuItem
              onClick={() => setDateRange(dateRange === 'today' ? 'all' : 'today')}
              className="gap-2"
            >
              <Checkbox checked={dateRange === 'today'} className="pointer-events-none" />
              <Icons.Calendar className="size-4" />
              <span>Today</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRange(dateRange === 'yesterday' ? 'all' : 'yesterday')}
              className="gap-2"
            >
              <Checkbox checked={dateRange === 'yesterday'} className="pointer-events-none" />
              <Icons.CalendarMinus className="size-4" />
              <span>Yesterday</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRange(dateRange === 'last7' ? 'all' : 'last7')}
              className="gap-2"
            >
              <Checkbox checked={dateRange === 'last7'} className="pointer-events-none" />
              <Icons.CalendarWeek className="size-4" />
              <span>Last 7 days</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRange(dateRange === 'last30' ? 'all' : 'last30')}
              className="gap-2"
            >
              <Checkbox checked={dateRange === 'last30'} className="pointer-events-none" />
              <Icons.CalendarMonth className="size-4" />
              <span>Last 30 days</span>
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
                <DropdownMenuItem
                  key={stack.id}
                  onClick={() => toggleStackFilter(stack.id)}
                  className="gap-2"
                >
                  <Checkbox checked={stackFilter.has(stack.id)} className="pointer-events-none" />
                  <Icons.Stack className="size-4" />
                  <span>{stack.name}</span>
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
