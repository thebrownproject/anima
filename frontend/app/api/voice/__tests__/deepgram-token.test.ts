import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockAuth, mockGrantToken } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGrantToken: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mockAuth }))
vi.mock('@deepgram/sdk', () => ({
  createClient: () => ({ auth: { grantToken: mockGrantToken } }),
}))

import { GET } from '../deepgram-token/route'

describe('GET /api/voice/deepgram-token', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 503 without DEEPGRAM_API_KEY', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    vi.stubEnv('DEEPGRAM_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    const res = await GET()
    expect(res.status).toBe(503)
  })

  it('returns 200 with token on success', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    vi.stubEnv('DEEPGRAM_API_KEY', 'dg-test-key')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    mockGrantToken.mockResolvedValue({
      result: { access_token: 'tmp-token-abc', expires_in: 30 },
      error: null,
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual({ token: 'tmp-token-abc', expires_in: 30 })
  })

  it('does not expose API keys in response body', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    vi.stubEnv('DEEPGRAM_API_KEY', 'dg-secret-key')
    vi.stubEnv('OPENAI_API_KEY', 'sk-secret')
    mockGrantToken.mockResolvedValue({
      result: { access_token: 'tmp-token', expires_in: 30 },
      error: null,
    })

    const res = await GET()
    const text = JSON.stringify(await res.json())
    expect(text).not.toContain('dg-secret-key')
    expect(text).not.toContain('sk-secret')
  })

  it('returns 502 when Deepgram SDK errors', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    vi.stubEnv('DEEPGRAM_API_KEY', 'dg-test-key')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    mockGrantToken.mockResolvedValue({
      result: null,
      error: { message: 'Invalid credentials' },
    })

    const res = await GET()
    expect(res.status).toBe(502)
  })
})
