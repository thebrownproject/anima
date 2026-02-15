'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useVoiceStore, type PersonaState } from '@/lib/stores/voice-store'
import { useVoice } from './voice-provider'
import { GlassTooltip, GlassTooltipTrigger, GlassTooltipContent } from '@/components/ui/glass-tooltip'

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

function orbTooltip(state: PersonaState, hasText?: boolean): string {
  switch (state) {
    case 'idle':
      return hasText ? 'Send message' : 'Start listening'
    case 'listening':
      return hasText ? 'Send message' : 'Stop listening'
    case 'thinking':
      return 'Thinking...'
    case 'speaking':
      return 'Stop speaking'
    case 'asleep':
      return 'Connecting...'
  }
}

interface PersonaOrbProps {
  hasText?: boolean
  onSendMessage?: () => void
}

export function PersonaOrb({ hasText, onSendMessage }: PersonaOrbProps): React.JSX.Element {
  const personaState = useVoiceStore((s) => s.personaState)
  const { startVoice, stopRecordingOnly, interruptTTS } = useVoice()
  const [riveReady, setRiveReady] = useState(false)
  const [mountRive, setMountRive] = useState(false)

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

  function handleTap(): void {
    switch (personaState) {
      case 'idle':
        if (hasText && onSendMessage) {
          onSendMessage()
        } else {
          startVoice()
        }
        break
      case 'listening':
        if (hasText && onSendMessage) {
          onSendMessage()
        } else {
          stopRecordingOnly()
        }
        break
      case 'speaking':
        interruptTTS()
        break
    }
  }

  return (
    <GlassTooltip>
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
            <div className="absolute inset-[-13%]">
              <Persona
                state={toRiveState(personaState)}
                onReady={() => setRiveReady(true)}
                className="size-full"
              />
            </div>
          )}
        </button>
      </GlassTooltipTrigger>
      <GlassTooltipContent side="top">
        {orbTooltip(personaState, hasText)}
      </GlassTooltipContent>
    </GlassTooltip>
  )
}
