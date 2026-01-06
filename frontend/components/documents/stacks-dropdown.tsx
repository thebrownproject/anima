'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
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

  // Button display logic
  const getDisplayText = () => {
    if (assignedStacks.length === 0) return 'No stacks'
    if (assignedStacks.length === 1) return assignedStacks[0].name
    return `${assignedStacks.length} Stacks`
  }

  // No stacks exist and none assigned - show plain text
  if (stacks.length === 0 && assignedStacks.length === 0 && !loading) {
    return (
      <span className="text-xs text-muted-foreground/60 px-2">
        No stacks
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={
            assignedStacks.length > 0
              ? `Manage stacks. Currently assigned: ${assignedStacks.map(s => s.name).join(', ')}`
              : 'Assign to stacks'
          }
          className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          {getDisplayText()}
          <Icons.ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Stacks
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : stacks.length > 0 ? (
          stacks.map((stack) => (
            <DropdownMenuCheckboxItem
              key={stack.id}
              checked={assignedIds.has(stack.id)}
              onCheckedChange={(checked) => handleToggleStack(stack.id, stack.name, checked)}
              className="text-sm"
            >
              {stack.name}
            </DropdownMenuCheckboxItem>
          ))
        ) : (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No stacks available
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
