'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import type { StackSummary } from '@/types/stacks'

/**
 * Context for sharing filter and selection state between
 * the DocumentDetailSubBar (parallel route) and ExtractedDataTable (page).
 */
interface DocumentDetailFilterContextValue {
  // Search filter for field names
  fieldSearch: string
  setFieldSearch: (value: string) => void
  // Selection count from extracted data table
  selectedFieldCount: number
  setSelectedFieldCount: (count: number) => void
  // Assigned stacks for the current document
  assignedStacks: StackSummary[]
  setAssignedStacks: (stacks: StackSummary[]) => void
}

const DocumentDetailFilterContext = createContext<DocumentDetailFilterContextValue | null>(null)

export function DocumentDetailFilterProvider({ children }: { children: ReactNode }) {
  const [fieldSearch, setFieldSearchState] = useState('')
  const [selectedFieldCount, setSelectedFieldCountState] = useState(0)
  const [assignedStacks, setAssignedStacksState] = useState<StackSummary[]>([])

  const setFieldSearch = useCallback((value: string) => {
    setFieldSearchState(value)
  }, [])

  const setSelectedFieldCount = useCallback((count: number) => {
    setSelectedFieldCountState(count)
  }, [])

  const setAssignedStacks = useCallback((stacks: StackSummary[]) => {
    setAssignedStacksState(stacks)
  }, [])

  const contextValue = useMemo(() => ({
    fieldSearch,
    setFieldSearch,
    selectedFieldCount,
    setSelectedFieldCount,
    assignedStacks,
    setAssignedStacks,
  }), [fieldSearch, setFieldSearch, selectedFieldCount, setSelectedFieldCount, assignedStacks, setAssignedStacks])

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
