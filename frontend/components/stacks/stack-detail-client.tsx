'use client'

import type { StackWithDetails, StackTable, StackTableRow } from '@/types/stacks'

interface StackDetailClientProps {
  stack: StackWithDetails
  activeTab: string
  activeTable: StackTable | null | undefined
  tableRows: StackTableRow[] | null
}

/**
 * Client component for stack detail page.
 * TODO: Full implementation in Task 4
 */
export function StackDetailClient({
  stack,
  activeTab,
  activeTable,
  tableRows,
}: StackDetailClientProps) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{stack.name}</h1>
      <p className="text-muted-foreground mt-1">
        {stack.description || 'No description'}
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        <p>Active tab: {activeTab}</p>
        <p>Documents: {stack.documents.length}</p>
        <p>Tables: {stack.tables.length}</p>
        {activeTable && <p>Viewing table: {activeTable.name}</p>}
        {tableRows && <p>Table rows: {tableRows.length}</p>}
      </div>
    </div>
  )
}
