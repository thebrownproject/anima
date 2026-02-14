import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'TTS service unavailable' }, { status: 503 })
  }

  let text: string
  try {
    const body = await req.json()
    text = body.text
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!text || typeof text !== 'string') return Response.json({ error: 'Missing text' }, { status: 400 })
  if (text.length > 4096) return Response.json({ error: 'Text too long (max 4096 chars)' }, { status: 400 })

  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      input: text,
      voice: 'fable',
      response_format: 'pcm',
    }),
  })

  if (!upstream.ok) {
    return Response.json({ error: 'TTS generation failed' }, { status: 502 })
  }

  return new Response(upstream.body, {
    headers: { 'Content-Type': 'application/octet-stream' },
  })
}
