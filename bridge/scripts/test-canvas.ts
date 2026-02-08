/**
 * Proxy-only test — connects to an already-running Sprite server
 * and sends a mission that should trigger canvas card creation.
 */
import { configureSpritesClient, buildProxyUrl } from '../src/sprites-client.js'
import WebSocket from 'ws'

const SPRITE = process.argv[2] || 'sd-e2e-test'
const TOKEN = process.env.SPRITES_TOKEN || ''
configureSpritesClient({ token: TOKEN })

async function connectProxy(): Promise<WebSocket> {
  console.log('[1] Connecting via TCP proxy...')
  const proxyUrl = buildProxyUrl(SPRITE)
  const ws = new WebSocket(proxyUrl, { headers: { Authorization: `Bearer ${TOKEN}` } })

  return new Promise((resolve, reject) => {
    let initDone = false
    ws.on('open', () => ws.send(JSON.stringify({ host: 'localhost', port: 8765 })))
    ws.on('message', (d: Buffer) => {
      const text = d.toString()
      if (!initDone) {
        initDone = true
        console.log(`[2] Proxy init: ${text}`)
        try {
          const r = JSON.parse(text)
          if (r.status === 'connected' || r.type === 'port_opened') { resolve(ws); return }
        } catch {}
        resolve(ws)
      }
    })
    ws.on('error', reject)
    setTimeout(() => reject(new Error('Proxy timeout')), 15_000)
  })
}

async function main() {
  console.log(`\n=== Canvas Test: ${SPRITE} ===\n`)

  const proxyWs = await connectProxy()
  console.log('[2] Connected\n')

  // Send mission asking agent to create a canvas card
  const msg = JSON.stringify({
    id: 'canvas-test-' + Date.now(),
    type: 'mission',
    timestamp: Date.now(),
    payload: {
      text: 'Create a card titled "Test Card" with a heading block that says "Hello World" and a text block with content "Testing canvas". Use the create_card tool.',
    },
  })
  console.log('[3] Sending canvas mission...\n')
  proxyWs.send(Buffer.from(msg + '\n', 'utf-8'))

  // Listen for all events
  let gotCanvas = false
  proxyWs.on('message', (d: Buffer) => {
    try {
      const m = JSON.parse(d.toString())
      const label = m.type === 'agent_event' ? `agent_event:${m.payload?.event_type}` : m.type
      console.log(`[event] ${label}`)
      if (m.type === 'canvas_update') {
        gotCanvas = true
        console.log('  >>> CANVAS UPDATE RECEIVED <<<')
        console.log('  command:', m.payload?.command)
        console.log('  card_id:', m.payload?.card_id)
        console.log('  title:', m.payload?.title)
        console.log('  blocks:', m.payload?.blocks?.length, 'blocks')
      }
      if (m.payload?.content) {
        console.log('  content:', m.payload.content.substring(0, 200))
      }
    } catch {
      console.log(`[raw] ${d.toString().substring(0, 200)}`)
    }
  })

  // Wait for completion
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
    setTimeout(() => { if (!done) { console.log('\n[timeout]'); resolve() } }, 90_000)
  })

  console.log(`\n=== Result: canvas_update ${gotCanvas ? 'RECEIVED' : 'NOT received'} ===`)
  proxyWs.close()
  process.exit(gotCanvas ? 0 : 1)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
