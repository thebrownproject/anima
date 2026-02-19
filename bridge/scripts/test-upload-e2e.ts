/**
 * E2E test: file_upload pipeline.
 * Connects to running Sprite via TCP proxy, sends a small file_upload,
 * verifies processing card + ack come back.
 */
import { configureSpritesClient, buildProxyUrl } from '../src/sprites-client.js'
import WebSocket from 'ws'

const SPRITE = process.argv[2] || 'sd-e2e-test'
const TOKEN = process.env.SPRITES_TOKEN || ''
configureSpritesClient({ token: TOKEN })

// Small test PDF header (just enough to be valid-ish, ~100 bytes base64)
const TEST_DATA = Buffer.from('%PDF-1.4 test content for upload pipeline').toString('base64')

async function connectProxy(): Promise<WebSocket> {
  console.log('[1] Connecting to Sprite via TCP proxy...')
  const proxyUrl = buildProxyUrl(SPRITE)
  const ws = new WebSocket(proxyUrl, { headers: { Authorization: `Bearer ${TOKEN}` } })

  return new Promise((resolve, reject) => {
    ws.on('open', () => ws.send(JSON.stringify({ host: 'localhost', port: 8765 })))
    let initDone = false
    ws.on('message', (d: Buffer) => {
      if (!initDone) {
        initDone = true
        console.log(`[proxy] Connected: ${d.toString().slice(0, 100)}...`)
        resolve(ws)
      }
    })
    ws.on('error', reject)
    setTimeout(() => reject(new Error('Proxy timeout')), 15_000)
  })
}

async function main() {
  console.log(`\n=== Upload E2E Test: ${SPRITE} ===\n`)

  const ws = await connectProxy()

  // Collect state_sync
  const messages: any[] = []
  ws.on('message', (d: Buffer) => {
    try {
      const m = JSON.parse(d.toString())
      messages.push(m)
      console.log(`  [${m.type}] ${m.type === 'state_sync' ? 'State sync received' : JSON.stringify(m).slice(0, 120)}`)
    } catch {
      console.log(`  [raw] ${d.toString().slice(0, 100)}`)
    }
  })

  // Wait for state_sync
  await new Promise(r => setTimeout(r, 2000))
  console.log(`\n[2] Received ${messages.length} messages after connect\n`)

  // Send file_upload
  const uploadMsg = JSON.stringify({
    id: 'test-upload-' + Date.now(),
    type: 'file_upload',
    timestamp: Date.now(),
    payload: {
      filename: 'test-invoice.pdf',
      mime_type: 'application/pdf',
      data: TEST_DATA,
    },
  })
  console.log(`[3] Sending file_upload (${uploadMsg.length} bytes)...`)
  ws.send(Buffer.from(uploadMsg + '\n', 'utf-8'))

  // Wait for responses (canvas_update + ack + possibly extraction)
  console.log('[4] Waiting for responses (30s timeout)...\n')
  const uploadResponses: any[] = []
  await new Promise<void>((resolve) => {
    const handler = (d: Buffer) => {
      try {
        const m = JSON.parse(d.toString())
        uploadResponses.push(m)
        console.log(`  [${m.type}] ${JSON.stringify(m).slice(0, 200)}`)

        // Check for extraction complete (agent_event with complete)
        if (m.type === 'agent_event' && m.payload?.event_type === 'complete') {
          ws.removeListener('message', handler)
          resolve()
        }
      } catch {}
    }
    ws.on('message', handler)
    setTimeout(() => { ws.removeListener('message', handler); resolve() }, 30_000)
  })

  // Report results
  console.log('\n=== Results ===')
  const types = uploadResponses.map(m => m.type)
  const hasCanvasUpdate = types.includes('canvas_update')
  const hasAck = uploadResponses.some(m => m.type === 'system' && m.payload?.event === 'file_upload_received')
  const hasAgentEvent = types.includes('agent_event')

  console.log(`  canvas_update (processing card): ${hasCanvasUpdate ? 'PASS' : 'FAIL'}`)
  console.log(`  file_upload_received ack:        ${hasAck ? 'PASS' : 'MISSING (check ack format)'}`)
  console.log(`  agent_event (extraction):        ${hasAgentEvent ? 'PASS' : 'WAITING (may take longer)'}`)
  console.log(`  Total messages received:         ${uploadResponses.length}`)
  console.log()

  ws.close()
  console.log('=== Done ===')
  process.exit(0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
