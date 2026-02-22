'use client'

import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { useChatStore, type ChatMessage } from '@/lib/stores/chat-store'
import { ChatBar } from './chat-bar'
import { GlassSidePanel } from './glass-side-panel'

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  if (message.role === 'system') {
    const isError = message.content.startsWith('[error]')
    return (
      <div className="py-1">
        <p className={cn(
          'text-center font-mono text-xs',
          isError ? 'text-destructive' : 'text-muted-foreground',
        )}>
          {message.content}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      {isUser ? (
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-border bg-secondary px-4 py-2.5 text-[13px] leading-relaxed text-secondary-foreground">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      ) : (
        <div className="w-full text-[13px] leading-relaxed text-foreground">
          <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_pre]:overflow-x-auto [&_code]:text-[12px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      )}
      <span className="mt-1 px-1 text-[10px] text-muted-foreground">{formatTime(message.timestamp)}</span>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-start">
      <div className="flex gap-1 rounded-2xl rounded-tl-sm border border-border bg-muted px-4 py-3">
        <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
        <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export function ChatPanel() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, mode, isAgentStreaming } = useChatStore()

  const isOpen = mode === 'panel'

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAgentStreaming])

  return (
    <>
      <GlassSidePanel
        isOpen={isOpen}
        onClose={() => {}}
        side="right"
        width="w-[400px]"
        showHeader={false}
        showClose={false}
        className="top-16 z-30"
        containerClassName={cn(
          'dark:bg-[rgb(10,10,10)]',
          isAgentStreaming && isOpen && 'border-primary/20 shadow-[0_8px_32px_rgba(0,0,0,0.08),0_0_20px_rgba(6,182,212,0.04)]',
        )}
      >
        {/* Agent streaming ambient glow */}
        {isAgentStreaming && (
          <div className="pointer-events-none absolute inset-0 animate-pulse rounded-3xl bg-gradient-to-b from-cyan-500/3 via-transparent to-purple-500/3" />
        )}

        {/* Messages — scroll area with bottom padding for chat bar */}
        <div className="relative flex flex-1 flex-col gap-3 overflow-y-auto p-4 pb-28">
          {messages.length === 0 && (
            <div className="flex-1" />
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isAgentStreaming && messages[messages.length - 1]?.role !== 'agent' && (
            <TypingIndicator />
          )}
          <div ref={messagesEndRef} />
        </div>
      </GlassSidePanel>

      {/* Chat bar — sibling to panel so backdrop-blur works (not nested) */}
      <div
        className={cn(
          'fixed bottom-6 right-4 z-30 w-[400px] p-3',
          'transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          isOpen
            ? 'translate-x-0 opacity-100'
            : 'translate-x-[110%] opacity-0 pointer-events-none',
        )}
      >
        <ChatBar embedded />
      </div>
    </>
  )
}
