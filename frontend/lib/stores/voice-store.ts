import { create } from 'zustand'

export type PersonaState = 'asleep' | 'idle' | 'listening' | 'thinking' | 'speaking'

export const VALID_TRANSITIONS: Record<PersonaState, PersonaState[]> = {
  asleep: ['idle'],
  idle: ['listening'],
  listening: ['thinking', 'idle'],
  thinking: ['speaking', 'idle'],
  speaking: ['idle'],
}

interface VoiceState {
  personaState: PersonaState
  micEnabled: boolean
  ttsEnabled: boolean
  transcript: string
}

interface VoiceActions {
  setPersonaState: (to: PersonaState) => void
  toggleMic: () => void
  toggleTts: () => void
  setTranscript: (text: string) => void
  clearTranscript: () => void
}

export const useVoiceStore = create<VoiceState & VoiceActions>()((set) => ({
  personaState: 'asleep',
  micEnabled: false,
  ttsEnabled: false,
  transcript: '',

  setPersonaState: (to) =>
    set((state) => {
      if (to === 'asleep') return { personaState: 'asleep' }
      if (VALID_TRANSITIONS[state.personaState].includes(to)) return { personaState: to }
      console.warn(`[voice] invalid transition: ${state.personaState} -> ${to}`)
      return state
    }),

  toggleMic: () => set((state) => ({ micEnabled: !state.micEnabled })),
  toggleTts: () => set((state) => ({ ttsEnabled: !state.ttsEnabled })),
  setTranscript: (text) => set({ transcript: text }),
  clearTranscript: () => set({ transcript: '' }),
}))
