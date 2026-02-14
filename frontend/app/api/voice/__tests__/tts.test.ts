import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mockAuth }))

import { POST } from '../tts/route'

describe('POST /api/voice/tts', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const req = new Request('http://localhost/api/voice/tts', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 503 without OPENAI_API_KEY', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    vi.stubEnv('OPENAI_API_KEY', '')
    const req = new Request('http://localhost/api/voice/tts', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(503)
  })

  it('returns 400 without text in body', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    const req = new Request('http://localhost/api/voice/tts', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 with application/octet-stream content type', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const audioStream = new ReadableStream()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(audioStream, { status: 200 })
    )

    const req = new Request('http://localhost/api/voice/tts', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello world' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream')
  })

  it('streams response as ReadableStream pass-through', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const audioStream = new ReadableStream()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(audioStream, { status: 200 })
    )

    const req = new Request('http://localhost/api/voice/tts', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello' }),
    })
    const res = await POST(req)
    expect(res.body).toBeInstanceOf(ReadableStream)
  })

  it('does not expose API keys in response', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    vi.stubEnv('OPENAI_API_KEY', 'sk-secret-key')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('audio-bytes', { status: 200 })
    )

    const req = new Request('http://localhost/api/voice/tts', {
      method: 'POST',
      body: JSON.stringify({ text: 'test' }),
    })
    const res = await POST(req)
    const body = await res.text()
    expect(body).not.toContain('sk-secret-key')
  })

  it('returns 502 when OpenAI returns error', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error": "bad request"}', { status: 400 })
    )

    const req = new Request('http://localhost/api/voice/tts', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(502)
  })
})
