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
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { useFileUpload } from '@/hooks/use-file-upload'

const HOVER_DELAY = 200 // ms — voice controls show delay
const LINGER_DELAY = 1000 // ms — voice controls hide delay (after mouse leave)
const POST_STT_DELAY = 2000 // ms — spinner shown after STT stops before controls hide

interface ChatBarProps {
  embedded?: boolean
}

export function ChatBar({ embedded = false }: ChatBarProps) {
  const [showControls, setShowControls] = useState(false)
  const [lingerVisible, setLingerVisible] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const lingerTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const prevTranscriptRef = useRef('')
  const wasListeningRef = useRef(false)
  const wasConnectingRef = useRef(false)
  const { send } = useWebSocket()
  const { sendUpload } = useFileUpload()
  const { chips, mode, isAgentStreaming, addMessage, draft: inputValue, setDraft: setInputValue, clearDraft, inputActive, setInputActive } = useChatStore()
  const activeStackId = useDesktopStore((s) => s.activeStackId)
  const voiceActive = isVoiceEnabled()
  const voice = useVoiceMaybe()
  const personaState = useVoiceStore((s) => s.personaState)
  const transcript = useVoiceStore((s) => s.transcript)
  const ttsEnabled = useVoiceStore((s) => s.ttsEnabled)
  const toggleTts = useVoiceStore((s) => s.toggleTts)

  const isListening = personaState === 'listening'
  const isConnecting = personaState === 'connecting'
  const isSpeaking = personaState === 'speaking'
  const isVoiceActive = isListening || isConnecting

  const sendMessage = useCallback((text: string) => {
    const state = useDesktopStore.getState()
    const openCards = Object.values(state.cards)
      .filter((card) => card.stackId === state.activeStackId)
      .map(({ id, title, blocks }) => ({ card_id: id, title, blocks }))

    const result = send({
      type: 'mission',
      payload: {
        text,
        context: {
          stack_id: activeStackId,
          canvas_state: openCards.length > 0 ? openCards : undefined,
        },
      },
    })

    if (result === 'dropped') {
      toast.error('Message could not be sent', { id: 'send-failed' })
      return
    }

    addMessage({ role: 'user', content: text, timestamp: Date.now() })
  }, [addMessage, send, activeStackId])

  const handleSend = useCallback(() => {
    if (voice && (isVoiceActive)) voice.stopRecordingForSend()
    const text = inputValue.trim()
    if (!text) return
    sendMessage(text)
    clearDraft()
    useVoiceStore.getState().clearTranscript()
    const { personaState: ps } = useVoiceStore.getState()
    if (voiceActive && ps !== 'asleep') {
      useVoiceStore.getState().setPersonaState('thinking')
    }
  }, [inputValue, sendMessage, clearDraft, voice, isVoiceActive, voiceActive])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape' && voice && (isVoiceActive)) {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) sendUpload(file)
    e.target.value = ''
  }

  // --- Transcript → textarea wiring ---

  // Expand textarea on voice start (no focus — hides cursor), focus or collapse when done
  useEffect(() => {
    if (isVoiceActive) {
      if (isConnecting) wasConnectingRef.current = true
      if (isListening) wasListeningRef.current = true
      setInputActive(true)
      inputRef.current?.blur()
      if (isListening) prevTranscriptRef.current = ''
      setLingerVisible(false)
      if (lingerTimer.current) clearTimeout(lingerTimer.current)
    } else if (wasListeningRef.current || wasConnectingRef.current) {
      // Linger on stop/cancel. connecting→listening doesn't hit this branch (isVoiceActive stays true).
      wasListeningRef.current = false
      wasConnectingRef.current = false
      if (inputValue.trim()) {
        setTimeout(() => inputRef.current?.focus(), 250)
        setLingerVisible(true)
        lingerTimer.current = setTimeout(() => setLingerVisible(false), POST_STT_DELAY)
      } else {
        setLingerVisible(true)
        lingerTimer.current = setTimeout(() => {
          setLingerVisible(false)
          if (!inputRef.current?.value?.trim()) setInputActive(false)
        }, POST_STT_DELAY)
      }
    }
  }, [isVoiceActive, isListening, isConnecting]) // eslint-disable-line react-hooks/exhaustive-deps -- transition-only effect

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

  // Auto-scroll textarea to bottom during recording (cursor is blurred so browser won't auto-scroll)
  useEffect(() => {
    if (isListening && inputRef.current) {
      inputRef.current.scrollTop = inputRef.current.scrollHeight
    }
  }, [inputValue, isListening])

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

  const controlsVisible = isVoiceActive || isSpeaking || showControls || lingerVisible
  const hoverOnly = showControls || lingerVisible

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
                <div className="px-5 pt-4 pb-1">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value)
                      if (voice && (isVoiceActive)) voice.stopRecordingOnly()
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    rows={1}
                    className={cn(
                      'w-full max-h-[120px] resize-none bg-transparent text-[15px] leading-snug text-white outline-none [field-sizing:content] placeholder:text-white/30',
                      (isVoiceActive) && 'caret-transparent',
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Action bar */}
            <div className="flex items-center px-3 py-2.5">
              {/* Left — upload button */}
              <div className="mr-1.5">
                <GlassIconButton
                  icon={<Icons.Plus />}
                  tooltip="Upload file"
                  tooltipSide="top"
                  onClick={() => fileInputRef.current?.click()}
                />
              </div>

              {/* Center — clickable hover zone to activate text input */}
              {!inputActive ? (
                <button
                  onClick={activateInput}
                  className="mr-3 flex h-9 flex-1 cursor-text items-center rounded-full px-4 transition-colors hover:bg-white/10"
                >
                  {!isSpeaking && (
                    <span className="text-[15px] leading-none text-white/30">Ask anything...</span>
                  )}
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
                  {/* Speaker toggle — hover-only */}
                  <div
                    className={cn(
                      'transition-all ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                      hoverOnly
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
                  {/* Stop button — visible when recording or speaking (not during post-STT linger) */}
                  <div
                    data-testid="stop-recording-button"
                    className={cn(
                      'transition-all ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                      controlsVisible && (isConnecting || isListening || isSpeaking)
                        ? 'mr-1.5 w-10 translate-x-0 opacity-100 duration-250 delay-50'
                        : 'pointer-events-none w-0 translate-x-4 overflow-hidden opacity-0 duration-150 delay-0',
                    )}
                  >
                    <GlassIconButton
                      icon={<Icons.PlayerStop className="size-3.5" />}
                      tooltip={isSpeaking ? 'Stop speaking' : 'Stop recording'}
                      tooltipSide="top"
                      onClick={() => isSpeaking ? voice?.interruptTTS() : voice?.stopRecordingOnly()}
                    />
                  </div>
                  {/* Spinner (connecting) or voice bars (listening/speaking/lingering) */}
                  <div
                    className={cn(
                      'flex items-center justify-center',
                      'transition-all ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                      controlsVisible && (isConnecting || isListening || isSpeaking || lingerVisible)
                        ? 'mr-1.5 h-10 w-10 translate-x-0 opacity-100 duration-250'
                        : 'pointer-events-none h-10 w-0 translate-x-2 overflow-hidden opacity-0 duration-150 delay-0',
                    )}
                  >
                    {(isConnecting || (lingerVisible && !isListening && !isSpeaking))
                      ? <Spinner className="size-5 text-white/70" />
                      : <VoiceBars analyser={voice?.analyser ?? null} />
                    }
                  </div>
                  <div className="size-10" />
                </div>
              ) : (
                <div className="flex items-center gap-1.5" data-testid="mic-button">
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
