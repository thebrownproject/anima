'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useVoiceStore, type PersonaState } from '@/lib/stores/voice-store'
import { useVoice } from './voice-provider'
import { GlassPill } from '@/components/ui/glass-pill'
import { GlassIconButton } from '@/components/ui/glass-icon-button'
import { GlassTooltip, GlassTooltipTrigger, GlassTooltipContent } from '@/components/ui/glass-tooltip'
import { VoiceBars } from './voice-bars'
import * as Icons from '@/components/icons'

// Async load — prevents Rive WebGL2 from blocking the main thread
const Persona = dynamic(
  () => import('@/components/ai-elements/persona').then((m) => m.Persona),
  { ssr: false }
)

// Map voice store state to Rive animation state.
function toRiveState(state: PersonaState): PersonaState {
  if (state === 'asleep') return 'idle'
  return state
}

const HOVER_DELAY = 400 // ms — default pill delay
const HOVER_DELAY_TYPING = 800 // ms — longer delay when input is active

interface PersonaOrbProps {
  hasText?: boolean
  inputActive?: boolean
  onSendMessage?: () => void
}

export function PersonaOrb({ hasText, inputActive, onSendMessage }: PersonaOrbProps): React.JSX.Element {
  const personaState = useVoiceStore((s) => s.personaState)
  const transcript = useVoiceStore((s) => s.transcript)
  const micEnabled = useVoiceStore((s) => s.micEnabled)
  const ttsEnabled = useVoiceStore((s) => s.ttsEnabled)
  const toggleMic = useVoiceStore((s) => s.toggleMic)
  const toggleTts = useVoiceStore((s) => s.toggleTts)
  const { startVoice, stopVoice, interruptTTS, analyser } = useVoice()
  const [riveReady, setRiveReady] = useState(false)
  const [mountRive, setMountRive] = useState(false)
  const [showPill, setShowPill] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(null)

  // Defer Rive mount until browser is idle — prevents WebGL2 init from blocking UI
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => setMountRive(true), { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }
    // Fallback: mount on next frame
    const id = requestAnimationFrame(() => setMountRive(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    const delay = inputActive ? HOVER_DELAY_TYPING : HOVER_DELAY
    hoverTimer.current = setTimeout(() => setShowPill(true), delay)
  }, [inputActive])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setShowPill(false), HOVER_DELAY)
  }, [])

  const isListening = personaState === 'listening'
  // Pill is always visible when listening, otherwise controlled by hover
  const pillVisible = isListening || showPill

  function handleTap(): void {
    // Send message when text is present
    if (hasText && onSendMessage) {
      onSendMessage()
      return
    }

    // Voice state machine
    switch (personaState) {
      case 'idle':
        startVoice()
        break
      case 'listening':
        stopVoice()
        break
      case 'speaking':
        interruptTTS()
        break
    }
  }

  return (
    <div
      className="relative flex flex-col items-center gap-1.5"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Pill — shows voice controls on hover, transcript + bars when listening */}
      <div
        className={cn(
          'absolute bottom-full left-1/2 z-10 -translate-x-1/2 pb-2',
          'transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          pillVisible
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-1 scale-95 opacity-0',
        )}
      >
        {isListening ? (
          <GlassPill className="w-[400px] flex-col items-center gap-2 px-4 py-3 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
            <span className="w-full text-center text-xs leading-relaxed text-white/70">
              {transcript || 'Listening...'}
            </span>
            <VoiceBars analyser={analyser} />
          </GlassPill>
        ) : (
          <GlassPill className="h-10">
            <GlassIconButton
              icon={micEnabled ? <Icons.Microphone /> : <Icons.MicrophoneOff />}
              tooltip={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
              tooltipSide="top"
              onClick={toggleMic}
              className="size-8"
            />
            <GlassIconButton
              icon={ttsEnabled ? <Icons.Volume /> : <Icons.VolumeOff />}
              tooltip={ttsEnabled ? 'Mute speaker' : 'Unmute speaker'}
              tooltipSide="top"
              onClick={toggleTts}
              className="size-8"
            />
          </GlassPill>
        )}
      </div>

      <GlassTooltip open={hasText ? undefined : false}>
        <GlassTooltipTrigger asChild>
          <button
            data-testid="persona-orb"
            onClick={handleTap}
            className={cn(
              'relative flex size-10 items-center justify-center overflow-visible rounded-full',
              personaState === 'asleep' && 'pointer-events-none'
            )}
          >
            {/* Placeholder — visible until Rive animation is playing */}
            {!riveReady && (
              <div
                data-testid="persona-placeholder"
                className="absolute inset-0 animate-pulse rounded-full border border-white/20 bg-gradient-to-br from-white/20 to-white/5"
              />
            )}
            {mountRive && (
              <div className="absolute inset-[-15%]">
                <Persona
                  state={toRiveState(personaState)}
                  onReady={() => setRiveReady(true)}
                  className="size-full"
                />
              </div>
            )}
          </button>
        </GlassTooltipTrigger>
        <GlassTooltipContent side="right">Send message</GlassTooltipContent>
      </GlassTooltip>
    </div>
  )
}
