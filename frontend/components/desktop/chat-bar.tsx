'use client'

import { useRef, useState, useCallback } from 'react'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/lib/stores/chat-store'
import { GlassIconButton } from '@/components/ui/glass-icon-button'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import { useWebSocket } from './ws-provider'
import { isVoiceEnabled } from '@/lib/voice-config'
import { useVoiceStore } from '@/lib/stores/voice-store'
import { useVoiceMaybe } from '@/components/voice/voice-provider'
import { PersonaOrb } from '@/components/voice/persona-orb'

interface ChatBarProps {
  embedded?: boolean
}

export function ChatBar({ embedded = false }: ChatBarProps) {
  const [inputValue, setInputValue] = useState('')
  const [inputActive, setInputActive] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { send } = useWebSocket()
  const { chips, mode, isAgentStreaming, addMessage, setMode } = useChatStore()
  const activeStackId = useDesktopStore((s) => s.activeStackId)
  const voiceActive = isVoiceEnabled()
  const voice = useVoiceMaybe()
  const personaState = useVoiceStore((s) => s.personaState)

  const sendMessage = useCallback((text: string) => {
    addMessage({ role: 'user', content: text, timestamp: Date.now() })
    send({ type: 'mission', payload: { text, context: { stack_id: activeStackId } } })
  }, [addMessage, send, activeStackId])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text) return
    sendMessage(text)
    setInputValue('')
    setInputActive(false)
    inputRef.current?.blur()
  }, [inputValue, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const activateInput = () => {
    setInputActive(true)
    setTimeout(() => inputRef.current?.focus(), 250)
  }

  const handleBlur = () => {
    if (!inputValue) setInputActive(false)
  }

  const hasText = inputValue.trim().length > 0
  const isHidden = !embedded && mode === 'panel'

  // ─── Shared inner content (glass bar + chips) ───────────────────────

  const content = (
    <>
      {/* Suggestion chips — float above */}
      {chips.length > 0 && !inputActive && (
        <div className={cn('flex items-center gap-2', !embedded && 'pointer-events-auto')}>
          {chips.map((chip) => (
            <button
              key={chip.action}
              onClick={() => sendMessage(chip.action)}
              className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-[13px] font-medium text-white/70 backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:bg-white/12 hover:text-white/90 active:scale-95"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Glass bar */}
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-all duration-300',
          embedded ? 'w-full' : 'pointer-events-auto w-[500px]',
          isAgentStreaming && 'border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(6,182,212,0.08)]',
        )}
      >
        {/* Agent streaming glow */}
        {isAgentStreaming && (
          <div className="absolute inset-0 animate-pulse rounded-3xl bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5" />
        )}

        <div className="relative">
          {/* Text area — animated expand/collapse */}
          <div className={cn(
            'grid transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
            inputActive ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}>
            <div className={cn(
              'min-h-0 overflow-hidden transition-opacity',
              inputActive
                ? 'opacity-100 delay-200 duration-150'
                : 'opacity-0 duration-100'
            )}>
              <div className="px-5 pt-4 pb-1 pr-16">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value)
                    if (voice && personaState === 'listening') voice.stopVoice()
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  rows={1}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full max-h-[120px] resize-none bg-transparent text-[15px] leading-snug text-white outline-none [field-sizing:content] placeholder:text-white/30"
                />
              </div>
            </div>
          </div>

          {/* Send button — fades in when text present */}
          <div className={cn(
            'absolute right-3 top-3 transition-opacity duration-200',
            hasText && inputActive
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none'
          )}>
            <GlassIconButton
              icon={<Icons.ArrowUp className="text-white" />}
              tooltip="Send"
              tooltipSide="right"
              onClick={handleSend}
              className="bg-white/15 hover:bg-white/25"
            />
          </div>

          {/* Action bar */}
          <div className="flex items-center px-3 py-2.5">
            {/* Left — Attach */}
            <GlassIconButton
              icon={<Icons.Plus  />}
              tooltip="Attach file"
              tooltipSide="right"
            />

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

            {/* Right — Mic + Panel toggle (only in standalone bar) */}
            <div className="flex items-center gap-1">
              {voiceActive ? (
                <PersonaOrb />
              ) : (
                <div data-testid="mic-button">
                  <GlassIconButton
                    icon={<Icons.Microphone />}
                    tooltip="Voice input"
                    tooltipSide="left"
                  />
                </div>
              )}
              {!embedded && (
                <GlassIconButton
                  icon={<Icons.PanelRight  />}
                  tooltip="Open chat panel"
                  tooltipSide="right"
                  onClick={() => setMode('panel')}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  // ─── Embedded: render content directly ──────────────────────────────

  if (embedded) {
    return (
      <div className="flex flex-col items-center gap-3">
        {content}
      </div>
    )
  }

  // ─── Standalone: fixed bottom wrapper with visibility toggle ────────

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 pb-6',
        'transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        isHidden
          ? 'translate-y-full opacity-0'
          : 'translate-y-0 opacity-100',
      )}
    >
      {content}
    </div>
  )
}
