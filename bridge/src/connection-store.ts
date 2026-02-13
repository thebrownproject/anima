import { WebSocket } from 'ws'

export interface Connection {
  id: string
  ws: WebSocket
  userId: string
  spriteName: string | null
  spriteStatus: string
  connectedAt: number
}

/** Active authenticated connections indexed by connection ID. */
const connections = new Map<string, Connection>()

/** Pending connections awaiting auth (timeout after AUTH_TIMEOUT_MS). */
const pendingAuth = new Map<string, { ws: WebSocket; timer: ReturnType<typeof setTimeout> }>()

export function getConnection(id: string): Connection | undefined {
  return connections.get(id)
}

export function setConnection(id: string, conn: Connection): void {
  connections.set(id, conn)
}

export function getConnectionsByUser(userId: string): Connection[] {
  const result: Connection[] = []
  for (const conn of connections.values()) {
    if (conn.userId === userId) result.push(conn)
  }
  return result
}

/** @deprecated Temporary alias — use getConnectionsByUser. Removed in m7b.12.4/m7b.12.5. */
export const getConnectionsByStack = getConnectionsByUser

export function getConnectionCount(): number {
  return connections.size
}

export function removeConnection(connectionId: string): void {
  connections.delete(connectionId)
}

export function setPending(connectionId: string, entry: { ws: WebSocket; timer: ReturnType<typeof setTimeout> }): void {
  pendingAuth.set(connectionId, entry)
}

export function hasPending(connectionId: string): boolean {
  return pendingAuth.has(connectionId)
}

export function getPendingCount(): number {
  return pendingAuth.size
}

export function removePending(connectionId: string): void {
  const pending = pendingAuth.get(connectionId)
  if (pending) {
    clearTimeout(pending.timer)
    pendingAuth.delete(connectionId)
  }
}

/** Iterate all connections (for shutdown). */
export function allConnections(): IterableIterator<Connection> {
  return connections.values()
}

/** Iterate all pending entries (for shutdown). */
export function allPending(): IterableIterator<{ ws: WebSocket; timer: ReturnType<typeof setTimeout> }> {
  return pendingAuth.values()
}
