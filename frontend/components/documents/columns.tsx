'use client'

import { ColumnDef } from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FileTypeIcon } from '@/components/file-type-icon'
import { StackBadges } from '@/components/stack-badges'
import type { Document } from '@/types/documents'

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function SortIcon({ isSorted }: { isSorted: false | 'asc' | 'desc' }) {
  if (isSorted === 'asc') return <ArrowUp className="ml-2 size-3" />
  if (isSorted === 'desc') return <ArrowDown className="ml-2 size-3" />
  return <ChevronsUpDown className="ml-2 size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
}

export const columns: ColumnDef<Document>[] = [
  {
    id: 'select',
    enableResizing: false,
    size: 40,
    minSize: 40,
    maxSize: 40,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="opacity-0 group-hover/header:opacity-100 data-[state=checked]:opacity-100 data-[state=indeterminate]:opacity-100 transition-opacity"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover/row:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'filename',
    enableResizing: true,
    size: 300,
    minSize: 150,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-4 group"
      >
        Name
        <SortIcon isSorted={column.getIsSorted()} />
      </Button>
    ),
    cell: ({ row }) => {
      const doc = row.original
      return (
        <div className="flex items-center gap-2">
          <FileTypeIcon mimeType={doc.mime_type} />
          <span className="font-medium">{doc.filename}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'stacks',
    enableResizing: true,
    size: 150,
    minSize: 100,
    header: 'Stacks',
    cell: ({ row }) => <StackBadges stacks={row.original.stacks} />,
    enableSorting: false,
  },
  {
    accessorKey: 'uploaded_at',
    enableResizing: false,
    size: 100,
    minSize: 100,
    maxSize: 100,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-4 group"
      >
        Date
        <SortIcon isSorted={column.getIsSorted()} />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatRelativeDate(row.original.uploaded_at)}
      </span>
    ),
  },
]
