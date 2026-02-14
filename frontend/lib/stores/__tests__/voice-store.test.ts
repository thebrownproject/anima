import { describe, it, expect, beforeEach } from 'vitest'
import { useVoiceStore, VALID_TRANSITIONS, type PersonaState } from '../voice-store'

const defaults = {
  personaState: 'asleep' as PersonaState,
  micEnabled: false,
  ttsEnabled: false,
  transcript: '',
}

beforeEach(() => {
  useVoiceStore.setState(defaults)
})

describe('default state', () => {
  it('initializes with asleep, false, false, empty string', () => {
    const state = useVoiceStore.getState()
    expect(state.personaState).toBe('asleep')
    expect(state.micEnabled).toBe(false)
    expect(state.ttsEnabled).toBe(false)
    expect(state.transcript).toBe('')
  })
})

describe('valid transitions', () => {
  it.each(
    Object.entries(VALID_TRANSITIONS).flatMap(([from, targets]) =>
      targets.map((to) => [from, to])
    )
  )('%s -> %s succeeds', (from, to) => {
    useVoiceStore.setState({ personaState: from as PersonaState })
    useVoiceStore.getState().setPersonaState(to as PersonaState)
    expect(useVoiceStore.getState().personaState).toBe(to)
  })
})

describe('invalid transitions', () => {
  it('rejects asleep -> listening', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    useVoiceStore.getState().setPersonaState('listening')
    expect(useVoiceStore.getState().personaState).toBe('asleep')
  })

  it('rejects idle -> speaking', () => {
    useVoiceStore.setState({ personaState: 'idle' })
    useVoiceStore.getState().setPersonaState('speaking')
    expect(useVoiceStore.getState().personaState).toBe('idle')
  })

  it('rejects speaking -> listening', () => {
    useVoiceStore.setState({ personaState: 'speaking' })
    useVoiceStore.getState().setPersonaState('listening')
    expect(useVoiceStore.getState().personaState).toBe('speaking')
  })
})

describe('any state -> asleep', () => {
  const allStates: PersonaState[] = ['asleep', 'idle', 'listening', 'thinking', 'speaking']

  it.each(allStates)('%s -> asleep always succeeds', (from) => {
    useVoiceStore.setState({ personaState: from })
    useVoiceStore.getState().setPersonaState('asleep')
    expect(useVoiceStore.getState().personaState).toBe('asleep')
  })
})

describe('toggleMic / toggleTts', () => {
  it('toggleMic flips independently', () => {
    expect(useVoiceStore.getState().micEnabled).toBe(false)
    useVoiceStore.getState().toggleMic()
    expect(useVoiceStore.getState().micEnabled).toBe(true)
    expect(useVoiceStore.getState().ttsEnabled).toBe(false)
    useVoiceStore.getState().toggleMic()
    expect(useVoiceStore.getState().micEnabled).toBe(false)
  })

  it('toggleTts flips independently', () => {
    expect(useVoiceStore.getState().ttsEnabled).toBe(false)
    useVoiceStore.getState().toggleTts()
    expect(useVoiceStore.getState().ttsEnabled).toBe(true)
    expect(useVoiceStore.getState().micEnabled).toBe(false)
    useVoiceStore.getState().toggleTts()
    expect(useVoiceStore.getState().ttsEnabled).toBe(false)
  })
})

describe('setTranscript / clearTranscript', () => {
  it('setTranscript updates transcript', () => {
    useVoiceStore.getState().setTranscript('hello world')
    expect(useVoiceStore.getState().transcript).toBe('hello world')
  })

  it('clearTranscript resets to empty string', () => {
    useVoiceStore.getState().setTranscript('something')
    useVoiceStore.getState().clearTranscript()
    expect(useVoiceStore.getState().transcript).toBe('')
  })
})
