'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ColumnFiltersState,
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

interface DocumentsTableProps {
  documents: Document[]
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const table = useReactTable({
    data: documents,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    state: {
      sorting,
      columnFilters,
      rowSelection,
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
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30 group/header">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "h-9 text-sm font-normal text-muted-foreground",
                      header.column.id === 'select' && "w-4",
                      header.column.id === 'stacks' && "w-[25rem]",
                      header.column.id === 'uploaded_at' && "w-24 text-right pr-5"
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-b">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="h-12 cursor-pointer hover:bg-muted/30 transition-colors duration-150 group/row"
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => router.push(`/documents/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "py-3",
                        cell.column.id === 'select' && "w-4",
                        cell.column.id === 'stacks' && "w-[25rem]",
                        cell.column.id === 'uploaded_at' && "w-24"
                      )}
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
