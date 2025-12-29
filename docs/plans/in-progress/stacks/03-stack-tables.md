# Stack Tables Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the table view component with dynamic columns, "not extracted" indicator, and CSV export.

**Architecture:** TanStack Table with columns generated from `stack_tables.columns` schema. Rows show extraction status per document.

**Tech Stack:** TanStack Table v8, shadcn/ui, papaparse for CSV export

---

## Task 1: Create Stack Table View Component

**Files:**
- Create: `frontend/components/stacks/stack-table-view.tsx`

**Step 1: Implement table view with dynamic columns**

```typescript
// frontend/components/stacks/stack-table-view.tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, useReactTable, SortingState,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import type { StackTable, StackTableRow, StackTableColumn } from '@/types/stacks'

interface StackTableViewProps {
  table: StackTable
  rows: StackTableRow[]
  searchFilter: string
}

function generateColumns(tableSchema: StackTableColumn[] | null): ColumnDef<StackTableRow>[] {
  const baseColumns: ColumnDef<StackTableRow>[] = [
    {
      id: 'document',
      accessorKey: 'document.filename',
      header: 'Document',
      cell: ({ row }) => (
        <Link
          href={`/documents/${row.original.document_id}`}
          className="font-medium hover:underline truncate max-w-[200px] block"
        >
          {row.original.document.filename}
        </Link>
      ),
    },
  ]

  if (!tableSchema || tableSchema.length === 0) {
    return baseColumns
  }

  const dataColumns: ColumnDef<StackTableRow>[] = tableSchema.map((col) => ({
    id: col.name,
    accessorFn: (row) => row.row_data?.[col.name] ?? null,
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        {col.name}
        {column.getIsSorted() === 'asc' ? (
          <Icons.ChevronUp className="ml-1 size-4" />
        ) : column.getIsSorted() === 'desc' ? (
          <Icons.ChevronDown className="ml-1 size-4" />
        ) : (
          <Icons.ChevronsUpDown className="ml-1 size-4 opacity-50" />
        )}
      </Button>
    ),
    cell: ({ row }) => {
      const value = row.original.row_data?.[col.name]
      const confidence = row.original.confidence_scores?.[col.name]

      if (value === null || value === undefined) {
        return <span className="text-muted-foreground italic">—</span>
      }

      return (
        <div className="flex items-center gap-1">
          <span className="truncate max-w-[200px]">{String(value)}</span>
          {confidence !== undefined && confidence < 0.8 && (
            <Tooltip>
              <TooltipTrigger>
                <Icons.AlertCircle className="size-3 text-yellow-500" />
              </TooltipTrigger>
              <TooltipContent>Low confidence: {Math.round(confidence * 100)}%</TooltipContent>
            </Tooltip>
          )}
        </div>
      )
    },
  }))

  return [...baseColumns, ...dataColumns]
}

export function StackTableView({ table: tableSchema, rows, searchFilter }: StackTableViewProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const columns = React.useMemo(
    () => generateColumns(tableSchema.columns),
    [tableSchema.columns]
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    globalFilterFn: (row, _, filterValue) => {
      const filename = row.original.document.filename.toLowerCase()
      const rowData = JSON.stringify(row.original.row_data).toLowerCase()
      return filename.includes(filterValue.toLowerCase()) || rowData.includes(filterValue.toLowerCase())
    },
    state: { sorting, globalFilter: searchFilter },
  })

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="rounded-full bg-muted/50 p-4 mb-4">
          <Icons.Table className="size-8 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium">No data extracted yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add documents and extract data to populate this table
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="h-9 text-sm font-normal text-muted-foreground">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="h-12 hover:bg-muted/30">
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/stack-table-view.tsx
git commit -m "feat(stacks): create table view with dynamic columns"
```

---

## Task 2: Add "Not Extracted" Indicator

**Files:**
- Modify: `frontend/components/stacks/stack-table-view.tsx`

**Step 1: Update to show pending extraction status**

The component should track which documents in the stack don't have rows in this table yet. This requires passing additional data from the page.

Update the page to pass `pendingDocuments`:

```typescript
// In stack detail page, calculate pending docs
const documentsInTable = new Set(tableRows?.map(r => r.document_id) || [])
const pendingDocuments = stack.documents.filter(d => !documentsInTable.has(d.document_id))
```

Then add a "pending" section to the table view:

```typescript
// Add to StackTableView props
interface StackTableViewProps {
  table: StackTable
  rows: StackTableRow[]
  pendingDocuments?: StackDocument[]
  searchFilter: string
  onExtractPending?: () => void
}

// Add pending indicator row at bottom of table
{pendingDocuments && pendingDocuments.length > 0 && (
  <TableRow className="bg-yellow-500/5 border-yellow-500/20">
    <TableCell colSpan={columns.length} className="py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-yellow-600">
          <Icons.Clock className="size-4" />
          <span className="text-sm">
            {pendingDocuments.length} document{pendingDocuments.length !== 1 ? 's' : ''} pending extraction
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onExtractPending}>
          Extract Now
        </Button>
      </div>
    </TableCell>
  </TableRow>
)}
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/stack-table-view.tsx
git commit -m "feat(stacks): add pending extraction indicator"
```

---

## Task 3: Add CSV Export Functionality

**Files:**
- Create: `frontend/lib/export-csv.ts`
- Modify: `frontend/components/stacks/stack-detail-client.tsx`

**Step 1: Create CSV export utility**

```typescript
// frontend/lib/export-csv.ts

import type { StackTableRow, StackTableColumn } from '@/types/stacks'

export function exportTableToCsv(
  tableName: string,
  columns: StackTableColumn[],
  rows: StackTableRow[]
): void {
  // Build header row
  const headers = ['Document', ...columns.map(c => c.name)]

  // Build data rows
  const dataRows = rows.map(row => {
    const values = [
      row.document.filename,
      ...columns.map(col => {
        const value = row.row_data?.[col.name]
        if (value === null || value === undefined) return ''
        return String(value)
      })
    ]
    return values
  })

  // Combine and escape for CSV
  const csvContent = [headers, ...dataRows]
    .map(row => row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma/quote/newline
      const escaped = String(cell).replace(/"/g, '""')
      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
        return `"${escaped}"`
      }
      return escaped
    }).join(','))
    .join('\n')

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${tableName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

**Step 2: Wire up export button**

```typescript
// In stack-detail-client.tsx, update the Export button
{isTableActive && (
  <Button
    variant="outline"
    size="sm"
    className="gap-1.5"
    onClick={() => {
      if (activeTable?.columns && tableRows) {
        exportTableToCsv(activeTable.name, activeTable.columns, tableRows)
      }
    }}
  >
    <Icons.Download className="size-4" />
    Export CSV
  </Button>
)}
```

**Step 3: Commit**

```bash
git add frontend/lib/export-csv.ts frontend/components/stacks/stack-detail-client.tsx
git commit -m "feat(stacks): add CSV export functionality"
```

---

## Task 4: Create Stacks Component Index

**Files:**
- Create: `frontend/components/stacks/index.ts`

**Step 1: Create barrel export**

```typescript
// frontend/components/stacks/index.ts
export { StackDetailClient } from './stack-detail-client'
export { StackDocumentsTab } from './stack-documents-tab'
export { StackTableView } from './stack-table-view'
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/index.ts
git commit -m "feat(stacks): add component barrel export"
```
