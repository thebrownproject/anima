'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ActionButton } from '@/components/layout/action-button'
import { useStacks } from '@/hooks/use-stacks'
import { useSupabase } from '@/hooks/use-supabase'
import type { StackSummary } from '@/types/stacks'
import * as Icons from '@/components/icons'

interface StacksDropdownProps {
  documentId: string
  assignedStacks: StackSummary[]
}

export function StacksDropdown({
  documentId,
  assignedStacks,
}: StacksDropdownProps) {
  const router = useRouter()
  const supabase = useSupabase()
  const { stacks, loading } = useStacks()
  const assignedIds = new Set(assignedStacks.map((s) => s.id))
  const [searchTerm, setSearchTerm] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure dropdown is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleToggleStack = async (stackId: string, stackName: string, shouldAssign: boolean) => {
    try {
      if (shouldAssign) {
        const { error } = await supabase
          .from('stack_documents')
          .insert({ document_id: documentId, stack_id: stackId })
        if (error) throw error
        toast.success(`Added to "${stackName}"`)
      } else {
        // Junction table delete requires BOTH conditions
        const { error } = await supabase
          .from('stack_documents')
          .delete()
          .eq('document_id', documentId)
          .eq('stack_id', stackId)
        if (error) throw error
        toast.success(`Removed from "${stackName}"`)
      }
      router.refresh()
    } catch (error) {
      console.error('Stack toggle failed:', error)
      toast.error(shouldAssign ? 'Failed to add to stack' : 'Failed to remove from stack')
    }
  }

  // Filter stacks by search term (case-insensitive)
  const filteredStacks = stacks.filter((stack) =>
    stack.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Button display logic
  const getDisplayText = () => {
    if (assignedStacks.length === 0) return 'No stacks'
    if (assignedStacks.length === 1) return assignedStacks[0].name
    return `${assignedStacks.length} Stacks`
  }

  // Tooltip text based on assignment state
  const getTooltipText = () => {
    if (assignedStacks.length === 0) return 'Assign to stacks'
    if (assignedStacks.length === 1) return `Assigned to ${assignedStacks[0].name}`
    return `Assigned to ${assignedStacks.map((s) => s.name).join(', ')}`
  }

  // No stacks exist and none assigned - show disabled ActionButton
  if (stacks.length === 0 && assignedStacks.length === 0 && !loading) {
    return (
      <ActionButton icon={<Icons.Stack />} disabled>
        No stacks
      </ActionButton>
    )
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) {
          setSearchTerm('')
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ActionButton icon={<Icons.Stack />}>
              {getDisplayText()}
            </ActionButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{getTooltipText()}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1">
          <Input
            ref={inputRef}
            placeholder="Search stacks..."
            aria-label="Search stacks"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') {
                setOpen(false)
              }
            }}
            className="h-5 text-sm border-0 shadow-none focus-visible:ring-0 pl-0.5 pr-0"
          />
        </div>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : filteredStacks.length > 0 ? (
          filteredStacks.map((stack) => (
            <DropdownMenuItem
              key={stack.id}
              onSelect={(e) => {
                e.preventDefault()
                handleToggleStack(stack.id, stack.name, !assignedIds.has(stack.id))
              }}
              className="group/item gap-2"
            >
              <Checkbox
                checked={assignedIds.has(stack.id)}
                className="pointer-events-none opacity-0 group-hover/item:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
              />
              <span className="flex-1">{stack.name}</span>
            </DropdownMenuItem>
          ))
        ) : searchTerm ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No matching stacks
          </div>
        ) : (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No stacks available
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
