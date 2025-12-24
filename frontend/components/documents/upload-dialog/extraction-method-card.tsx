// frontend/components/documents/upload-dialog/extraction-method-card.tsx
'use client'

import { cn } from '@/lib/utils'

interface ExtractionMethodCardProps {
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}

/**
 * Selectable card for choosing extraction method.
 * Linear-style: subtle background change when selected, no colored borders.
 */
export function ExtractionMethodCard({
  title,
  description,
  selected,
  onSelect,
}: ExtractionMethodCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors',
        'hover:bg-accent/50',
        selected
          ? 'border-border bg-accent/70'
          : 'border-border bg-background'
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}
