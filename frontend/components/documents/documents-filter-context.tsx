'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

// Date range filter options
export type DateRangeFilter = 'all' | 'today' | 'yesterday' | 'last7' | 'last30'

/**
 * Context for sharing filter and selection state between
 * the DocumentsSubBar (parallel route) and DocumentsTable (page).
 */
interface DocumentsFilterContextValue {
  // Search filter for filename column
  filterValue: string
  setFilterValue: (value: string) => void
  // Selection count from table
  selectedCount: number
  setSelectedCount: (count: number) => void
  // Date range filter
  dateRange: DateRangeFilter
  setDateRange: (value: DateRangeFilter) => void
  // Stack filter (multi-select by stack ID)
  stackFilter: Set<string>
  toggleStackFilter: (stackId: string) => void
  // Active filter count for badge
  activeFilterCount: number
  // Clear individual filters
  clearDateFilter: () => void
  clearStackFilter: (stackId: string) => void
  // Clear all filters
  clearFilters: () => void
}

const DocumentsFilterContext = createContext<DocumentsFilterContextValue | null>(null)

export function DocumentsFilterProvider({ children }: { children: ReactNode }) {
  const [filterValue, setFilterValueState] = useState('')
  const [selectedCount, setSelectedCountState] = useState(0)
  const [dateRange, setDateRangeState] = useState<DateRangeFilter>('all')
  const [stackFilter, setStackFilterState] = useState<Set<string>>(new Set())

  const setFilterValue = useCallback((value: string) => {
    setFilterValueState(value)
  }, [])

  const setSelectedCount = useCallback((count: number) => {
    setSelectedCountState(count)
  }, [])

  const setDateRange = useCallback((value: DateRangeFilter) => {
    setDateRangeState(value)
  }, [])

  const toggleStackFilter = useCallback((stackId: string) => {
    setStackFilterState((prev) => {
      const next = new Set(prev)
      if (next.has(stackId)) {
        next.delete(stackId)
      } else {
        next.add(stackId)
      }
      return next
    })
  }, [])

  const clearDateFilter = useCallback(() => {
    setDateRangeState('all')
  }, [])

  const clearStackFilter = useCallback((stackId: string) => {
    setStackFilterState((prev) => {
      const next = new Set(prev)
      next.delete(stackId)
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setDateRangeState('all')
    setStackFilterState(new Set())
  }, [])

  // Count active filters (non-default values)
  // Stack filter counts each selected stack as one filter
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (dateRange !== 'all') count++
    count += stackFilter.size
    return count
  }, [dateRange, stackFilter])

  const contextValue = useMemo(() => ({
    filterValue,
    setFilterValue,
    selectedCount,
    setSelectedCount,
    dateRange,
    setDateRange,
    stackFilter,
    toggleStackFilter,
    activeFilterCount,
    clearDateFilter,
    clearStackFilter,
    clearFilters,
  }), [
    filterValue,
    setFilterValue,
    selectedCount,
    setSelectedCount,
    dateRange,
    setDateRange,
    stackFilter,
    toggleStackFilter,
    activeFilterCount,
    clearDateFilter,
    clearStackFilter,
    clearFilters,
  ])

  return (
    <DocumentsFilterContext.Provider value={contextValue}>
      {children}
    </DocumentsFilterContext.Provider>
  )
}

export function useDocumentsFilter() {
  const context = useContext(DocumentsFilterContext)
  if (!context) {
    throw new Error('useDocumentsFilter must be used within DocumentsFilterProvider')
  }
  return context
}
