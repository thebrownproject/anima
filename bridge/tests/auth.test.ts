/**
 * Tests for the auth module.
 *
 * Mocks @clerk/backend verifyToken and @supabase/supabase-js to test
 * the auth flow without external dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @clerk/backend before importing auth module
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}))

// Mock @supabase/supabase-js before importing auth module
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
  lookupStack,
  resetSupabaseClient,
} from '../src/auth.js'

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks()
  resetSupabaseClient()

  // Set env vars for tests
  process.env.CLERK_JWT_KEY = 'test-jwt-key'
  process.env.CLERK_SECRET_KEY = 'test-secret-key'
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'test-service-key'

  // Chain mock: from().select().eq().single()
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

// =============================================================================
// verifyClerkToken
// =============================================================================

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

// =============================================================================
// lookupStack
// =============================================================================

describe('lookupStack', () => {
  it('returns stack data when user owns the stack', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'stack_1', user_id: 'user_123', sprite_name: 'sprite-abc', sprite_status: 'active' },
      error: null,
    })

    const stack = await lookupStack('stack_1', 'user_123')
    expect(stack).toEqual({
      id: 'stack_1',
      user_id: 'user_123',
      sprite_name: 'sprite-abc',
      sprite_status: 'active',
    })
  })

  it('throws when stack not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await expect(lookupStack('nonexistent', 'user_123')).rejects.toThrow('Stack not found: nonexistent')
  })

  it('throws when user does not own the stack', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'stack_1', user_id: 'other_user', sprite_name: null, sprite_status: 'pending' },
      error: null,
    })

    await expect(lookupStack('stack_1', 'user_123')).rejects.toThrow('does not own stack')
  })
})

// =============================================================================
// authenticateConnection
// =============================================================================

describe('authenticateConnection', () => {
  it('returns AuthResult on successful auth', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockResolvedValue({ sub: 'user_123' } as any)
    mockSingle.mockResolvedValue({
      data: { id: 'stack_1', user_id: 'user_123', sprite_name: 'sprite-abc', sprite_status: 'active' },
      error: null,
    })

    const result = await authenticateConnection('valid-token', 'stack_1')

    expect(isAuthError(result)).toBe(false)
    if (!isAuthError(result)) {
      expect(result.userId).toBe('user_123')
      expect(result.stackId).toBe('stack_1')
      expect(result.spriteName).toBe('sprite-abc')
      expect(result.spriteStatus).toBe('active')
    }
  })

  it('returns code 4001 on invalid JWT', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockRejectedValue(new Error('Invalid'))

    const result = await authenticateConnection('bad-token', 'stack_1')

    expect(isAuthError(result)).toBe(true)
    if (isAuthError(result)) {
      expect(result.code).toBe(4001)
      expect(result.reason).toContain('Invalid or expired JWT')
    }
  })

  it('returns code 4003 when user does not own stack', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockResolvedValue({ sub: 'user_123' } as any)
    mockSingle.mockResolvedValue({
      data: { id: 'stack_1', user_id: 'other_user', sprite_name: null, sprite_status: 'pending' },
      error: null,
    })

    const result = await authenticateConnection('valid-token', 'stack_1')

    expect(isAuthError(result)).toBe(true)
    if (isAuthError(result)) {
      expect(result.code).toBe(4003)
      expect(result.reason).toContain('do not own')
    }
  })

  it('returns code 4003 when stack not found', async () => {
    const mockVerify = vi.mocked(verifyToken)
    mockVerify.mockResolvedValue({ sub: 'user_123' } as any)
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const result = await authenticateConnection('valid-token', 'nonexistent')

    expect(isAuthError(result)).toBe(true)
    if (isAuthError(result)) {
      expect(result.code).toBe(4003)
      expect(result.reason).toContain('not found')
    }
  })
})

// =============================================================================
// isAuthError
// =============================================================================

describe('isAuthError', () => {
  it('returns true for AuthError', () => {
    expect(isAuthError({ code: 4001, reason: 'Bad token' })).toBe(true)
  })

  it('returns false for AuthResult', () => {
    expect(isAuthError({
      userId: 'user_123',
      stackId: 'stack_1',
      spriteName: 'sprite-abc',
      spriteStatus: 'active',
    })).toBe(false)
  })
})
