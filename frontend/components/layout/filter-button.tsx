'use client'

import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'

const DATE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
] as const

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Extracted' },
  { value: 'processing', label: 'Processing' },
  { value: 'ocr_complete', label: 'OCR Complete' },
  { value: 'failed', label: 'Failed' },
] as const

export function FilterButton() {
  const {
    dateRange,
    setDateRange,
    statusFilter,
    toggleStatusFilter,
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
      <DropdownMenuContent align="start" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuLabel>Date</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
          {DATE_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={statusFilter.has(opt.value)}
            onCheckedChange={() => toggleStatusFilter(opt.value)}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}

        {activeFilterCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={clearFilters}
              className="text-muted-foreground"
            >
              Clear all filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
