const REQUIRED_SERVER_KEYS = ['DEEPGRAM_API_KEY', 'OPENAI_API_KEY'] as const

export type VoiceEnvResult = {
  valid: boolean
  missing: string[]
}

export function isVoiceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VOICE_ENABLED === 'true'
}

export function validateVoiceEnv(): VoiceEnvResult {
  const missing = REQUIRED_SERVER_KEYS.filter((key) => !process.env[key])
  return { valid: missing.length === 0, missing: [...missing] }
}
