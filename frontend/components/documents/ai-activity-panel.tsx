'use client'

import { useState, useEffect } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Check, ChevronDown, Loader2, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentEvent } from '@/lib/agent-api'
import type { AgentStatus } from '@/hooks/use-agent-stream'

interface AiActivityPanelProps {
  status: AgentStatus
  events: AgentEvent[]
  error: string | null
  onClose: () => void
}

export function AiActivityPanel({
  status,
  events,
  error,
  onClose,
}: AiActivityPanelProps) {
  const [isOpen, setIsOpen] = useState(true)

  // Auto-collapse 3s after completion
  useEffect(() => {
    if (status === 'complete') {
      const timer = setTimeout(() => {
        setIsOpen(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  // Expand when streaming starts
  useEffect(() => {
    if (status === 'streaming') {
      setIsOpen(true)
    }
  }, [status])

  // Don't render if idle
  if (status === 'idle') {
    return null
  }

  const isStreaming = status === 'streaming'
  const isComplete = status === 'complete'
  const isError = status === 'error'

  // Filter events for display
  const toolEvents = events.filter((e) => e.type === 'tool')
  const textEvents = events.filter((e) => e.type === 'text')

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl border border-border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <CollapsibleTrigger asChild disabled={isStreaming}>
            <button
              className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
              aria-expanded={isOpen}
            >
              {isStreaming && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {isComplete && <Check className="size-4 text-green-500" />}
              {isError && <AlertCircle className="size-4 text-destructive" />}

              <span>
                {isStreaming && 'Processing...'}
                {isComplete && 'Update complete'}
                {isError && 'Error'}
              </span>

              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform duration-150',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
          </CollapsibleTrigger>

          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onClose}
            aria-label="Close activity panel"
          >
            <X className="size-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3 max-h-64 overflow-y-auto">
            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Tool events with checkmarks */}
            {toolEvents.length > 0 && (
              <div className="space-y-1.5">
                {toolEvents.map((event, i) => (
                  <div
                    key={`tool-${i}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-150"
                  >
                    <Check className="size-3.5 text-green-500 shrink-0" />
                    <span>{event.content}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Text events with bullets */}
            {textEvents.length > 0 && (
              <div className="space-y-1.5">
                {textEvents.map((event, i) => (
                  <div
                    key={`text-${i}`}
                    className="flex items-start gap-2 text-sm animate-in fade-in duration-150"
                  >
                    <span className="text-muted-foreground shrink-0">•</span>
                    <span className="text-foreground">{event.content}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state while streaming */}
            {isStreaming && events.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Connecting to agent...
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
