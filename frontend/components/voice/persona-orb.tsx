'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useVoiceStore, type PersonaState } from '@/lib/stores/voice-store'
import { useVoice } from './voice-provider'

// Async load — prevents Rive WebGL2 from blocking the main thread
const Persona = dynamic(
  () => import('@/components/ai-elements/persona').then((m) => m.Persona),
  { ssr: false }
)

// Map voice store state to Rive animation state.
// idle and asleep are invisible in the obsidian Rive asset, so always show thinking.
function toRiveState(state: PersonaState): PersonaState {
  if (state === 'listening' || state === 'speaking') return state
  return 'thinking'
}

export function PersonaOrb(): React.JSX.Element {
  const personaState = useVoiceStore((s) => s.personaState)
  const transcript = useVoiceStore((s) => s.transcript)
  const { startVoice, stopVoice, interruptTTS } = useVoice()
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

  const showTranscript = personaState === 'listening' && transcript.length > 0

  function handleTap(): void {
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
    <div className="flex flex-col items-center gap-1.5">
      {showTranscript && (
        <div
          data-testid="transcript-preview"
          className="max-w-[240px] truncate rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs text-white/70 backdrop-blur-xl"
        >
          {transcript}
        </div>
      )}

      <button
        data-testid="persona-orb"
        onClick={handleTap}
        className={cn(
          'relative flex size-10 items-center justify-center rounded-full',
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
          <Persona
            state={toRiveState(personaState)}
            onReady={() => setRiveReady(true)}
            className="size-10"
          />
        )}
      </button>
    </div>
  )
}
