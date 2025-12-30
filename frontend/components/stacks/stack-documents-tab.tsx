'use client'

import Link from 'next/link'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
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
import { FileTypeIcon } from '@/components/shared/file-type-icon'
import { Badge } from '@/components/ui/badge'
import * as Icons from '@/components/icons'
import { formatRelativeDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StackDocument } from '@/types/stacks'

interface StackDocumentsTabProps {
  documents: StackDocument[]
  stackId: string // Reserved for future "Add Document" action
  searchFilter: string
}

const columns: ColumnDef<StackDocument>[] = [
  {
    accessorKey: 'document.filename',
    header: 'Name',
    cell: ({ row }) => {
      const doc = row.original.document
      return (
        <div className="flex items-center gap-2">
          <FileTypeIcon mimeType={doc.mime_type} className="shrink-0" />
          <Link
            href={`/documents/${doc.id}`}
            className="font-medium hover:underline truncate"
          >
            {doc.filename}
          </Link>
        </div>
      )
    },
  },
  {
    accessorKey: 'document.status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.document.status === 'completed' ? 'secondary' : 'outline'
        }
      >
        {row.original.document.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'added_at',
    header: 'Added',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatRelativeDate(row.original.added_at)}
      </span>
    ),
  },
]

// stackId reserved for future "Add Document" action
export function StackDocumentsTab({ documents, searchFilter }: StackDocumentsTabProps) {
  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _, filterValue) => {
      return row.original.document.filename
        .toLowerCase()
        .includes(filterValue.toLowerCase())
    },
    state: { globalFilter: searchFilter },
  })

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="rounded-full bg-muted/50 p-4 mb-4">
          <Icons.Files className="size-8 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium">No documents in this stack</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add documents to start extracting data
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="bg-muted/30 hover:bg-muted/30"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-9 text-sm font-normal text-muted-foreground",
                    header.column.id === 'document.filename' && "pl-4",
                    header.column.id === 'added_at' && "w-24 text-right pr-4"
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
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="h-12 hover:bg-muted/30">
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "py-3",
                      cell.column.id === 'document.filename' && "pl-4",
                      cell.column.id === 'added_at' && "w-24 text-right pr-4"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                <p className="text-sm text-muted-foreground">
                  No documents match your search
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
