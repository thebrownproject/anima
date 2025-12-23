'use client'

import { ColumnDef } from '@tanstack/react-table'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExtractedFieldRow } from '@/lib/transform-extracted-fields'

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence === undefined) return null

  const percentage = Math.round(confidence * 100)
  const colorClass =
    percentage >= 90
      ? 'text-emerald-600'
      : percentage >= 70
        ? 'text-amber-500'
        : 'text-red-500'

  return (
    <span className={cn('font-mono text-xs tabular-nums', colorClass)}>
      {percentage}%
    </span>
  )
}

export const extractedColumns: ColumnDef<ExtractedFieldRow>[] = [
  {
    accessorKey: 'field',
    header: () => <span className="text-muted-foreground">Field</span>,
    cell: ({ row }) => {
      const depth = row.original.depth
      const canExpand = row.getCanExpand()
      const isExpanded = row.getIsExpanded()

      return (
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          {canExpand ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                row.toggleExpanded()
              }}
              className="p-0.5 hover:bg-muted rounded"
              aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span className={cn(depth === 0 ? 'font-medium' : 'text-muted-foreground')}>
            {row.original.field}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'displayValue',
    header: () => <span className="text-muted-foreground">Value</span>,
    cell: ({ row }) => {
      const { displayValue, dataShape } = row.original

      // For string arrays shown inline
      if (dataShape === 'string-array' && row.original.depth > 0) {
        return (
          <span className="text-sm text-muted-foreground">{displayValue}</span>
        )
      }

      // For primitives (currency, numbers, etc.)
      if (dataShape === 'primitive') {
        const isCurrency =
          typeof displayValue === 'string' && /^\$?[\d,]+\.?\d*$/.test(displayValue)
        return (
          <span
            className={cn(
              'text-sm',
              isCurrency ? 'font-mono tabular-nums' : ''
            )}
          >
            {displayValue || '—'}
          </span>
        )
      }

      // Summary for expandable rows
      return (
        <span className="text-sm text-muted-foreground">{displayValue}</span>
      )
    },
  },
  {
    accessorKey: 'confidence',
    header: () => (
      <span className="text-muted-foreground text-right block">Conf.</span>
    ),
    cell: ({ row }) => (
      <div className="text-right">
        <ConfidenceBadge confidence={row.original.confidence} />
      </div>
    ),
    size: 60,
  },
]
