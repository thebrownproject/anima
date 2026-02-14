import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isVoiceEnabled, validateVoiceEnv } from '../voice-config'

describe('isVoiceEnabled', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when env var is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_VOICE_ENABLED', '')
    expect(isVoiceEnabled()).toBe(false)
  })

  it('returns false when env var is "false"', () => {
    vi.stubEnv('NEXT_PUBLIC_VOICE_ENABLED', 'false')
    expect(isVoiceEnabled()).toBe(false)
  })

  it('returns true when env var is "true"', () => {
    vi.stubEnv('NEXT_PUBLIC_VOICE_ENABLED', 'true')
    expect(isVoiceEnabled()).toBe(true)
  })
})

describe('validateVoiceEnv', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns invalid when API keys are missing', () => {
    vi.stubEnv('DEEPGRAM_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', '')
    const result = validateVoiceEnv()
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('DEEPGRAM_API_KEY')
    expect(result.missing).toContain('OPENAI_API_KEY')
  })

  it('returns invalid when only Deepgram key is missing', () => {
    vi.stubEnv('DEEPGRAM_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key')
    const result = validateVoiceEnv()
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('DEEPGRAM_API_KEY')
    expect(result.missing).not.toContain('OPENAI_API_KEY')
  })

  it('returns valid when all keys are present', () => {
    vi.stubEnv('DEEPGRAM_API_KEY', 'dg-test-key')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key')
    const result = validateVoiceEnv()
    expect(result.valid).toBe(true)
    expect(result.missing).toHaveLength(0)
  })
})
