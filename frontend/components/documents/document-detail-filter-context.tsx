'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

/**
 * Context for sharing filter and selection state between
 * the DocumentDetailSubBar (parallel route) and ExtractedDataTable (page).
 *
 * Note: assignedStacks was removed from this context. The SubBar now fetches
 * stacks directly as a server component, following the pattern from Stacks.
 */
interface DocumentDetailFilterContextValue {
  // Search filter for field names
  fieldSearch: string
  setFieldSearch: (value: string) => void
  // Selection count from extracted data table
  selectedFieldCount: number
  setSelectedFieldCount: (count: number) => void
}

const DocumentDetailFilterContext = createContext<DocumentDetailFilterContextValue | null>(null)

export function DocumentDetailFilterProvider({ children }: { children: ReactNode }) {
  const [fieldSearch, setFieldSearchState] = useState('')
  const [selectedFieldCount, setSelectedFieldCountState] = useState(0)

  const setFieldSearch = useCallback((value: string) => {
    setFieldSearchState(value)
  }, [])

  const setSelectedFieldCount = useCallback((count: number) => {
    setSelectedFieldCountState(count)
  }, [])

  const contextValue = useMemo(() => ({
    fieldSearch,
    setFieldSearch,
    selectedFieldCount,
    setSelectedFieldCount,
  }), [fieldSearch, setFieldSearch, selectedFieldCount, setSelectedFieldCount])

  return (
    <DocumentDetailFilterContext.Provider value={contextValue}>
      {children}
    </DocumentDetailFilterContext.Provider>
  )
}

export function useDocumentDetailFilter() {
  const context = useContext(DocumentDetailFilterContext)
  if (!context) {
    throw new Error('useDocumentDetailFilter must be used within DocumentDetailFilterProvider')
  }
  return context
}
