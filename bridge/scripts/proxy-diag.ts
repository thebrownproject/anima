/**
 * Diagnostic: test what the TCP proxy actually forwards.
 * Run with: source .env && npx tsx scripts/proxy-diag.ts
 */
import { configureSpritesClient, buildProxyUrl } from '../src/sprites-client.js'
import WebSocket from 'ws'

const TOKEN = process.env.SPRITES_TOKEN || ''
configureSpritesClient({ token: TOKEN })

const url = buildProxyUrl('sd-e2e-test')
console.log('[proxy] connecting to:', url)
const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${TOKEN}` } })

ws.on('open', () => {
  console.log('[proxy] open, sending init')
  ws.send(JSON.stringify({ host: 'localhost', port: 8765 }))
})

let initDone = false
ws.on('message', (d: Buffer) => {
  const text = d.toString()
  if (!initDone) {
    initDone = true
    console.log('[proxy] init response:', text)
    setTimeout(() => {
      const msg = '{"test":"hello"}\n'
      console.log(`[proxy] sending: ${JSON.stringify(msg)} (${msg.length} bytes)`)
      ws.send(msg)
    }, 500)
    return
  }
  console.log('[proxy] received back:', text)
})

ws.on('error', (e: Error) => console.error('[proxy] error:', e.message))
ws.on('close', (code: number) => console.log('[proxy] closed:', code))

setTimeout(() => { console.log('[proxy] timeout, closing'); ws.close(); process.exit(0) }, 15000)
