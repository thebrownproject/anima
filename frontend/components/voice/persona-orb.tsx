'use client'

import dynamic from 'next/dynamic'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { useVoiceStore, type PersonaState } from '@/lib/stores/voice-store'
import { useVoice } from './voice-provider'

const Persona = dynamic(
  () => import('@/components/ai-elements/persona').then((m) => m.Persona),
  { ssr: false, loading: () => <div className="size-10" /> }
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
  const micEnabled = useVoiceStore((s) => s.micEnabled)
  const ttsEnabled = useVoiceStore((s) => s.ttsEnabled)
  const transcript = useVoiceStore((s) => s.transcript)
  const toggleMic = useVoiceStore((s) => s.toggleMic)
  const toggleTts = useVoiceStore((s) => s.toggleTts)
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

      {/* Mic + TTS toggles */}
      <div className="flex items-center gap-1">
        <button
          aria-label="Toggle microphone"
          onClick={toggleMic}
          className={cn(
            'flex size-7 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white/80',
            micEnabled && 'text-white/80'
          )}
        >
          {micEnabled ? <Icons.Microphone className="size-3.5" /> : <Icons.MicrophoneOff className="size-3.5" />}
        </button>
        <button
          aria-label="Toggle speaker"
          onClick={toggleTts}
          className={cn(
            'flex size-7 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white/80',
            ttsEnabled && 'text-white/80'
          )}
        >
          {ttsEnabled ? <Icons.Volume className="size-3.5" /> : <Icons.VolumeOff className="size-3.5" />}
        </button>
      </div>
    </div>
  )
}
