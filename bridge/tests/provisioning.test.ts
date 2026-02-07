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
  generateSpriteName,
  buildServerExecUrl,
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

// -- generateSpriteName --

describe('generateSpriteName', () => {
  it('generates a name with sd- prefix from stack ID', () => {
    const name = generateSpriteName('stack_123')
    expect(name).toMatch(/^sd-stack-123-[a-z0-9]{4}$/)
  })

  it('lowercases and strips invalid chars', () => {
    const name = generateSpriteName('Stack.With$Specials!')
    expect(name).toMatch(/^sd-stack-with-specials--[a-z0-9]{4}$/)
  })

  it('truncates long IDs', () => {
    const longId = 'a'.repeat(100)
    const name = generateSpriteName(longId)
    // sd- (3) + 40 chars + - (1) + 4 = 48 max
    expect(name.length).toBeLessThanOrEqual(49)
  })
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

  it('does not call buildExecUrl (caller uses buildServerExecUrl)', async () => {
    await provisionSprite('stack_1')

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

// -- buildServerExecUrl --

describe('buildServerExecUrl', () => {
  it('delegates to buildExecUrl with proxy env vars for Sprites', () => {
    process.env.SPRITES_PROXY_TOKEN = 'proxy-tok'
    process.env.BRIDGE_PUBLIC_URL = 'https://ws.stackdocs.io'
    vi.mocked(buildExecUrl).mockReturnValue('wss://exec-url')

    const url = buildServerExecUrl('my-sprite')

    expect(buildExecUrl).toHaveBeenCalledWith(
      'my-sprite',
      ['bash', '-c', 'cd /workspace && /workspace/.venv/bin/python3 -m src.server'],
      {
        ANTHROPIC_BASE_URL: 'https://ws.stackdocs.io/v1/proxy/anthropic',
        ANTHROPIC_API_KEY: 'proxy-tok',
        MISTRAL_BASE_URL: 'https://ws.stackdocs.io/v1/proxy/mistral',
        MISTRAL_API_KEY: 'proxy-tok',
      },
    )
    expect(url).toBe('wss://exec-url')

    delete process.env.SPRITES_PROXY_TOKEN
    delete process.env.BRIDGE_PUBLIC_URL
  })

  it('defaults BRIDGE_PUBLIC_URL to ws.stackdocs.io', () => {
    process.env.SPRITES_PROXY_TOKEN = 'tok'
    delete process.env.BRIDGE_PUBLIC_URL
    vi.mocked(buildExecUrl).mockReturnValue('wss://exec-url')

    buildServerExecUrl('my-sprite')

    const envVars = vi.mocked(buildExecUrl).mock.calls[0][2] as Record<string, string>
    expect(envVars.ANTHROPIC_BASE_URL).toBe('https://ws.stackdocs.io/v1/proxy/anthropic')
    expect(envVars.MISTRAL_BASE_URL).toBe('https://ws.stackdocs.io/v1/proxy/mistral')

    delete process.env.SPRITES_PROXY_TOKEN
  })
})
