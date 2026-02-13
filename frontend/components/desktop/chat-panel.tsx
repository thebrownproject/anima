'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useChatStore, type ChatMessage } from '@/lib/stores/chat-store'
import { ChatBar } from './chat-bar'
import { GlassIconButton } from '@/components/ui/glass-icon-button'
import * as Icons from '@/components/icons'

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// =============================================================================
// Message bubble
// =============================================================================

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  if (message.role === 'system') {
    return (
      <div className="py-1">
        <p className="text-center font-mono text-[11px] text-white/25">{message.content}</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl border px-4 py-2.5 text-[13px] leading-relaxed',
          isUser
            ? 'rounded-tr-sm border-white/20 bg-white/15 text-white'
            : 'rounded-tl-sm border-white/10 bg-white/5 text-white/90'
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
      <span className="mt-1 px-1 text-[10px] text-white/25">{formatTime(message.timestamp)}</span>
    </div>
  )
}

// =============================================================================
// Typing indicator
// =============================================================================

function TypingIndicator() {
  return (
    <div className="flex items-start">
      <div className="flex gap-1 rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-4 py-3">
        <div className="size-1.5 animate-pulse rounded-full bg-white/40" />
        <div className="size-1.5 animate-pulse rounded-full bg-white/40 [animation-delay:150ms]" />
        <div className="size-1.5 animate-pulse rounded-full bg-white/40 [animation-delay:300ms]" />
      </div>
    </div>
  )
}

// =============================================================================
// Chat panel
// =============================================================================

export function ChatPanel() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, mode, isAgentStreaming, setMode } = useChatStore()

  const isOpen = mode === 'panel'

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAgentStreaming])

  return (
    <div
      className={cn(
        'fixed right-4 top-20 bottom-6 z-30 flex w-[400px] flex-col overflow-hidden',
        'rounded-3xl border border-white/20 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl',
        'transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        isOpen
          ? 'translate-x-0 opacity-100'
          : 'translate-x-[110%] opacity-0 pointer-events-none',
        isAgentStreaming && isOpen && 'border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(6,182,212,0.06)]',
      )}
    >
      {/* Agent streaming ambient glow */}
      {isAgentStreaming && (
        <div className="pointer-events-none absolute inset-0 animate-pulse rounded-3xl bg-gradient-to-b from-cyan-500/5 via-transparent to-purple-500/5" />
      )}

      {/* Header */}
      <div className="relative flex h-14 shrink-0 items-center justify-end px-5">
        <GlassIconButton
          icon={<Icons.LayoutBottombar  />}
          tooltip="Dock to bottom"
          onClick={() => setMode('bar')}
          className="-mr-2"
        />
      </div>

      {/* Messages */}
      <div className="relative flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex-1" />
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isAgentStreaming && messages[messages.length - 1]?.role !== 'agent' && (
          <TypingIndicator />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — reuse ChatBar in embedded mode */}
      <div className="shrink-0 p-3">
        <ChatBar embedded />
      </div>
    </div>
  )
}
