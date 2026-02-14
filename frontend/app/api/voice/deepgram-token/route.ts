import { auth } from '@clerk/nextjs/server'
import { createClient } from '@deepgram/sdk'
import { validateVoiceEnv } from '@/lib/voice-config'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const env = validateVoiceEnv()
  if (!env.valid) return Response.json({ error: 'Voice service unavailable' }, { status: 503 })

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY!)
  const { result, error } = await deepgram.auth.grantToken({ ttl_seconds: 30 })

  if (error || !result) {
    return Response.json({ error: 'Token generation failed' }, { status: 502 })
  }

  return Response.json({ token: result.access_token, expires_in: result.expires_in })
}
