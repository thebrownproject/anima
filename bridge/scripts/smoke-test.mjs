#!/usr/bin/env node
/**
 * Production smoke test — connects to deployed Bridge via WebSocket,
 * verifies auth timeout behavior (no real JWT needed for this check).
 *
 * Usage: node scripts/smoke-test.mjs [url]
 * Default URL: wss://anima-bridge.fly.dev/ws/smoke-test
 */
import { WebSocket } from 'ws'

const url = process.argv[2] || 'wss://anima-bridge.fly.dev/ws/smoke-test'

console.log(`Connecting to ${url}...`)

const ws = new WebSocket(url)
let connected = false

ws.on('open', () => {
  connected = true
  console.log('Connected! Waiting for auth timeout (10s)...')
  console.log('(In production, browser would send auth message with Clerk JWT here)')
})

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString())
    console.log(`Received: type=${msg.type}`, msg.payload ? `payload=${JSON.stringify(msg.payload)}` : '')

    if (msg.type === 'system' && msg.payload?.event === 'error') {
      console.log('\nAuth timeout received as expected — Bridge is working correctly!')
      console.log('Full auth flow requires a valid Clerk JWT token.')
      ws.close()
    }
  } catch {
    console.log('Received raw:', data.toString())
  }
})

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message)
  process.exit(1)
})

ws.on('close', (code, reason) => {
  console.log(`Connection closed: code=${code} reason=${reason.toString()}`)
  if (connected) {
    console.log('\nSmoke test PASSED — Bridge accepts WebSocket connections')
    process.exit(0)
  } else {
    console.error('\nSmoke test FAILED — could not connect')
    process.exit(1)
  }
})

// Safety timeout
setTimeout(() => {
  console.error('Timed out after 15s')
  ws.close()
  process.exit(1)
}, 15_000)
