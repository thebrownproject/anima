/**
 * HTTP reverse proxy for API keys.
 *
 * Sprites send requests here instead of directly to Anthropic/Mistral.
 * Bridge validates SPRITES_PROXY_TOKEN, injects the real API key,
 * and streams the response back. Sprites never hold master keys.
 */

import { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'

interface ProxyTarget {
  baseUrl: string
  injectAuth: (headers: Record<string, string>, apiKey: string) => void
  envKey: string
}

const TARGETS: Record<string, ProxyTarget> = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    injectAuth: (h, key) => { h['x-api-key'] = key },
    envKey: 'ANTHROPIC_API_KEY',
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai',
    injectAuth: (h, key) => { h['authorization'] = `Bearer ${key}` },
    envKey: 'MISTRAL_API_KEY',
  },
}

// Headers to strip from the inbound request before forwarding
const STRIPPED_HEADERS = new Set([
  'host', 'connection', 'authorization', 'x-api-key',
  'transfer-encoding', 'content-length',
])

function collectBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function parseRoute(url: string): { provider: string; path: string } | null {
  // /v1/proxy/anthropic/v1/messages -> provider=anthropic, path=/v1/messages
  const match = url.match(/^\/v1\/proxy\/(anthropic|mistral)(\/.*)$/)
  if (!match) return null
  return { provider: match[1], path: match[2] }
}

export async function handleApiProxy(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const route = parseRoute(req.url ?? '')
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unknown proxy route' }))
    return
  }

  // Validate proxy token — accept via x-api-key (Anthropic SDK) or Authorization: Bearer (Mistral SDK)
  const proxyToken = process.env.SPRITES_PROXY_TOKEN
  const xApiKey = req.headers['x-api-key'] as string | undefined
  const authHeader = req.headers['authorization']
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const token = xApiKey ?? bearerToken

  const { timingSafeEqual } = await import('node:crypto')
  if (!proxyToken || !token || Buffer.byteLength(token) !== Buffer.byteLength(proxyToken) || !timingSafeEqual(Buffer.from(token), Buffer.from(proxyToken))) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid or missing proxy token' }))
    return
  }

  // Check that we have the upstream API key
  const target = TARGETS[route.provider]
  const apiKey = process.env[target.envKey]
  if (!apiKey) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `${target.envKey} not configured` }))
    return
  }

  // Build outbound headers — pass through request headers, replace auth
  const outHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (STRIPPED_HEADERS.has(key.toLowerCase()) || !value) continue
    outHeaders[key] = Array.isArray(value) ? value.join(', ') : value
  }
  target.injectAuth(outHeaders, apiKey)

  // Collect request body and forward
  const body = await collectBody(req)
  const upstream = `${target.baseUrl}${route.path}`

  let fetchRes: Response
  try {
    fetchRes = await fetch(upstream, {
      method: req.method ?? 'POST',
      headers: outHeaders,
      ...(body.length > 0 ? { body } : {}),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upstream request failed'
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: msg }))
    return
  }

  // Forward status + headers from upstream
  const responseHeaders: Record<string, string> = {}
  fetchRes.headers.forEach((value, key) => {
    // Skip hop-by-hop headers
    if (key === 'transfer-encoding' || key === 'connection') return
    responseHeaders[key] = value
  })
  res.writeHead(fetchRes.status, responseHeaders)

  // Stream the response body
  if (!fetchRes.body) {
    res.end()
    return
  }

  const readable = Readable.fromWeb(fetchRes.body as import('node:stream/web').ReadableStream)
  readable.pipe(res)
  readable.on('error', () => {
    if (!res.writableEnded) res.end()
  })
}
