'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { AiActivityPanel } from './ai-activity-panel'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { cn } from '@/lib/utils'

interface AiChatBarProps {
  documentId: string
}

export function AiChatBar({ documentId }: AiChatBarProps) {
  const [message, setMessage] = useState('')
  const { status, events, error, submit, reset } = useAgentStream(documentId)

  const isDisabled = status === 'streaming'

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || isDisabled) return

    submit(trimmed)
    setMessage('')
  }, [message, isDisabled, submit])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isDisabled) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="relative">
      {/* Activity Panel - floats above input, centered, fixed width */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[480px] z-10">
        <AiActivityPanel
          status={status}
          events={events}
          error={error}
          onClose={reset}
        />
      </div>

      {/* Chat Input - matches original style */}
      <div className={cn(
        'flex items-center gap-3 px-1 border-t pt-4',
        isDisabled && 'opacity-50'
      )}>
        <Input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI to correct or refine extraction..."
          aria-label="AI chat input"
          disabled={isDisabled}
          className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
        />
        <kbd className="text-[11px] text-muted-foreground/40 font-mono px-1.5 py-0.5 rounded border border-border/50">
          Enter
        </kbd>
      </div>
    </div>
  )
}
