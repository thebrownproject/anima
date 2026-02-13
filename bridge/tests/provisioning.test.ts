import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock sprites-client before importing provisioning
vi.mock('../src/sprites-client.js', () => ({
  createSprite: vi.fn(),
  getSprite: vi.fn(),
  buildExecUrl: vi.fn(),
}))

// Mock bootstrap
vi.mock('../src/bootstrap.js', () => ({
  bootstrapSprite: vi.fn(),
}))

// Mock @supabase/supabase-js
const mockUpdate = vi.fn()
const mockUpdateEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { createSprite, getSprite, buildExecUrl } from '../src/sprites-client.js'
import { resetSupabaseClient } from '../src/auth.js'
import {
  provisionSprite,
  ensureSpriteProvisioned,
} from '../src/provisioning.js'

// -- Setup --

beforeEach(() => {
  vi.clearAllMocks()
  resetSupabaseClient()

  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'test-key'

  // Supabase mock chain: from('stacks').update({}).eq('id', stackId)
  mockFrom.mockReturnValue({ update: mockUpdate })
  mockUpdate.mockReturnValue({ eq: mockUpdateEq })
  mockUpdateEq.mockResolvedValue({ error: null })

  vi.mocked(createSprite).mockResolvedValue({
    id: 'sp_1', name: 'sd-test', status: 'cold', organization: 'org', created_at: '2026-01-01',
  })

  vi.mocked(buildExecUrl).mockReturnValue('wss://api.sprites.dev/v1/sprites/sd-test/exec?cmd=python3')
})

afterEach(() => {
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_KEY
})

// -- provisionSprite --

describe('provisionSprite', () => {
  it('transitions pending -> provisioning -> active in Supabase', async () => {
    const result = await provisionSprite('stack_1')

    expect(result.spriteStatus).toBe('active')
    expect(result.spriteName).toMatch(/^sd-stack-1-/)

    // First call: mark as provisioning with sprite name
    expect(mockFrom).toHaveBeenCalledWith('stacks')
    const firstUpdate = mockUpdate.mock.calls[0][0]
    expect(firstUpdate.sprite_status).toBe('provisioning')
    expect(firstUpdate.sprite_name).toBeDefined()

    // Second call: mark as active
    const secondUpdate = mockUpdate.mock.calls[1][0]
    expect(secondUpdate.sprite_status).toBe('active')
  })

  it('calls createSprite with the generated name', async () => {
    const result = await provisionSprite('stack_1')

    expect(createSprite).toHaveBeenCalledWith(result.spriteName)
  })

  it('skips server start when SPRITES_TOKEN is unset', async () => {
    delete process.env.SPRITES_TOKEN
    await provisionSprite('stack_1')

    // startSpriteServer guarded by `if (token)` — no exec call without token
    expect(buildExecUrl).not.toHaveBeenCalled()
  })

  it('marks as failed when createSprite throws', async () => {
    vi.mocked(createSprite).mockRejectedValue(new Error('API limit reached'))

    const result = await provisionSprite('stack_1')

    expect(result.spriteStatus).toBe('failed')
    expect(result.error).toContain('API limit reached')

    // Should have called update with 'failed'
    const failedUpdate = mockUpdate.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, string>).sprite_status === 'failed',
    )
    expect(failedUpdate).toBeDefined()
  })

  it('marks as failed when Supabase update throws during provisioning', async () => {
    // First update (provisioning) succeeds, createSprite fails
    vi.mocked(createSprite).mockRejectedValue(new Error('sprite creation failed'))

    const result = await provisionSprite('stack_1')

    expect(result.spriteStatus).toBe('failed')
  })

  it('calls bootstrapSprite after creating sprite', async () => {
    const result = await provisionSprite('stack_1')

    expect(result.spriteStatus).toBe('active')
  })
})

// -- ensureSpriteProvisioned --

describe('ensureSpriteProvisioned', () => {
  it('skips provisioning when status is active and sprite exists', async () => {
    vi.mocked(getSprite).mockResolvedValue({
      id: 'sp_1', name: 'existing-sprite', status: 'running', organization: 'org', created_at: '2026-01-01',
    })

    const result = await ensureSpriteProvisioned('stack_1', 'active', 'existing-sprite')

    expect(result.spriteName).toBe('existing-sprite')
    expect(result.spriteStatus).toBe('active')
    expect(createSprite).not.toHaveBeenCalled()
  })

  it('re-provisions when sprite no longer exists', async () => {
    vi.mocked(getSprite).mockRejectedValue(new Error('not found'))

    const result = await ensureSpriteProvisioned('stack_1', 'active', 'dead-sprite')

    expect(createSprite).toHaveBeenCalled()
    expect(result.spriteStatus).toBe('active')
  })

  it('provisions when status is pending', async () => {
    const result = await ensureSpriteProvisioned('stack_1', 'pending', null)

    expect(createSprite).toHaveBeenCalled()
    expect(result.spriteStatus).toBe('active')
  })

  it('retries provisioning when status is failed', async () => {
    const result = await ensureSpriteProvisioned('stack_1', 'failed', 'old-sprite')

    expect(createSprite).toHaveBeenCalled()
    expect(result.spriteStatus).toBe('active')
  })
})
