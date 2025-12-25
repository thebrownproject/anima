'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ExpandableSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function ExpandableSearch({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: ExpandableSearchProps) {
  const handleClear = () => {
    onChange('')
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="absolute left-2 size-3.5 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 w-48 pl-7 pr-7 text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
