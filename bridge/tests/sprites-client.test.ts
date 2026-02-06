import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createSprite,
  getSprite,
  deleteSprite,
  listExecSessions,
  listCheckpoints,
  restoreCheckpoint,
  buildExecUrl,
  buildProxyUrl,
  configureSpritesClient,
  resetSpritesClient,
} from '../src/sprites-client.js'

// -- Setup --

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  configureSpritesClient({ token: 'test-token', baseUrl: 'https://api.test.dev' })
})

afterEach(() => {
  vi.restoreAllMocks()
  resetSpritesClient()
})

function mockJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response
}

// -- createSprite --

describe('createSprite', () => {
  it('sends POST with name and returns sprite info', async () => {
    const sprite = { id: 'sp_1', name: 'test-sprite', status: 'cold', organization: 'org', created_at: '2026-01-01' }
    mockFetch.mockResolvedValue(mockJsonResponse(sprite, 201))

    const result = await createSprite('test-sprite')

    expect(result).toEqual(sprite)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.dev/v1/sprites',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test-sprite' }),
      }),
    )
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse('conflict', 409))

    await expect(createSprite('existing')).rejects.toThrow('failed (409)')
  })
})

// -- getSprite --

describe('getSprite', () => {
  it('sends GET and returns sprite info', async () => {
    const sprite = { id: 'sp_1', name: 'my-sprite', status: 'running' }
    mockFetch.mockResolvedValue(mockJsonResponse(sprite))

    const result = await getSprite('my-sprite')

    expect(result).toEqual(sprite)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.dev/v1/sprites/my-sprite',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('throws when sprite not found', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse('not found', 404))

    await expect(getSprite('nonexistent')).rejects.toThrow('failed (404)')
  })
})

// -- deleteSprite --

describe('deleteSprite', () => {
  it('sends DELETE request', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({}, 200))

    await deleteSprite('old-sprite')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.dev/v1/sprites/old-sprite',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

// -- listExecSessions --

describe('listExecSessions', () => {
  it('returns session list', async () => {
    const data = { count: 1, sessions: [{ id: 28, command: 'python3', is_active: true }] }
    mockFetch.mockResolvedValue(mockJsonResponse(data))

    const result = await listExecSessions('my-sprite')

    expect(result.count).toBe(1)
    expect(result.sessions[0].id).toBe(28)
  })
})

// -- Checkpoints --

describe('restoreCheckpoint', () => {
  it('sends POST to restore endpoint', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({}))

    await restoreCheckpoint('my-sprite', 'cp-123')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.dev/v1/sprites/my-sprite/checkpoints/cp-123/restore',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('listCheckpoints', () => {
  it('returns checkpoint list', async () => {
    const data = { checkpoints: [{ id: 'cp-1', sprite_name: 'my-sprite', created_at: '2026-01-01' }] }
    mockFetch.mockResolvedValue(mockJsonResponse(data))

    const result = await listCheckpoints('my-sprite')
    expect(result.checkpoints).toHaveLength(1)
  })
})

// -- buildExecUrl --

describe('buildExecUrl', () => {
  it('builds WSS URL with command args and max_run_after_disconnect=0', () => {
    const url = buildExecUrl('my-sprite', ['python3', '/workspace/src/server.py'])

    expect(url).toContain('wss://api.test.dev/v1/sprites/my-sprite/exec')
    expect(url).toContain('cmd=python3')
    expect(url).toContain('cmd=%2Fworkspace%2Fsrc%2Fserver.py')
    expect(url).toContain('max_run_after_disconnect=0')
  })

  it('injects API keys as env vars', () => {
    const url = buildExecUrl('my-sprite', ['python3', 'server.py'], {
      ANTHROPIC_API_KEY: 'sk-ant-123',
      MISTRAL_API_KEY: 'mk-456',
    })

    expect(url).toContain('env=ANTHROPIC_API_KEY%3Dsk-ant-123')
    expect(url).toContain('env=MISTRAL_API_KEY%3Dmk-456')
  })

  it('works without env vars', () => {
    const url = buildExecUrl('my-sprite', ['echo', 'hello'])

    expect(url).not.toContain('env=')
    expect(url).toContain('cmd=echo')
    expect(url).toContain('cmd=hello')
  })
})

// -- buildProxyUrl --

describe('buildProxyUrl', () => {
  it('builds WSS proxy URL', () => {
    const url = buildProxyUrl('my-sprite')
    expect(url).toBe('wss://api.test.dev/v1/sprites/my-sprite/proxy')
  })
})

// -- Auth header --

describe('auth header', () => {
  it('includes Bearer token in requests', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ id: '1', name: 's', status: 'cold' }))

    await getSprite('any')

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1].headers.Authorization).toBe('Bearer test-token')
  })
})

// -- Missing token --

describe('missing config', () => {
  it('throws when no token configured and no env var', async () => {
    resetSpritesClient()
    delete process.env.SPRITES_TOKEN

    await expect(getSprite('any')).rejects.toThrow('Missing SPRITES_TOKEN')
  })
})
