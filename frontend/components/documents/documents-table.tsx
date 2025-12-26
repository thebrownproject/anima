'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ColumnFiltersState,
  ColumnSizingState,
  SortingState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { columns } from './columns'
import { SubBar } from './sub-bar'
import { FilterButton } from './filter-button'
import { SelectionActions } from './selection-actions'
import { UploadDialogTrigger } from './upload-dialog'
import type { Document } from '@/types/documents'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const COLUMN_SIZING_KEY = 'stackdocs-doc-list-columns'

interface DocumentsTableProps {
  documents: Document[]
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  // Initialize with empty state (same on server and client to prevent hydration mismatch)
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})

  // Read from localStorage after mount (client-only)
  React.useEffect(() => {
    const saved = localStorage.getItem(COLUMN_SIZING_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setColumnSizing(parsed)
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [])

  const table = useReactTable({
    data: documents,
    columns,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: (updater) => {
      setColumnSizing((old) => {
        const newSizing = typeof updater === 'function' ? updater(old) : updater
        if (typeof window !== 'undefined') {
          localStorage.setItem(COLUMN_SIZING_KEY, JSON.stringify(newSizing))
        }
        return newSizing
      })
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnSizing,
    },
  })

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Sub-bar */}
      <SubBar
        left={
          <>
            <FilterButton />
            <ExpandableSearch
              value={(table.getColumn('filename')?.getFilterValue() as string) ?? ''}
              onChange={(value) => table.getColumn('filename')?.setFilterValue(value)}
              placeholder="Search documents..."
            />
          </>
        }
        right={
          <>
            <SelectionActions
              selectedCount={table.getFilteredSelectedRowModel().rows.length}
            />
            <UploadDialogTrigger />
          </>
        }
      />

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent group/header">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 text-sm font-normal text-muted-foreground relative"
                    style={{
                      width: header.column.getCanResize() ? header.getSize() : undefined,
                      minWidth: header.column.getCanResize() ? undefined : header.getSize(),
                      maxWidth: header.column.getCanResize() ? undefined : header.getSize(),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                          'hover:bg-primary/50',
                          header.column.getIsResizing() && 'bg-primary'
                        )}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors duration-150 group/row"
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => router.push(`/documents/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="py-3"
                      style={{
                        width: cell.column.getCanResize() ? cell.column.getSize() : undefined,
                        minWidth: cell.column.getCanResize() ? undefined : cell.column.getSize(),
                        maxWidth: cell.column.getCanResize() ? undefined : cell.column.getSize(),
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center py-8">
                    <div className="rounded-full bg-muted/50 p-4 mb-4">
                      <FileText className="size-8 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-medium">No documents yet</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                      Upload a document to start extracting data
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  )
}
