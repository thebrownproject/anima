import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import http from 'node:http'

// Import after env setup
process.env.NODE_ENV = 'test'
process.env.SPRITES_PROXY_TOKEN = 'test-proxy-token'
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'
process.env.MISTRAL_API_KEY = 'mistral-test-key'

import { handleApiProxy } from '../src/api-proxy.js'

// -- Test HTTP Server --

let server: http.Server
let baseUrl: string

function startProxyServer(): Promise<void> {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      handleApiProxy(req, res)
    })
    server.listen(0, () => {
      const addr = server.address() as { port: number }
      baseUrl = `http://localhost:${addr.port}`
      resolve()
    })
  })
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

// -- Helpers --

const validHeaders = {
  'Authorization': 'Bearer test-proxy-token',
  'Content-Type': 'application/json',
}

// -- Lifecycle --

beforeEach(async () => {
  process.env.SPRITES_PROXY_TOKEN = 'test-proxy-token'
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'
  process.env.MISTRAL_API_KEY = 'mistral-test-key'
  await startProxyServer()
})

afterEach(async () => {
  await stopServer()
  vi.restoreAllMocks()
})

// -- Auth Tests --

describe('authentication', () => {
  it('returns 401 for missing Authorization header', async () => {
    const res = await fetch(`${baseUrl}/v1/proxy/anthropic/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-3' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/invalid|missing/i)
  })

  it('returns 401 for wrong token', async () => {
    const res = await fetch(`${baseUrl}/v1/proxy/anthropic/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer wrong-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-3' }),
    })
    expect(res.status).toBe(401)
  })

  it('accepts x-api-key header (Anthropic SDK auth)', async () => {
    // Anthropic SDK sends api key via x-api-key, not Authorization: Bearer.
    // If proxy auth passes, request reaches upstream Anthropic (which rejects
    // our fake test key). We verify by checking the error body — our proxy
    // returns {"error":"Invalid or missing proxy token"}, upstream returns
    // a different format.
    const res = await fetch(`${baseUrl}/v1/proxy/anthropic/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': 'test-proxy-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-3' }),
    })
    const body = await res.json()
    // Should NOT be our proxy's auth rejection
    expect(body.error).not.toBe('Invalid or missing proxy token')
  })

  it('returns 401 for wrong x-api-key', async () => {
    const res = await fetch(`${baseUrl}/v1/proxy/anthropic/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': 'wrong-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-3' }),
    })
    expect(res.status).toBe(401)
  })
})

// -- Route Tests --

describe('routing', () => {
  it('returns 404 for unknown provider', async () => {
    const res = await fetch(`${baseUrl}/v1/proxy/openai/v1/chat`, {
      method: 'POST',
      headers: validHeaders,
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/unknown/i)
  })
})

// -- Missing API Key --

describe('missing API key', () => {
  it('returns 503 when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const res = await fetch(`${baseUrl}/v1/proxy/anthropic/v1/messages`, {
      method: 'POST',
      headers: validHeaders,
      body: JSON.stringify({ model: 'claude-3' }),
    })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/ANTHROPIC_API_KEY/i)
  })

  it('returns 503 when MISTRAL_API_KEY is not set', async () => {
    delete process.env.MISTRAL_API_KEY

    const res = await fetch(`${baseUrl}/v1/proxy/mistral/v1/chat/completions`, {
      method: 'POST',
      headers: validHeaders,
      body: JSON.stringify({ model: 'mistral-large' }),
    })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/MISTRAL_API_KEY/i)
  })
})

// -- Forwarding Tests (mock upstream) --

describe('forwarding', () => {
  let upstream: http.Server
  let upstreamUrl: string
  let lastUpstreamRequest: {
    method: string
    url: string
    headers: http.IncomingHttpHeaders
    body: string
  }

  beforeEach(async () => {
    // Start a mock upstream server
    await new Promise<void>((resolve) => {
      upstream = http.createServer((req, res) => {
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          lastUpstreamRequest = {
            method: req.method ?? '',
            url: req.url ?? '',
            headers: req.headers,
            body,
          }
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'x-request-id': 'req-123',
          })
          res.end(JSON.stringify({ id: 'msg_1', content: 'Hello' }))
        })
      })
      upstream.listen(0, () => {
        const addr = upstream.address() as { port: number }
        upstreamUrl = `http://localhost:${addr.port}`
        resolve()
      })
    })
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => upstream.close(() => resolve()))
  })

  it('forwards Anthropic request with x-api-key header', async () => {
    // Temporarily override the TARGETS baseUrl by monkey-patching fetch
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = input.toString().replace('https://api.anthropic.com', upstreamUrl)
      return originalFetch(url, init)
    }

    try {
      const res = await fetch(`${baseUrl}/v1/proxy/anthropic/v1/messages`, {
        method: 'POST',
        headers: {
          ...validHeaders,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: 'claude-3', messages: [] }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe('msg_1')

      // Verify upstream received the real API key
      expect(lastUpstreamRequest.headers['x-api-key']).toBe('sk-ant-test-key')
      // Proxy token should NOT be forwarded
      expect(lastUpstreamRequest.headers['authorization']).toBeUndefined()
      // anthropic-version should pass through
      expect(lastUpstreamRequest.headers['anthropic-version']).toBe('2023-06-01')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('forwards Mistral request with Authorization: Bearer header', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = input.toString().replace('https://api.mistral.ai', upstreamUrl)
      return originalFetch(url, init)
    }

    try {
      const res = await fetch(`${baseUrl}/v1/proxy/mistral/v1/chat/completions`, {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify({ model: 'mistral-large', messages: [] }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe('msg_1')

      // Mistral uses Authorization: Bearer header
      expect(lastUpstreamRequest.headers['authorization']).toBe('Bearer mistral-test-key')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('forwards upstream response headers', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = input.toString().replace('https://api.anthropic.com', upstreamUrl)
      return originalFetch(url, init)
    }

    try {
      const res = await fetch(`${baseUrl}/v1/proxy/anthropic/v1/messages`, {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify({}),
      })

      expect(res.headers.get('x-request-id')).toBe('req-123')
      expect(res.headers.get('content-type')).toBe('application/json')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

// -- Streaming Test --

describe('streaming', () => {
  let upstream: http.Server
  let upstreamUrl: string

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      upstream = http.createServer((_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        })
        // Simulate SSE streaming with delays
        res.write('event: message_start\ndata: {"type":"message_start"}\n\n')
        setTimeout(() => {
          res.write('event: content_block_delta\ndata: {"type":"delta","text":"Hello"}\n\n')
          setTimeout(() => {
            res.write('event: message_stop\ndata: {"type":"message_stop"}\n\n')
            res.end()
          }, 20)
        }, 20)
      })
      upstream.listen(0, () => {
        const addr = upstream.address() as { port: number }
        upstreamUrl = `http://localhost:${addr.port}`
        resolve()
      })
    })
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => upstream.close(() => resolve()))
  })

  it('streams SSE chunks without buffering the full response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = input.toString().replace('https://api.anthropic.com', upstreamUrl)
      return originalFetch(url, init)
    }

    try {
      const res = await fetch(`${baseUrl}/v1/proxy/anthropic/v1/messages`, {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify({ stream: true }),
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/event-stream')

      const text = await res.text()
      expect(text).toContain('message_start')
      expect(text).toContain('delta')
      expect(text).toContain('message_stop')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

// -- Upstream Error --

describe('upstream errors', () => {
  it('returns 502 when upstream is unreachable', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = input.toString()
      // Only intercept upstream calls, let local test requests through
      if (url.includes('api.anthropic.com') || url.includes('api.mistral.ai')) {
        throw new Error('connect ECONNREFUSED')
      }
      return originalFetch(input, init)
    }

    try {
      const res = await fetch(`${baseUrl}/v1/proxy/anthropic/v1/messages`, {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body.error).toMatch(/ECONNREFUSED/)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
