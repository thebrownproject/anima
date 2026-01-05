'use client'

import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
            <DropdownMenuCheckboxItem
              checked={dateRange === 'today'}
              onCheckedChange={() => setDateRange(dateRange === 'today' ? 'all' : 'today')}
            >
              <Icons.Calendar className="size-4" />
              <span>Today</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={dateRange === 'yesterday'}
              onCheckedChange={() => setDateRange(dateRange === 'yesterday' ? 'all' : 'yesterday')}
            >
              <Icons.CalendarMinus className="size-4" />
              <span>Yesterday</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={dateRange === 'last7'}
              onCheckedChange={() => setDateRange(dateRange === 'last7' ? 'all' : 'last7')}
            >
              <Icons.CalendarWeek className="size-4" />
              <span>Last 7 days</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={dateRange === 'last30'}
              onCheckedChange={() => setDateRange(dateRange === 'last30' ? 'all' : 'last30')}
            >
              <Icons.CalendarMonth className="size-4" />
              <span>Last 30 days</span>
            </DropdownMenuCheckboxItem>
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
                <DropdownMenuCheckboxItem
                  key={stack.id}
                  checked={stackFilter.has(stack.id)}
                  onCheckedChange={() => toggleStackFilter(stack.id)}
                >
                  <Icons.Stack className="size-4" />
                  <span>{stack.name}</span>
                </DropdownMenuCheckboxItem>
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
