'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { AiActivityPanel } from './ai-activity-panel'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { cn } from '@/lib/utils'

interface AiChatBarProps {
  documentId: string
}

export function AiChatBar({ documentId }: AiChatBarProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { status, events, error, submit, reset } = useAgentStream(documentId)

  const isDisabled = status === 'streaming'

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px` // max 4 lines
    }
  }, [message])

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || isDisabled) return

    submit(trimmed)
    setMessage('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [message, isDisabled, submit])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-3">
      {/* Activity Panel */}
      <AiActivityPanel
        status={status}
        events={events}
        error={error}
        onClose={reset}
      />

      {/* Chat Input */}
      <div
        className={cn(
          'rounded-lg border border-border bg-background px-3 py-2.5 transition-all duration-150',
          'focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-foreground/20',
          isDisabled && 'opacity-50'
        )}
      >
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI to correct or refine extraction..."
          aria-label="AI chat input"
          aria-describedby="chat-hint"
          disabled={isDisabled}
          rows={1}
          className="min-h-0 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
        />
        <span id="chat-hint" className="sr-only">
          Press Enter to send, Shift+Enter for new line
        </span>
      </div>
    </div>
  )
}
