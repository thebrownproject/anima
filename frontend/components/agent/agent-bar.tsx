// frontend/components/agent/agent-bar.tsx
'use client'

import { useCallback, useState } from 'react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAgentStore, useAgentStatus, useAgentPopup, type AgentStatus } from './stores/agent-store'
import { AgentActions } from './agent-actions'

interface AgentBarProps {
  className?: string
}

export function AgentBar({ className }: AgentBarProps) {
  const [message, setMessage] = useState('')
  const { status, statusText } = useAgentStatus()
  const { isExpanded, isPopupOpen } = useAgentPopup()
  const setExpanded = useAgentStore((s) => s.setExpanded)
  const expandPopup = useAgentStore((s) => s.expandPopup)
  const flow = useAgentStore((s) => s.flow)

  const isDisabled = status === 'processing'
  const showActions = isExpanded && !flow // Only show actions when no flow is active

  const handleFocus = useCallback(() => {
    setExpanded(true)
  }, [setExpanded])

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Don't collapse if focus moves within the bar
    if (e.currentTarget.contains(e.relatedTarget)) return
    setExpanded(false)
  }, [setExpanded])

  const handleExpandClick = useCallback(() => {
    if (flow) {
      expandPopup()
    }
  }, [flow, expandPopup])

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || isDisabled) return
    // TODO: Natural language processing (post-MVP)
    setMessage('')
  }, [message, isDisabled])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isDisabled) {
      e.preventDefault()
      handleSubmit()
    }
  }, [isDisabled, handleSubmit])

  // Status icon based on current state
  const StatusIcon = getStatusIcon(status)
  const statusIconClass = getStatusIconClass(status)

  return (
    <div
      className={cn('relative', className)}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div
        className={cn(
          'flex flex-col',
          'bg-sidebar border rounded-xl shadow-md',
          'transition-colors duration-150',
          'hover:border-muted-foreground/30',
          'focus-within:border-muted-foreground/30',
          isDisabled && 'opacity-50'
        )}
      >
        {/* Action buttons - shown when expanded and no flow active */}
        {showActions && (
          <div className="px-3 pt-3 pb-1">
            <AgentActions />
          </div>
        )}

        {/* Main input row */}
        <div className="flex items-center pl-[30px] pr-3.5 py-3">
          <StatusIcon
            className={cn(
              'size-4 transition-colors shrink-0',
              statusIconClass,
              status === 'processing' && 'animate-spin'
            )}
          />
          <Tooltip delayDuration={500} open={!message ? undefined : false}>
            <TooltipTrigger asChild>
              <Input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={statusText}
                aria-label="AI chat input"
                disabled={isDisabled}
                className="flex-1 border-none !bg-transparent shadow-none focus-visible:ring-0 !text-base text-foreground placeholder:text-muted-foreground -ml-1"
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={8}
              className="text-center max-w-[280px]"
            >
              Ask your AI agent to help with documents
            </TooltipContent>
          </Tooltip>

          {/* Expand/Send button */}
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                onClick={message.trim() ? handleSubmit : handleExpandClick}
                disabled={isDisabled && !flow}
                className="size-8 rounded-full shrink-0"
                aria-label={message.trim() ? 'Send message' : 'Expand'}
              >
                {message.trim() ? (
                  <Icons.ArrowUp className="size-5" />
                ) : (
                  <Icons.ChevronUp className={cn(
                    'size-5 transition-transform',
                    isPopupOpen && 'rotate-180'
                  )} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {message.trim() ? 'Send message' : (isPopupOpen ? 'Collapse' : 'Expand')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

function getStatusIcon(status: AgentStatus) {
  switch (status) {
    case 'processing': return Icons.Loader2
    case 'waiting': return Icons.QuestionMark
    case 'complete': return Icons.Check
    case 'error': return Icons.X
    case 'idle': return Icons.Stack
  }
}

function getStatusIconClass(status: AgentStatus) {
  switch (status) {
    case 'processing': return 'text-muted-foreground'
    case 'complete': return 'text-green-500'
    case 'error': return 'text-destructive'
    case 'idle':
    case 'waiting': return 'text-muted-foreground group-hover:text-foreground group-focus-within:text-foreground'
  }
}
