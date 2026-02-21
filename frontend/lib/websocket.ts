import type {
  BrowserToSpriteMessage,
  SpriteToBrowserMessage,
  MessageType,
  SystemMessage,
} from '@/types/ws-protocol'
import { parseMessage, isSystemMessage } from '@/types/ws-protocol'

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'sprite_waking'
  | 'connected'
  | 'error'

export type SendResult = 'sent' | 'queued' | 'dropped'

export type MessageHandler = (message: SpriteToBrowserMessage) => void

export interface WebSocketManagerOptions {
  getToken: () => Promise<string | null>
  onStatusChange: (status: ConnectionStatus, error?: string) => void
  onMessage: (message: SpriteToBrowserMessage) => void
  url?: string
}

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'wss://ws.stackdocs.io'
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000
const BACKOFF_MULTIPLIER = 2

// Frontend message queue: browser-to-Bridge buffer for messages sent while
// disconnected or during sprite_waking. Separate from Bridge's reconnect.ts
// buffer (Bridge-to-Sprite, MAX_BUFFER=50, TTL=60s) which holds messages
// during Sprite sleep/wake reconnection.
const MAX_QUEUE = 100
const QUEUE_TTL_MS = 60_000

// Close codes that indicate terminal auth failure - do NOT reconnect
const TERMINAL_CLOSE_CODES = new Set([4001, 4003])

interface QueuedMessage {
  data: string
  queuedAt: number
}

export class WebSocketManager {
  private ws: WebSocket | null = null
  private options: WebSocketManagerOptions
  private backoffMs = INITIAL_BACKOFF_MS
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false
  private terminalError = false
  private handlers = new Map<MessageType, Set<MessageHandler>>()
  private _status: ConnectionStatus = 'disconnected'
  private queue: QueuedMessage[] = []

  constructor(options: WebSocketManagerOptions) {
    this.options = options
  }

  get status(): ConnectionStatus {
    return this._status
  }

  connect(): void {
    if (this.ws) return
    this.intentionalClose = false
    this.setStatus('connecting')

    const url = `${this.options.url ?? WS_BASE_URL}/ws`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.authenticate()
    }

    this.ws.onmessage = (event) => {
      this.handleRawMessage(event.data as string)
    }

    this.ws.onclose = (event: CloseEvent) => {
      this.ws = null
      if (TERMINAL_CLOSE_CODES.has(event.code)) {
        this.terminalError = true
        this.intentionalClose = true
        this.setStatus('error', 'Authentication failed')
        return
      }
      if (!this.intentionalClose) {
        this.setStatus('disconnected')
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      // onclose fires after onerror, so reconnect is handled there
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    this.clearReconnectTimer()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.setStatus('disconnected')
  }

  /** Send a typed protocol message. Returns 'sent', 'queued', or 'dropped'. */
  send(message: Omit<BrowserToSpriteMessage, 'id' | 'timestamp'>): SendResult {
    if (this.terminalError) return 'dropped'

    const full = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    const data = JSON.stringify(full)

    // Send immediately if WS open AND sprite is ready (not waking)
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this._status === 'connected') {
      this.ws.send(data)
      return 'sent'
    }

    // Queue for later delivery
    if (this.queue.length >= MAX_QUEUE) {
      this.queue.shift()
    }
    this.queue.push({ data, queuedAt: Date.now() })
    return 'queued'
  }

  on(type: MessageType, handler: MessageHandler): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler)

    return () => {
      set!.delete(handler)
      if (set!.size === 0) this.handlers.delete(type)
    }
  }

  destroy(): void {
    this.disconnect()
    this.handlers.clear()
    this.queue = []
  }

  private async authenticate(): Promise<void> {
    this.setStatus('authenticating')

    let token: string | null
    try {
      token = await this.options.getToken()
    } catch {
      this.setStatus('error', 'Failed to get auth token')
      this.ws?.close(4001, 'Token error')
      return
    }

    if (!token) {
      this.setStatus('error', 'Failed to get auth token')
      this.ws?.close(4001, 'No auth token')
      return
    }

    const authMsg = {
      type: 'auth' as const,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      payload: { token },
    }
    this.ws?.send(JSON.stringify(authMsg))
  }

  private handleRawMessage(data: string): void {
    const message = parseMessage(data)
    if (!message) return

    if (isSystemMessage(message)) {
      this.handleSystemMessage(message)
    }

    const handlers = this.handlers.get(message.type as MessageType)
    if (handlers) {
      for (const handler of handlers) {
        handler(message as SpriteToBrowserMessage)
      }
    }

    this.options.onMessage(message as SpriteToBrowserMessage)
  }

  private handleSystemMessage(msg: SystemMessage): void {
    switch (msg.payload.event) {
      case 'connected':
        break
      case 'sprite_waking':
        this.setStatus('sprite_waking')
        break
      case 'sprite_ready':
        this.setStatus('connected')
        this.backoffMs = INITIAL_BACKOFF_MS
        this.flushQueue()
        break
      case 'reconnect_failed':
        this.setStatus('error', msg.payload.message ?? 'Connection failed. Please reload to retry.')
        break
      case 'error':
        // Non-fatal errors shouldn't brick an active connection
        if (this._status !== 'connected') {
          this.setStatus('error', msg.payload.message)
        }
        break
    }
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const now = Date.now()
    const valid = this.queue.filter(m => now - m.queuedAt < QUEUE_TTL_MS)
    this.queue = []

    for (const msg of valid) {
      this.ws.send(msg.data)
    }
  }

  private setStatus(status: ConnectionStatus, error?: string): void {
    this._status = status
    this.options.onStatusChange(status, error)
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.backoffMs)

    this.backoffMs = Math.min(this.backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
