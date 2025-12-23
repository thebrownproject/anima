'use client'

import * as React from 'react'
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
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExtractedDataTableProps {
  fields: Record<string, unknown> | null
  confidenceScores: Record<string, number> | null
  changedFields?: Set<string>
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

function formatKey(key: string): string {
  return key.replace(/_/g, ' ')
}

function renderValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/50">—</span>
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return <NestedDataDialog label={key} data={value} />
  }

  // Format currency values
  if (typeof value === 'string' && /^\$?[\d,]+\.?\d*$/.test(value)) {
    return <span className="font-mono tabular-nums">{value}</span>
  }

  return <span>{String(value)}</span>
}

export function ExtractedDataTable({
  fields,
  confidenceScores,
  changedFields = new Set(),
}: ExtractedDataTableProps) {
  if (!fields || Object.keys(fields).length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No data extracted</p>
      </div>
    )
  }

  const entries = Object.entries(fields)

  return (
    <div className="divide-y divide-border/50">
      {entries.map(([key, value]) => {
        const confidence = confidenceScores?.[key]
        return (
          <div
            key={key}
            className={cn(
              "flex items-center justify-between py-2.5 px-1 group transition-colors duration-1000",
              changedFields.has(key) && "bg-primary/10"
            )}
          >
            <span className="text-[13px] text-muted-foreground capitalize">
              {formatKey(key)}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-foreground font-medium text-right">
                {renderValue(key, value)}
              </span>
              {confidence !== undefined && (
                <span className="text-[11px] text-muted-foreground/50 tabular-nums w-8 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                  {Math.round(confidence * 100)}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
