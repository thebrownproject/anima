/**
 * End-to-end test: bootstrap a Sprite, start the server, send a mission.
 *
 * Usage: npx tsx scripts/test-sprite-e2e.ts [sprite-name]
 * Default sprite: sd-e2e-test
 */

import { configureSpritesClient, buildExecUrl, buildProxyUrl } from '../src/sprites-client.js'
import { bootstrapSprite } from '../src/bootstrap.js'
import WebSocket from 'ws'

const SPRITE = process.argv[2] || 'sd-e2e-test'
const TOKEN = process.env.SPRITES_TOKEN || ''
const SKIP_BOOTSTRAP = process.argv.includes('--skip-bootstrap')

if (!TOKEN) {
  console.error('Set SPRITES_TOKEN env var')
  process.exit(1)
}

configureSpritesClient({ token: TOKEN })

// -- Helpers --

function execOnSprite(spriteName: string, command: string, timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = buildExecUrl(spriteName, ['bash', '-c', command])
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
    let output = ''
    const timeout = setTimeout(() => { ws.close(); resolve(output) }, timeoutMs)

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'stdout' || msg.type === 'stderr') {
          output += msg.data
          process.stdout.write(msg.data)
        }
        if (msg.type === 'exit') {
          clearTimeout(timeout)
          ws.close()
          resolve(output)
        }
      } catch {
        output += data.toString()
      }
    })

    ws.on('error', (err) => { clearTimeout(timeout); reject(err) })
    ws.on('close', () => { clearTimeout(timeout); resolve(output) })
  })
}

function connectToSpriteWS(spriteName: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const proxyUrl = buildProxyUrl(spriteName)
    console.log(`[proxy] Connecting to ${proxyUrl}`)
    const ws = new WebSocket(proxyUrl, { headers: { Authorization: `Bearer ${TOKEN}` } })

    let initDone = false

    ws.on('open', () => {
      // Send ProxyInitMessage (same format as Bridge sprite-connection.ts)
      ws.send(JSON.stringify({ host: 'localhost', port: 8765 }))
    })

    ws.on('message', (data: Buffer) => {
      const text = data.toString()

      // First message is the init response
      if (!initDone) {
        initDone = true
        console.log(`[proxy] Init response: ${text}`)
        try {
          const resp = JSON.parse(text)
          // Handle both old format (status: 'connected') and new format (type: 'port_opened')
          if (resp.status === 'connected' || resp.type === 'port_opened') {
            console.log('[proxy] Connected to Sprite WS server on port 8765')
            resolve(ws)
            return
          }
          if (resp.type === 'error' || resp.error) {
            reject(new Error(`Proxy init failed: ${text}`))
            return
          }
          // Unknown response — might still be ok, log and continue
          console.log(`[proxy] Unexpected init response, continuing: ${text}`)
          resolve(ws)
        } catch {
          reject(new Error(`Proxy init: invalid response: ${text}`))
        }
        return
      }
    })

    ws.on('error', reject)
    setTimeout(() => reject(new Error('Connection timeout after 15s')), 15_000)
  })
}

// -- Main --

async function main() {
  console.log(`\n=== Sprite E2E Test: ${SPRITE} ===\n`)

  if (!SKIP_BOOTSTRAP) {
    // Full bootstrap: directories, venv, pip install, code, DB, memory
    console.log('[1/3] Bootstrapping Sprite (directories, venv, packages, code, DB, memory)...')
    console.log('       This takes ~60-90 seconds on a fresh Sprite...\n')
    await bootstrapSprite(SPRITE)
    console.log('')
  } else {
    console.log('[1/3] Skipping bootstrap (--skip-bootstrap)\n')
  }

  // Start server
  console.log('[2/3] Starting server...')
  await execOnSprite(SPRITE, 'pkill -f "src.server" 2>/dev/null; sleep 1; echo "old server killed"')

  const serverUrl = buildExecUrl(SPRITE, ['bash', '-c', 'cd /workspace && /workspace/.venv/bin/python3 -m src.server'], {
    ANTHROPIC_BASE_URL: 'https://ws.stackdocs.io/v1/proxy/anthropic',
    ANTHROPIC_API_KEY: 'test-proxy-token',
    MISTRAL_BASE_URL: 'https://ws.stackdocs.io/v1/proxy/mistral',
    MISTRAL_API_KEY: 'test-proxy-token',
  })
  const serverWs = new WebSocket(serverUrl, { headers: { Authorization: `Bearer ${TOKEN}` } })

  // Wait for server to start
  await new Promise<void>((resolve, reject) => {
    let started = false
    serverWs.on('message', (data: Buffer) => {
      const text = data.toString()
      process.stdout.write(text)
      if (!started && (text.includes('listening') || text.includes('started') || text.includes('8765'))) {
        started = true
        resolve()
      }
    })
    serverWs.on('error', (err) => { if (!started) reject(err) })
    setTimeout(() => { if (!started) { console.log('\n(server start timeout — proceeding anyway)'); resolve() } }, 8_000)
  })

  console.log('\n[3/3] Connecting to Sprite WS and sending mission...')

  // Connect via TCP proxy and send a mission
  try {
    const ws = await connectToSpriteWS(SPRITE)

    // Send a simple mission message
    const missionMsg = JSON.stringify({
      id: 'test-' + Date.now(),
      type: 'mission',
      timestamp: new Date().toISOString(),
      payload: {
        text: 'What is 2 + 2? Reply with just the number.',
      },
    })

    console.log(`[mission] Sending: ${missionMsg}`)
    ws.send(missionMsg)

    // Listen for response
    const events: string[] = []
    await new Promise<void>((resolve) => {
      ws.on('message', (data: Buffer) => {
        const text = data.toString()
        console.log(`[event] ${text}`)
        events.push(text)

        try {
          const msg = JSON.parse(text)
          if (msg.type === 'agent_event' && msg.payload?.event_type === 'complete') {
            console.log('\n>>> AGENT COMPLETED! <<<')
            resolve()
          }
          if (msg.type === 'agent_event' && msg.payload?.event_type === 'error') {
            console.log('\n>>> AGENT ERROR <<<')
            resolve()
          }
        } catch { /* not JSON */ }
      })

      setTimeout(() => {
        console.log(`\n[timeout] Got ${events.length} events before 60s timeout`)
        resolve()
      }, 60_000)
    })

    ws.close()
  } catch (err) {
    console.error('[connection error]', err)
  }

  serverWs.close()

  console.log('\n=== Test Complete ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
