'use client'

import * as React from 'react'
import * as Icons from '@/components/icons'
import { ActionButton } from './action-button'
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
  const [isExpanded, setIsExpanded] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleExpand = () => {
    setIsExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleBlur = () => {
    if (!value) {
      setIsExpanded(false)
    }
  }

  const handleClear = () => {
    onChange('')
    setIsExpanded(false)
  }

  if (!isExpanded && !value) {
    return (
      <ActionButton icon={<Icons.Search />} onClick={handleExpand} tooltip="Find documents by name">
        Search
      </ActionButton>
    )
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <Icons.Search className="absolute left-2 size-3.5 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="h-7 w-48 pl-7 pr-7 text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 text-muted-foreground hover:text-foreground"
        >
          <Icons.X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
