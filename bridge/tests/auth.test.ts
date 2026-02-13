import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}))

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { verifyToken } from '@clerk/backend'
import {
  authenticateConnection,
  isAuthError,
  verifyClerkToken,
  lookupUser,
  resetSupabaseClient,
} from '../src/auth.js'

beforeEach(() => {
  vi.clearAllMocks()
  resetSupabaseClient()

  process.env.CLERK_JWT_KEY = 'test-jwt-key'
  process.env.CLERK_SECRET_KEY = 'test-secret-key'
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'test-service-key'

  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ single: mockSingle })
})

afterEach(() => {
  delete process.env.CLERK_JWT_KEY
  delete process.env.CLERK_SECRET_KEY
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_KEY
})

describe('verifyClerkToken', () => {
  it('returns userId on successful verification', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockResolvedValue({ sub: 'user_123', exp: 0, iat: 0, iss: '', nbf: 0 } as any)

    const userId = await verifyClerkToken('valid-token')
    expect(userId).toBe('user_123')
    expect(mockVerify).toHaveBeenCalledWith('valid-token', expect.objectContaining({
      jwtKey: 'test-jwt-key',
      clockSkewInMs: 10_000,
    }))
  })

  it('throws on invalid token', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockRejectedValue(new Error('Token verification failed'))

    await expect(verifyClerkToken('bad-token')).rejects.toThrow('Token verification failed')
  })

  it('throws when JWT has no sub claim', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockResolvedValue({ sub: undefined } as any)

    await expect(verifyClerkToken('no-sub-token')).rejects.toThrow('JWT missing sub claim')
  })

  it('throws when no Clerk env vars are set', async () => {
    delete process.env.CLERK_JWT_KEY
    delete process.env.CLERK_SECRET_KEY

    await expect(verifyClerkToken('any-token')).rejects.toThrow('Missing CLERK_JWT_KEY or CLERK_SECRET_KEY')
  })
})

describe('lookupUser', () => {
  it('returns user data with sprite mapping', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'user_123', sprite_name: 'sprite-abc', sprite_status: 'active' },
      error: null,
    })

    const user = await lookupUser('user_123')
    expect(user).toEqual({
      id: 'user_123',
      sprite_name: 'sprite-abc',
      sprite_status: 'active',
    })
    expect(mockFrom).toHaveBeenCalledWith('users')
  })

  it('throws when user not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await expect(lookupUser('nonexistent')).rejects.toThrow('User not found: nonexistent')
  })

  it('returns user with no sprite assigned', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'user_123', sprite_name: null, sprite_status: 'pending' },
      error: null,
    })

    const user = await lookupUser('user_123')
    expect(user.sprite_name).toBeNull()
    expect(user.sprite_status).toBe('pending')
  })
})

describe('authenticateConnection', () => {
  it('returns AuthResult with userId, no stackId', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockResolvedValue({ sub: 'user_123' } as any)
    mockSingle.mockResolvedValue({
      data: { id: 'user_123', sprite_name: 'sprite-abc', sprite_status: 'active' },
      error: null,
    })

    const result = await authenticateConnection('valid-token')

    expect(isAuthError(result)).toBe(false)
    if (!isAuthError(result)) {
      expect(result.userId).toBe('user_123')
      expect(result).not.toHaveProperty('stackId')
      expect(result.spriteName).toBe('sprite-abc')
      expect(result.spriteStatus).toBe('active')
    }
  })

  it('queries users table (not stacks)', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockResolvedValue({ sub: 'user_123' } as any)
    mockSingle.mockResolvedValue({
      data: { id: 'user_123', sprite_name: null, sprite_status: 'pending' },
      error: null,
    })

    await authenticateConnection('valid-token')

    expect(mockFrom).toHaveBeenCalledWith('users')
  })

  it('returns code 4001 on invalid JWT', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockRejectedValue(new Error('Invalid'))

    const result = await authenticateConnection('bad-token')

    expect(isAuthError(result)).toBe(true)
    if (isAuthError(result)) {
      expect(result.code).toBe(4001)
      expect(result.reason).toContain('Invalid or expired JWT')
    }
  })

  it('returns code 4003 when user not found', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockResolvedValue({ sub: 'user_123' } as any)
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const result = await authenticateConnection('valid-token')

    expect(isAuthError(result)).toBe(true)
    if (isAuthError(result)) {
      expect(result.code).toBe(4003)
      expect(result.reason).toContain('User not found')
    }
  })
})

describe('isAuthError', () => {
  it('returns true for AuthError', () => {
    expect(isAuthError({ code: 4001, reason: 'Bad token' })).toBe(true)
  })

  it('returns false for AuthResult', () => {
    expect(isAuthError({
      userId: 'user_123',
      spriteName: 'sprite-abc',
      spriteStatus: 'active',
    })).toBe(false)
  })
})
