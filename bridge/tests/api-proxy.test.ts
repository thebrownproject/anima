import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

// Import after env setup
process.env.NODE_ENV = 'test'
process.env.SPRITES_PROXY_TOKEN = 'test-proxy-token'
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'
process.env.MISTRAL_API_KEY = 'mistral-test-key'

import { handleApiProxy, MAX_BODY_BYTES } from '../src/api-proxy.js'

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

// -- Body Size Limit --

describe('body size limit', () => {
  it('returns 413 for payloads over 10MB', async () => {
    const url = new URL(`${baseUrl}/v1/proxy/anthropic/v1/messages`)
    const totalSize = MAX_BODY_BYTES + (1024 * 1024) // 11MB
    const res = await new Promise<{ status: number; body: string }>((resolve) => {
      const req = http.request({
        hostname: url.hostname,
        port: Number(url.port),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-proxy-token',
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(totalSize),
        },
      }, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      })

      // Ignore write errors (server may close socket after rejecting)
      req.on('error', () => {})

      // Write in chunks -- server rejects after accumulating >10MB
      const chunkSize = 1024 * 1024
      let written = 0
      function writeNext() {
        while (written < totalSize) {
          const size = Math.min(chunkSize, totalSize - written)
          const ok = req.write(Buffer.alloc(size, 0x41))
          written += size
          if (!ok) {
            req.once('drain', writeNext)
            return
          }
        }
        req.end()
      }
      writeNext()
    })

    expect(res.status).toBe(413)
    expect(JSON.parse(res.body).error).toMatch(/too large/i)
  }, 30_000)

  it('accepts payloads under 10MB', async () => {
    const smallBody = Buffer.alloc(1024, 0x41).toString()
    const res = await fetch(`${baseUrl}/v1/proxy/anthropic/v1/messages`, {
      method: 'POST',
      headers: validHeaders,
      body: smallBody,
    })
    expect(res.status).not.toBe(413)
  })
})

// -- Duplicate Headers (string[] values) --
// Node.js HTTP parser joins most duplicate headers with ", " (x-api-key)
// or keeps only the first (authorization). The `firstString()` guard in
// api-proxy.ts defends against the TypeScript string[] union type even
// though the HTTP parser rarely produces actual arrays for these headers.

describe('duplicate headers', () => {
  it('handles duplicate x-api-key via raw socket without crashing', async () => {
    // Duplicate x-api-key gets joined as "test-proxy-token, dup" by Node.js parser.
    // This won't match the proxy token, so expect 401 (not a TypeError crash).
    const url = new URL(`${baseUrl}/v1/proxy/anthropic/v1/messages`)
    const res = await new Promise<{ status: number; body: string }>((resolve) => {
      const net = require('node:net') as typeof import('node:net')
      const sock = net.createConnection(Number(url.port), url.hostname, () => {
        sock.write(
          `POST ${url.pathname} HTTP/1.1\r\n` +
          `Host: ${url.hostname}\r\n` +
          'Connection: close\r\n' +
          'x-api-key: test-proxy-token\r\n' +
          'x-api-key: duplicate-value\r\n' +
          'Content-Type: application/json\r\n' +
          'Content-Length: 2\r\n' +
          '\r\n' +
          '{}'
        )
      })
      let raw = ''
      sock.on('data', (chunk: Buffer) => { raw += chunk.toString() })
      sock.on('end', () => {
        const statusMatch = raw.match(/HTTP\/1\.1 (\d+)/)
        const bodyStart = raw.indexOf('\r\n\r\n')
        resolve({
          status: statusMatch ? parseInt(statusMatch[1]) : 0,
          body: bodyStart >= 0 ? raw.slice(bodyStart + 4) : '',
        })
      })
    })

    expect(res.status).toBe(401)
  })

  it('handles duplicate authorization via raw socket without crashing', async () => {
    // Node.js keeps only the first Authorization header.
    // Even with duplicates, the server should respond without crashing.
    const url = new URL(`${baseUrl}/v1/proxy/anthropic/v1/messages`)
    const res = await new Promise<{ status: number; body: string }>((resolve) => {
      const net = require('node:net') as typeof import('node:net')
      const sock = net.createConnection(Number(url.port), url.hostname, () => {
        sock.write(
          `POST ${url.pathname} HTTP/1.1\r\n` +
          `Host: ${url.hostname}\r\n` +
          'Connection: close\r\n' +
          'Authorization: Bearer wrong-token-1\r\n' +
          'Authorization: Bearer wrong-token-2\r\n' +
          'Content-Type: application/json\r\n' +
          'Content-Length: 2\r\n' +
          '\r\n' +
          '{}'
        )
      })
      let raw = ''
      sock.on('data', (chunk: Buffer) => { raw += chunk.toString() })
      sock.on('end', () => {
        const statusMatch = raw.match(/HTTP\/1\.1 (\d+)/)
        const bodyStart = raw.indexOf('\r\n\r\n')
        resolve({
          status: statusMatch ? parseInt(statusMatch[1]) : 0,
          body: bodyStart >= 0 ? raw.slice(bodyStart + 4) : '',
        })
      })
    })

    // Should get 401 (wrong tokens), not a process crash
    expect(res.status).toBe(401)
  })
})

// -- Static Import --

describe('static import', () => {
  it('imports node:crypto statically (not dynamic per-request)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/api-proxy.ts'),
      'utf-8',
    )
    // Should have static import at top
    expect(source).toMatch(/^import\s+\{[^}]*timingSafeEqual[^}]*\}\s+from\s+'node:crypto'/m)
    // Should NOT have dynamic await import
    expect(source).not.toMatch(/await\s+import\s*\(\s*['"]node:crypto['"]\s*\)/)
  })
})
