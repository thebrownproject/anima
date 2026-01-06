'use client'

import { useState, useRef, useEffect } from 'react'
import { SubBar } from '@/components/layout/sub-bar'
import { SelectionActions } from '@/components/layout/selection-actions'
import { DocumentDetailActions } from '@/components/documents/document-detail-actions'
import { useDocumentDetailFilter } from '@/components/documents/document-detail-filter-context'
import { ActionButton } from '@/components/layout/action-button'
import { FilterPill } from '@/components/layout/filter-pill'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import * as Icons from '@/components/icons'
import type { StackSummary } from '@/types/stacks'

function DetailFilterButton() {
  const { fieldSearch, setFieldSearch } = useDocumentDetailFilter()
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [open])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <ActionButton icon={<Icons.Filter />}>
          {!fieldSearch && 'Filter'}
        </ActionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="px-2 py-1">
          <Input
            ref={inputRef}
            placeholder="Search fields..."
            aria-label="Search fields"
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') {
                setOpen(false)
              }
            }}
            className="h-5 text-sm border-0 shadow-none focus-visible:ring-0 pl-0.5 pr-0"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface DocumentDetailSubBarProps {
  documentId: string
  assignedStacks: StackSummary[]
}

/**
 * Client component for document detail SubBar.
 * Receives server-fetched data (assignedStacks) as props.
 * Uses context for client-side state (fieldSearch, selectedFieldCount).
 */
export function DocumentDetailSubBar({ documentId, assignedStacks }: DocumentDetailSubBarProps) {
  const { fieldSearch, setFieldSearch, selectedFieldCount } = useDocumentDetailFilter()

  return (
    <SubBar
      left={
        <>
          <DetailFilterButton />
          {fieldSearch && (
            <FilterPill
              icon={<Icons.Search className="size-full" />}
              label={`"${fieldSearch}"`}
              onRemove={() => setFieldSearch('')}
            />
          )}
        </>
      }
      right={
        <>
          <SelectionActions selectedCount={selectedFieldCount} />
          <DocumentDetailActions documentId={documentId} assignedStacks={assignedStacks} />
        </>
      }
    />
  )
}
