/**
 * Test that conversation persists across TCP reconnections.
 * Connect → tell agent a number → disconnect → reconnect → ask for number.
 */
import { configureSpritesClient, buildProxyUrl } from '../src/sprites-client.js'
import WebSocket from 'ws'

const SPRITE = process.argv[2] || 'sd-e2e-test'
const TOKEN = process.env.SPRITES_TOKEN || ''
configureSpritesClient({ token: TOKEN })

function connectAndSend(text: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(buildProxyUrl(SPRITE), {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    const events: string[] = []

    ws.on('open', () => {
      ws.send(JSON.stringify({ host: 'localhost', port: 8765 }))
    })

    let initDone = false
    ws.on('message', (d: Buffer) => {
      const raw = d.toString()
      if (!initDone) {
        initDone = true
        const msg = JSON.stringify({
          id: 't-' + Date.now(),
          type: 'mission',
          timestamp: Date.now(),
          payload: { text },
        })
        ws.send(Buffer.from(msg + '\n', 'utf-8'))
        return
      }

      console.log(`  [msg] ${raw.slice(0, 200)}`)
      try {
        const m = JSON.parse(raw)
        if (m.type === 'agent_event') {
          if (m.payload.event_type === 'text') events.push(m.payload.content)
          if (m.payload.event_type === 'complete' || m.payload.event_type === 'error') {
            ws.close()
            resolve(events)
          }
        }
      } catch { /* ignore non-JSON */ }
    })

    ws.on('error', reject)
    setTimeout(() => { ws.close(); resolve(events) }, 60_000)
  })
}

async function main() {
  console.log('=== Turn 1: Tell agent a secret ===')
  const r1 = await connectAndSend('Remember this number: 42. Just say OK.')
  console.log('Response:', r1.join(''))

  console.log('\n=== Turn 2: Disconnect + reconnect, ask for the number ===')
  const r2 = await connectAndSend('What number did I just tell you to remember?')
  console.log('Response:', r2.join(''))

  if (r2.join('').includes('42')) {
    console.log('\n✅ RESUME WORKS — agent remembered across reconnection')
  } else {
    console.log('\n❌ RESUME FAILED — agent did not remember the number')
  }

  process.exit(0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
