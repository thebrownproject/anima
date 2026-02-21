'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useVoiceStore, type PersonaState } from '@/lib/stores/voice-store'
import type { PersonaState as RivePersonaState } from '@/components/ai-elements/persona'
import { useVoice } from './voice-provider'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// SSR-safe dynamic import — WebGL2 requires browser APIs
const Persona = dynamic(
  () => import('@/components/ai-elements/persona').then((m) => m.Persona),
  { ssr: false }
)

// Map voice store state to Rive animation state.
function toRiveState(state: PersonaState): RivePersonaState {
  if (state === 'asleep') return 'idle'
  if (state === 'connecting') return 'listening'
  return state
}

export function orbTooltip(state: PersonaState, hasText?: boolean): string {
  switch (state) {
    case 'idle':
      return hasText ? 'Send message' : 'Start listening'
    case 'connecting':
      return 'Connecting...'
    case 'listening':
      return hasText ? 'Send message' : 'Stop listening'
    case 'thinking':
      return 'Thinking...'
    case 'speaking':
      return 'Stop speaking'
    case 'asleep':
      return 'Sleeping'
    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
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

  function handleTap(): void {
    switch (personaState) {
      case 'idle':
        if (hasText && onSendMessage) {
          onSendMessage()
        } else {
          startVoice()
        }
        break
      case 'connecting':
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-testid="persona-orb"
          onClick={handleTap}
          className={cn(
            'relative flex size-10 items-center justify-center overflow-visible rounded-full',
            personaState === 'asleep' && 'pointer-events-none'
          )}
        >
          {/* Placeholder -- visible until Rive animation is playing */}
          {!riveReady && (
            <div
              data-testid="persona-placeholder"
              className="absolute inset-0 animate-pulse rounded-full border border-border bg-gradient-to-br from-muted to-muted/50"
            />
          )}
          <div className="absolute inset-[-13%]">
            <Persona
              state={toRiveState(personaState)}
              onReady={() => setRiveReady(true)}
              className="size-full"
            />
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {orbTooltip(personaState, hasText)}
      </TooltipContent>
    </Tooltip>
  )
}
