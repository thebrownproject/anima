import { configureSpritesClient, buildExecUrl } from '../src/sprites-client.js'
import WebSocket from 'ws'

const TOKEN = process.env.SPRITES_TOKEN || ''
const SPRITE = process.argv[2] || 'sd-e2e-test'
const CMD = process.argv[3] || 'echo hello'

configureSpritesClient({ token: TOKEN })
const url = buildExecUrl(SPRITE, ['bash', '-c', CMD])
const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${TOKEN}` } })

ws.on('message', (d: Buffer) => {
  const raw = d.toString()
  // Print everything for debugging
  process.stdout.write(raw + '\n')
})
ws.on('close', () => process.exit(0))
ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1) })
setTimeout(() => { console.log('TIMEOUT'); ws.close(); process.exit(0) }, 120000)
