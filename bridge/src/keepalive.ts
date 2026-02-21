import { v4 as uuidv4 } from 'uuid'
import { getSpriteConnection } from './proxy.js'

const KEEPALIVE_INTERVAL_MS = 15_000

const timers = new Map<string, ReturnType<typeof setInterval>>()

/** Start keepalive pings for a user if not already running. */
export function startKeepalive(userId: string): void {
  if (timers.has(userId)) return

  const interval = setInterval(() => {
    const conn = getSpriteConnection(userId)
    if (!conn || conn.state !== 'connected') return
    conn.send(JSON.stringify({ type: 'ping', id: uuidv4(), timestamp: Date.now() }))
  }, KEEPALIVE_INTERVAL_MS)

  timers.set(userId, interval)
}

/** Stop keepalive pings for a user. */
export function stopKeepalive(userId: string): void {
  const interval = timers.get(userId)
  if (interval) {
    clearInterval(interval)
    timers.delete(userId)
  }
}

/** For testing — reset all timers. */
export function resetKeepalives(): void {
  for (const interval of timers.values()) {
    clearInterval(interval)
  }
  timers.clear()
}

export { KEEPALIVE_INTERVAL_MS }
