'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/lib/stores/chat-store'
import {
  GlassTooltip,
  GlassTooltipTrigger,
  GlassTooltipContent,
} from '@/components/ui/glass-tooltip'
import { GlassButton } from '@/components/ui/glass-button'
import { useWebSocket } from './ws-provider'

export function ChatBar() {
  const [inputValue, setInputValue] = useState('')
  const [inputActive, setInputActive] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { send } = useWebSocket()
  const { chips, mode, isAgentStreaming, addMessage, setMode } = useChatStore()

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text) return

    addMessage({ role: 'user', content: text, timestamp: Date.now() })
    send({ type: 'mission', payload: { text } })
    setInputValue('')
    setInputActive(false)
    inputRef.current?.blur()
  }, [inputValue, addMessage, send])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const activateInput = () => {
    setInputActive(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleBlur = () => {
    if (!inputValue) setInputActive(false)
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [inputValue])

  // Hide bar when chat panel is open
  if (mode === 'panel') return null

  const hasText = inputValue.trim().length > 0

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 pb-6">
        {/* Suggestion chips — float above */}
        {chips.length > 0 && !inputActive && (
          <div className="pointer-events-auto flex items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.action}
                onClick={() => {
                  addMessage({ role: 'user', content: chip.action, timestamp: Date.now() })
                  send({ type: 'mission', payload: { text: chip.action } })
                }}
                className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-[13px] font-medium text-white/70 backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:bg-white/12 hover:text-white/90 active:scale-95"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Chat bar */}
        <div
          className={cn(
            'pointer-events-auto relative w-[500px] overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-all duration-300',
            isAgentStreaming && 'border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(6,182,212,0.08)]',
          )}
        >
          {/* Agent streaming glow */}
          {isAgentStreaming && (
            <div className="absolute inset-0 animate-pulse rounded-3xl bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5" />
          )}

          <div className="relative">
            {/* Text area — only visible when input active */}
            {inputActive && (
              <div className="px-5 pt-4 pb-1 pr-16">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  rows={1}
                  className="w-full resize-none bg-transparent text-[15px] text-white outline-none placeholder:text-white/30"
                />
              </div>
            )}

            {/* Send button — top right, aligned with message icon below */}
            {hasText && inputActive && (
              <GlassTooltip>
                <GlassTooltipTrigger asChild>
                  <GlassButton
                    variant="ghost"
                    size="icon"
                    onClick={handleSend}
                    className="absolute right-3 top-3 size-10 rounded-full bg-white/15 hover:bg-white/25"
                  >
                    <Icons.ArrowUp className="size-[22px] text-white" />
                  </GlassButton>
                </GlassTooltipTrigger>
                <GlassTooltipContent side="right">Send</GlassTooltipContent>
              </GlassTooltip>
            )}

            {/* Action bar */}
            <div className="flex items-center px-3 py-2.5">
              {/* Left — Attach */}
              <GlassTooltip>
                <GlassTooltipTrigger asChild>
                  <GlassButton variant="ghost" size="icon" className="size-10 rounded-full">
                    <Icons.Plus className="size-[22px] text-white/70" />
                  </GlassButton>
                </GlassTooltipTrigger>
                <GlassTooltipContent side="right">Attach file</GlassTooltipContent>
              </GlassTooltip>

              {/* Center — clickable hover zone to activate text input */}
              {!inputActive ? (
                <button
                  onClick={activateInput}
                  className="mx-2 flex h-9 flex-1 cursor-text items-center rounded-full px-4 transition-colors hover:bg-white/10"
                >
                  <span className="text-[15px] leading-none text-white/30">Ask anything...</span>
                </button>
              ) : (
                <div className="flex-1" />
              )}

              {/* Right — Mic, Chat toggle */}
              <div className="flex items-center gap-1">
                <GlassTooltip>
                  <GlassTooltipTrigger asChild>
                    <GlassButton variant="ghost" size="icon" className="size-10 rounded-full">
                      <Icons.Microphone className="size-[22px] text-white/70" />
                    </GlassButton>
                  </GlassTooltipTrigger>
                  <GlassTooltipContent side="left">Voice input</GlassTooltipContent>
                </GlassTooltip>
                <GlassTooltip>
                  <GlassTooltipTrigger asChild>
                    <GlassButton variant="ghost" size="icon" onClick={() => setMode('panel')} className="size-10 rounded-full">
                      <Icons.Message className="size-[22px] text-white/70" />
                    </GlassButton>
                  </GlassTooltipTrigger>
                  <GlassTooltipContent side="right">Open chat panel</GlassTooltipContent>
                </GlassTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}
