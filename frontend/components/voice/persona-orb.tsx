'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useVoiceStore, type PersonaState } from '@/lib/stores/voice-store'
import { useVoice } from './voice-provider'

const Persona = dynamic(
  () => import('@/components/ai-elements/persona').then((m) => m.Persona),
  { ssr: false }
)

const TAP_ACTIONS: Record<PersonaState, 'startVoice' | 'stopVoice' | 'interruptTTS' | null> = {
  asleep: null,
  idle: 'startVoice',
  listening: 'stopVoice',
  thinking: null,
  speaking: 'interruptTTS',
}

export function PersonaOrb() {
  const personaState = useVoiceStore((s) => s.personaState)
  const transcript = useVoiceStore((s) => s.transcript)
  const { startVoice, stopVoice, interruptTTS } = useVoice()

  const isAsleep = personaState === 'asleep'
  const showTranscript = personaState === 'listening' && transcript.length > 0

  const handleTap = () => {
    const action = TAP_ACTIONS[personaState]
    if (!action) return
    const actions = { startVoice, stopVoice, interruptTTS }
    actions[action]()
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Transcript preview pill */}
      {showTranscript && (
        <div
          data-testid="transcript-preview"
          className="max-w-[240px] truncate rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs text-white/70 backdrop-blur-xl"
        >
          {transcript}
        </div>
      )}

      {/* Orb — tap target wrapping Persona */}
      <button
        data-testid="persona-orb"
        onClick={handleTap}
        className={cn(
          'relative flex items-center justify-center rounded-full transition-opacity',
          isAsleep && 'opacity-50 pointer-events-none'
        )}
      >
        <Persona state={personaState} className="size-10" />
      </button>
    </div>
  )
}
