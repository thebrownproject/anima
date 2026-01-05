'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import type { DocumentStatus } from '@/types/documents'

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
  // Status filter (multi-select, reuses existing DocumentStatus type)
  statusFilter: Set<DocumentStatus>
  setStatusFilter: (value: Set<DocumentStatus>) => void
  toggleStatusFilter: (status: DocumentStatus) => void
  // Active filter count for badge
  activeFilterCount: number
  // Clear all filters
  clearFilters: () => void
}

const DocumentsFilterContext = createContext<DocumentsFilterContextValue | null>(null)

export function DocumentsFilterProvider({ children }: { children: ReactNode }) {
  const [filterValue, setFilterValueState] = useState('')
  const [selectedCount, setSelectedCountState] = useState(0)
  const [dateRange, setDateRangeState] = useState<DateRangeFilter>('all')
  const [statusFilter, setStatusFilterState] = useState<Set<DocumentStatus>>(new Set())

  const setFilterValue = useCallback((value: string) => {
    setFilterValueState(value)
  }, [])

  const setSelectedCount = useCallback((count: number) => {
    setSelectedCountState(count)
  }, [])

  const setDateRange = useCallback((value: DateRangeFilter) => {
    setDateRangeState(value)
  }, [])

  const setStatusFilter = useCallback((value: Set<DocumentStatus>) => {
    setStatusFilterState(value)
  }, [])

  const toggleStatusFilter = useCallback((status: DocumentStatus) => {
    setStatusFilterState((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setDateRangeState('all')
    setStatusFilterState(new Set())
  }, [])

  // Count active filters (non-default values)
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (dateRange !== 'all') count++
    if (statusFilter.size > 0) count++
    return count
  }, [dateRange, statusFilter])

  const contextValue = useMemo(() => ({
    filterValue,
    setFilterValue,
    selectedCount,
    setSelectedCount,
    dateRange,
    setDateRange,
    statusFilter,
    setStatusFilter,
    toggleStatusFilter,
    activeFilterCount,
    clearFilters,
  }), [
    filterValue,
    setFilterValue,
    selectedCount,
    setSelectedCount,
    dateRange,
    setDateRange,
    statusFilter,
    setStatusFilter,
    toggleStatusFilter,
    activeFilterCount,
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
