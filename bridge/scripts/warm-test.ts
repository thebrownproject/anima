/**
 * Quick warm-mission test — connects to already-running server via TCP proxy.
 * Prints timing for each event relative to script start.
 */
import { configureSpritesClient, buildProxyUrl } from '../src/sprites-client.js'
import WebSocket from 'ws'

const TOKEN = process.env.SPRITES_TOKEN || ''
const PROXY_TOKEN = process.env.SPRITES_PROXY_TOKEN || ''
const SPRITE = process.argv[2] || 'sd-e2e-test'
const QUESTION = process.argv[3] || 'What is the capital of Australia? Reply with just the city name.'

configureSpritesClient({ token: TOKEN })

const proxyUrl = buildProxyUrl(SPRITE)
console.log(`[1] Connecting to TCP proxy...`)
const t0 = Date.now()
const ws = new WebSocket(proxyUrl, { headers: { Authorization: `Bearer ${TOKEN}` } })

let initDone = false

ws.on('open', () => {
  ws.send(JSON.stringify({ host: 'localhost', port: 8765 }))
})

ws.on('message', (d: Buffer) => {
  const text = Buffer.isBuffer(d) ? d.toString('utf-8') : d.toString()

  if (!initDone) {
    initDone = true
    console.log(`[2] Proxy init: ${text} (+${Date.now() - t0}ms)`)

    const msg = JSON.stringify({
      id: 'warm-' + Date.now(),
      type: 'mission',
      timestamp: Date.now(),
      payload: { text: QUESTION },
    })
    console.log(`[3] Sending mission... (+${Date.now() - t0}ms)`)
    ws.send(Buffer.from(msg + '\n', 'utf-8'))
    return
  }

  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const m = JSON.parse(line)
      const delta = Date.now() - t0
      if (m.type === 'system') {
        console.log(`[ack] ${m.payload?.message} (+${delta}ms)`)
      } else if (m.type === 'agent_event') {
        console.log(`[agent:${m.payload?.event_type}] ${m.payload?.content} (+${delta}ms)`)
        if (m.payload?.event_type === 'complete' || m.payload?.event_type === 'error') {
          ws.close()
          process.exit(0)
        }
      } else {
        console.log(`[msg] ${line} (+${delta}ms)`)
      }
    } catch {
      console.log(`[raw] ${line} (+${Date.now() - t0}ms)`)
    }
  }
})

ws.on('error', (e) => { console.error('Error:', e.message); process.exit(1) })
setTimeout(() => { console.log('[timeout] 60s'); ws.close(); process.exit(0) }, 60_000)
