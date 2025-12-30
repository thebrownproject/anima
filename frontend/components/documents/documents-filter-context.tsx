'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

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
}

const DocumentsFilterContext = createContext<DocumentsFilterContextValue | null>(null)

export function DocumentsFilterProvider({ children }: { children: ReactNode }) {
  const [filterValue, setFilterValueState] = useState('')
  const [selectedCount, setSelectedCountState] = useState(0)

  const setFilterValue = useCallback((value: string) => {
    setFilterValueState(value)
  }, [])

  const setSelectedCount = useCallback((count: number) => {
    setSelectedCountState(count)
  }, [])

  const contextValue = useMemo(() => ({
    filterValue,
    setFilterValue,
    selectedCount,
    setSelectedCount,
  }), [filterValue, setFilterValue, selectedCount, setSelectedCount])

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
