'use client'

import type { StackTable, StackTableRow } from '@/types/stacks'

interface StackTableViewProps {
  table: StackTable
  rows: StackTableRow[]
  searchFilter: string
}

/**
 * Table view for stack detail page.
 * Displays extracted data in a tabular format.
 * TODO: Full implementation in Phase 3 (03-stack-tables.md)
 */
export function StackTableView({
  table,
  rows,
  searchFilter,
}: StackTableViewProps) {
  const filteredRows = searchFilter
    ? rows.filter((row) =>
        Object.values(row.row_data).some((value) =>
          String(value).toLowerCase().includes(searchFilter.toLowerCase())
        )
      )
    : rows

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-2">{table.name}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''}
        {table.columns && ` | ${table.columns.length} column${table.columns.length !== 1 ? 's' : ''}`}
      </p>
      <div className="text-sm text-muted-foreground">
        <p>Table mode: {table.mode}</p>
        <p>Status: {table.status}</p>
        {searchFilter && (
          <p className="mt-2">Filtering by: &quot;{searchFilter}&quot;</p>
        )}
      </div>
    </div>
  )
}
