'use client'

import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

  const hasActiveFilters = activeFilterCount > 0

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ActionButton icon={<Icons.Filter />}>
              {!hasActiveFilters && 'Filter'}
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
              onSelect={(e) => {
                e.preventDefault()
                setDateRange(dateRange === 'today' ? 'all' : 'today')
              }}
              className="group/item gap-2"
            >
              <Checkbox checked={dateRange === 'today'} className="pointer-events-none opacity-0 group-hover/item:opacity-100 data-[state=checked]:opacity-100 transition-opacity" />
              <Icons.Calendar className="size-4" />
              <span>Today</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setDateRange(dateRange === 'yesterday' ? 'all' : 'yesterday')
              }}
              className="group/item gap-2"
            >
              <Checkbox checked={dateRange === 'yesterday'} className="pointer-events-none opacity-0 group-hover/item:opacity-100 data-[state=checked]:opacity-100 transition-opacity" />
              <Icons.CalendarEvent className="size-4" />
              <span>Yesterday</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setDateRange(dateRange === 'last7' ? 'all' : 'last7')
              }}
              className="group/item gap-2"
            >
              <Checkbox checked={dateRange === 'last7'} className="pointer-events-none opacity-0 group-hover/item:opacity-100 data-[state=checked]:opacity-100 transition-opacity" />
              <Icons.CalendarWeek className="size-4" />
              <span>Last 7 days</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setDateRange(dateRange === 'last30' ? 'all' : 'last30')
              }}
              className="group/item gap-2"
            >
              <Checkbox checked={dateRange === 'last30'} className="pointer-events-none opacity-0 group-hover/item:opacity-100 data-[state=checked]:opacity-100 transition-opacity" />
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
                  onSelect={(e) => {
                    e.preventDefault()
                    toggleStackFilter(stack.id)
                  }}
                  className="group/item gap-2"
                >
                  <Checkbox checked={stackFilter.has(stack.id)} className="pointer-events-none opacity-0 group-hover/item:opacity-100 data-[state=checked]:opacity-100 transition-opacity" />
                  <Icons.Stack className="size-4" />
                  <span>{stack.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Clear - shown when filters are active */}
        {activeFilterCount > 0 && (
          <DropdownMenuItem onClick={clearFilters}>
            <Icons.FilterX className="size-4" />
            Clear
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
