import { getSpriteConnection } from './proxy.js'

const KEEPALIVE_INTERVAL_MS = 15_000

const timers = new Map<string, ReturnType<typeof setInterval>>()

/** Start keepalive pings for a stack if not already running. */
export function startKeepalive(stackId: string): void {
  if (timers.has(stackId)) return

  const interval = setInterval(() => {
    const conn = getSpriteConnection(stackId)
    if (!conn || conn.state !== 'connected') return
    conn.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
  }, KEEPALIVE_INTERVAL_MS)

  timers.set(stackId, interval)
}

/** Stop keepalive pings for a stack. */
export function stopKeepalive(stackId: string): void {
  const interval = timers.get(stackId)
  if (interval) {
    clearInterval(interval)
    timers.delete(stackId)
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
