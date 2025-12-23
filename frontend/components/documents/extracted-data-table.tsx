'use client'

import * as React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FileText, ChevronRight } from 'lucide-react'

interface ExtractedDataTableProps {
  fields: Record<string, unknown> | null
  confidenceScores: Record<string, number> | null
}

function NestedDataDialog({ label, data }: { label: string; data: unknown }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto p-1 gap-1">
          <Badge variant="secondary" className="font-mono text-xs">
            {Array.isArray(data) ? `${data.length} items` : 'Object'}
          </Badge>
          <ChevronRight className="size-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">{label.replace(/_/g, ' ')}</DialogTitle>
          <DialogDescription>Nested data structure</DialogDescription>
        </DialogHeader>
        <pre className="mt-4 rounded-lg bg-muted p-4 text-sm overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  )
}

function renderValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return <NestedDataDialog label={key} data={value} />
  }

  // Format currency values
  if (typeof value === 'string' && /^\$?[\d,]+\.?\d*$/.test(value)) {
    return <span className="font-mono tabular-nums">{value}</span>
  }

  return <span className="text-foreground">{String(value)}</span>
}

function ConfidenceIndicator({ score }: { score: number }) {
  const percentage = Math.round(score * 100)

  // Use CSS variables for dark mode compatibility
  const dotColor =
    score >= 0.9
      ? 'bg-green-500 dark:bg-green-400'
      : score >= 0.7
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-red-500 dark:bg-red-400'

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <span className={cn('size-1.5 rounded-full', dotColor)} />
      <span className="text-xs tabular-nums text-muted-foreground">{percentage}%</span>
    </div>
  )
}

export function ExtractedDataTable({
  fields,
  confidenceScores,
}: ExtractedDataTableProps) {
  if (!fields || Object.keys(fields).length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
        <FileText className="size-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm font-medium">No extracted data</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Run extraction to populate fields
        </p>
      </div>
    )
  }

  const entries = Object.entries(fields)

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 text-sm font-normal text-muted-foreground w-1/3">
              Field
            </TableHead>
            <TableHead className="h-10 text-sm font-normal text-muted-foreground">
              Value
            </TableHead>
            <TableHead className="h-10 text-sm font-normal text-muted-foreground w-28 text-right">
              Confidence
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => {
            const confidence = confidenceScores?.[key]
            return (
              <TableRow
                key={key}
                className="border-0 hover:bg-muted/50 transition-colors duration-150"
              >
                <TableCell className="py-3">
                  <span className="text-sm text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell className="py-3">{renderValue(key, value)}</TableCell>
                <TableCell className="py-3">
                  {confidence !== undefined ? (
                    <ConfidenceIndicator score={confidence} />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
