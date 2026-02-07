/**
 * Simplified e2e test — starts server, connects via proxy, sends mission.
 * Keeps server WS open so we can see errors in real-time.
 */
import { configureSpritesClient, buildExecUrl, buildProxyUrl } from '../src/sprites-client.js'
import WebSocket from 'ws'

const SPRITE = process.argv[2] || 'sd-e2e-test'
const TOKEN = process.env.SPRITES_TOKEN || ''
const PROXY_TOKEN = process.env.SPRITES_PROXY_TOKEN || ''
configureSpritesClient({ token: TOKEN })

async function startServer(): Promise<WebSocket> {
  console.log('[1] Starting server...')
  const url = buildExecUrl(SPRITE, ['bash', '-c', 'cd /workspace && /workspace/.venv/bin/python3 -m src.server 2>&1'], {
    ANTHROPIC_BASE_URL: 'https://ws.stackdocs.io/v1/proxy/anthropic',
    ANTHROPIC_API_KEY: PROXY_TOKEN,
    MISTRAL_BASE_URL: 'https://ws.stackdocs.io/v1/proxy/mistral',
    MISTRAL_API_KEY: PROXY_TOKEN,
  })
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${TOKEN}` } })

  return new Promise((resolve, reject) => {
    let started = false
    ws.on('message', (d: Buffer) => {
      const text = d.toString()
      // Always print server output
      try {
        const m = JSON.parse(text)
        if (m.data) {
          process.stdout.write(`[server] ${m.data}`)
          if (!started && m.data.includes('8765')) {
            started = true
            resolve(ws)
          }
        }
      } catch {
        process.stdout.write(`[server-raw] ${text}\n`)
      }
    })
    ws.on('error', reject)
    setTimeout(() => { if (!started) { console.log('[server] Timeout waiting for startup'); resolve(ws) } }, 10_000)
  })
}

async function connectProxy(): Promise<WebSocket> {
  console.log('[2] Connecting via TCP proxy...')
  const proxyUrl = buildProxyUrl(SPRITE)
  const ws = new WebSocket(proxyUrl, { headers: { Authorization: `Bearer ${TOKEN}` } })

  return new Promise((resolve, reject) => {
    let initDone = false
    ws.on('open', () => ws.send(JSON.stringify({ host: 'localhost', port: 8765 })))
    ws.on('message', (d: Buffer) => {
      const text = d.toString()
      if (!initDone) {
        initDone = true
        console.log(`[proxy] Init: ${text}`)
        try {
          const r = JSON.parse(text)
          if (r.status === 'connected' || r.type === 'port_opened') { resolve(ws); return }
        } catch {}
        resolve(ws) // proceed anyway
      }
    })
    ws.on('error', reject)
    setTimeout(() => reject(new Error('Proxy timeout')), 15_000)
  })
}

async function main() {
  console.log(`\n=== E2E Test v2: ${SPRITE} ===\n`)

  const serverWs = await startServer()
  console.log('[1] Server started\n')

  // Give server a moment to be ready for connections
  await new Promise(r => setTimeout(r, 1000))

  const proxyWs = await connectProxy()
  console.log('[2] Proxy connected\n')

  // Send mission
  const msg = JSON.stringify({
    id: 'test-' + Date.now(),
    type: 'mission',
    timestamp: Date.now(),
    payload: { text: 'What is 2 + 2? Reply with just the number.' },
  })
  console.log(`[3] Sending mission (binary frame)\n`)
  proxyWs.send(Buffer.from(msg + '\n', 'utf-8'))

  // Listen for events from proxy (agent responses)
  proxyWs.on('message', (d: Buffer) => {
    console.log(`[event] ${d.toString()}`)
  })

  // Keep watching server output for 60 seconds
  console.log('[4] Waiting for response (60s timeout)...\n')
  await new Promise<void>((resolve) => {
    let done = false
    proxyWs.on('message', (d: Buffer) => {
      try {
        const m = JSON.parse(d.toString())
        if (m.type === 'agent_event' && (m.payload?.event_type === 'complete' || m.payload?.event_type === 'error')) {
          if (!done) { done = true; resolve() }
        }
      } catch {}
    })
    setTimeout(() => { if (!done) { console.log('\n[timeout]'); resolve() } }, 60_000)
  })

  proxyWs.close()
  serverWs.close()
  console.log('\n=== Done ===')
  process.exit(0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
