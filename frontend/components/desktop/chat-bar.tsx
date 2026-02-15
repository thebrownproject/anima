'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
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
import { VoiceBars } from '@/components/voice/voice-bars'

const HOVER_DELAY = 200 // ms — voice controls show delay
const LINGER_DELAY = 1000 // ms — voice controls hide delay (after stop or mouse leave)

interface ChatBarProps {
  embedded?: boolean
}

export function ChatBar({ embedded = false }: ChatBarProps) {
  const [showControls, setShowControls] = useState(false)
  const [lingerVisible, setLingerVisible] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const lingerTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const prevTranscriptRef = useRef('')
  const wasListeningRef = useRef(false)
  const { send, status } = useWebSocket()
  const isConnected = status === 'connected'
  const { chips, mode, isAgentStreaming, addMessage, draft: inputValue, setDraft: setInputValue, clearDraft, inputActive, setInputActive } = useChatStore()
  const activeStackId = useDesktopStore((s) => s.activeStackId)
  const voiceActive = isVoiceEnabled()
  const voice = useVoiceMaybe()
  const personaState = useVoiceStore((s) => s.personaState)
  const transcript = useVoiceStore((s) => s.transcript)
  const ttsEnabled = useVoiceStore((s) => s.ttsEnabled)
  const toggleTts = useVoiceStore((s) => s.toggleTts)

  const isListening = personaState === 'listening'

  const sendMessage = useCallback((text: string) => {
    addMessage({ role: 'user', content: text, timestamp: Date.now() })
    send({ type: 'mission', payload: { text, context: { stack_id: activeStackId } } })
  }, [addMessage, send, activeStackId])

  const handleSend = useCallback(() => {
    // If recording, stop STT but keep voice session alive for TTS
    if (voice && isListening) voice.stopRecordingForSend()
    const text = inputValue.trim()
    if (!text || !isConnected) return
    sendMessage(text)
    clearDraft()
    setInputActive(false)
    useVoiceStore.getState().clearTranscript()
    // Show thinking state while waiting for agent response
    const { personaState: ps } = useVoiceStore.getState()
    if (voiceActive && ps !== 'asleep') {
      useVoiceStore.getState().setPersonaState('thinking')
    }
    inputRef.current?.blur()
  }, [inputValue, sendMessage, clearDraft, isConnected, voice, isListening, voiceActive])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape' && voice && isListening) {
      e.preventDefault()
      voice.stopRecordingOnly()
    }
  }

  const activateInput = () => {
    setInputActive(true)
    setTimeout(() => inputRef.current?.focus(), 250)
  }

  const handleBlur = () => {
    if (!inputValue) setInputActive(false)
  }

  // --- Transcript → textarea wiring ---

  // Expand textarea on voice start (no focus — hides cursor), focus or collapse when done
  useEffect(() => {
    if (isListening) {
      wasListeningRef.current = true
      setInputActive(true)
      inputRef.current?.blur()
      prevTranscriptRef.current = ''
      setLingerVisible(false)
      if (lingerTimer.current) clearTimeout(lingerTimer.current)
    } else if (wasListeningRef.current) {
      // Only run linger logic on listening → not-listening transition
      wasListeningRef.current = false
      if (inputValue.trim()) {
        setTimeout(() => inputRef.current?.focus(), 250)
        setLingerVisible(true)
        lingerTimer.current = setTimeout(() => setLingerVisible(false), LINGER_DELAY)
      } else {
        setLingerVisible(true)
        lingerTimer.current = setTimeout(() => {
          setLingerVisible(false)
          if (!inputRef.current?.value?.trim()) setInputActive(false)
        }, LINGER_DELAY)
      }
    }
  }, [isListening]) // eslint-disable-line react-hooks/exhaustive-deps -- transition-only effect

  // Delta-append transcript to draft as STT produces text (one instance only to prevent double-append)
  useEffect(() => {
    if (embedded || !isListening) return
    const prev = prevTranscriptRef.current
    if (transcript.length > prev.length && transcript.startsWith(prev)) {
      const delta = transcript.slice(prev.length)
      setInputValue((v) => v + delta)
    }
    prevTranscriptRef.current = transcript
  }, [transcript, isListening, embedded, setInputValue])

  // --- Voice controls hover logic ---

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
      if (lingerTimer.current) clearTimeout(lingerTimer.current)
    }
  }, [])

  const handleControlsMouseEnter = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setShowControls(true), HOVER_DELAY)
  }, [])

  const handleControlsMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setShowControls(false), LINGER_DELAY)
  }, [])

  const controlsVisible = isListening || showControls || lingerVisible

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

      {/* Glass bar + orb wrapper */}
      <div className={cn('relative', embedded ? 'w-full' : 'pointer-events-auto w-[500px]')}>
        <div
          className={cn(
            'relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-all duration-300',
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
                      if (voice && isListening) voice.stopRecordingOnly()
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    rows={1}
                    className={cn(
                      'w-full max-h-[120px] resize-none bg-transparent text-[15px] leading-snug text-white outline-none [field-sizing:content] placeholder:text-white/30',
                      isListening && 'caret-transparent',
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center px-3 py-2.5">
              {/* Left — Attach */}
              <GlassIconButton
                icon={<Icons.Plus  />}
                tooltip="Upload file"
                tooltipSide="right"
              />

              {/* Center — clickable hover zone to activate text input */}
              {!inputActive ? (
                <button
                  onClick={activateInput}
                  className="mx-3 flex h-9 flex-1 cursor-text items-center rounded-full px-4 transition-colors hover:bg-white/10"
                >
                  <span className="text-[15px] leading-none text-white/30">Ask anything...</span>
                </button>
              ) : (
                <div className="flex-1" />
              )}

              {/* Right — voice controls + orb spacer */}
              {voiceActive ? (
                <div
                  data-testid="voice-controls"
                  className="flex items-center"
                  onMouseEnter={handleControlsMouseEnter}
                  onMouseLeave={handleControlsMouseLeave}
                >
                  {/* Speaker toggle — slides out first (farthest from orb) */}
                  <div
                    className={cn(
                      'transition-all ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                      controlsVisible
                        ? 'mr-1.5 w-10 translate-x-0 opacity-100 duration-250 delay-100'
                        : 'pointer-events-none w-0 translate-x-6 overflow-hidden opacity-0 duration-150 delay-0',
                    )}
                  >
                    <GlassIconButton
                      icon={ttsEnabled ? <Icons.Volume /> : <Icons.VolumeOff />}
                      tooltip={ttsEnabled ? 'Mute speaker' : 'Unmute speaker'}
                      tooltipSide="top"
                      onClick={toggleTts}
                    />
                  </div>
                  {/* Stop button — visible when listening or lingering */}
                  <div
                    data-testid="stop-recording-button"
                    className={cn(
                      'transition-all ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                      controlsVisible && (isListening || lingerVisible)
                        ? 'mr-1.5 w-10 translate-x-0 opacity-100 duration-250 delay-50'
                        : 'pointer-events-none w-0 translate-x-4 overflow-hidden opacity-0 duration-150 delay-0',
                    )}
                  >
                    <GlassIconButton
                      icon={<Icons.PlayerStopFilled className="size-3.5" />}
                      tooltip="Stop recording"
                      tooltipSide="top"
                      onClick={() => voice?.stopRecordingOnly()}
                    />
                  </div>
                  {/* Voice bars — visible when listening or lingering */}
                  <div
                    className={cn(
                      'flex items-center justify-center',
                      'transition-all ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                      controlsVisible && (isListening || lingerVisible)
                        ? 'mr-1.5 h-10 w-10 translate-x-0 opacity-100 duration-250'
                        : 'pointer-events-none h-10 w-0 translate-x-2 overflow-hidden opacity-0 duration-150 delay-0',
                    )}
                  >
                    <VoiceBars analyser={voice?.analyser ?? null} />
                  </div>
                  <div className="size-10" />
                </div>
              ) : (
                <div data-testid="mic-button">
                  <GlassIconButton
                    icon={<Icons.Microphone />}
                    tooltip="Voice input"
                    tooltipSide="left"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Persona orb + voice bars — outside overflow-hidden so they aren't clipped */}
        {voiceActive && (
          <div
            className="absolute bottom-2.5 right-3 flex flex-col items-center gap-1.5"
            onMouseEnter={handleControlsMouseEnter}
            onMouseLeave={handleControlsMouseLeave}
          >
            <PersonaOrb hasText={hasText} onSendMessage={handleSend} />
          </div>
        )}
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
