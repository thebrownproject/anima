'use client'

import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  ExpandedState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { extractedColumns } from './extracted-columns'
import { transformExtractedFields } from '@/lib/transform-extracted-fields'

interface ExtractedDataTableProps {
  fields: Record<string, unknown> | null
  confidenceScores: Record<string, number> | null
  changedFields?: Set<string>
}

export function ExtractedDataTable({
  fields,
  confidenceScores,
  changedFields = new Set(),
}: ExtractedDataTableProps) {
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  const data = React.useMemo(
    () => transformExtractedFields(fields, confidenceScores),
    [fields, confidenceScores]
  )

  const table = useReactTable({
    data,
    columns: extractedColumns,
    state: {
      expanded,
    },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  })

  if (!fields || Object.keys(fields).length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No data extracted</p>
      </div>
    )
  }

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-10 text-sm font-normal text-muted-foreground"
                  style={{ width: header.column.getSize() }}
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
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              // Check if this row or its parent is in changedFields
              const rootId = row.original.id.split('-')[0]
              const isChanged = changedFields.has(rootId)

              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    'hover:bg-muted/30 transition-colors',
                    row.getCanExpand() && 'cursor-pointer',
                    isChanged && 'animate-highlight-fade'
                  )}
                  onClick={() => {
                    if (row.getCanExpand()) {
                      row.toggleExpanded()
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5 whitespace-normal">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={extractedColumns.length} className="h-24 text-center">
                <p className="text-sm text-muted-foreground">No data extracted</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
