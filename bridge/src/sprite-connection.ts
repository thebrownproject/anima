import { WebSocket } from 'ws'
import { buildProxyUrl } from './sprites-client.js'

export type SpriteConnectionState = 'connecting' | 'connected' | 'closed'

export interface SpriteConnectionOptions {
  spriteName: string
  token: string
  targetPort?: number
  onMessage: (data: string) => void
  onClose: (code: number, reason: string) => void
  onError?: (err: Error) => void
}

const INIT_TIMEOUT_MS = 15_000

export class SpriteConnection {
  readonly spriteName: string
  private ws: WebSocket | null = null
  private _state: SpriteConnectionState = 'connecting'
  private opts: SpriteConnectionOptions
  private _lineBuffer = ''

  get state(): SpriteConnectionState {
    return this._state
  }

  constructor(opts: SpriteConnectionOptions) {
    this.opts = opts
    this.spriteName = opts.spriteName
  }

  /** Open the TCP Proxy connection and perform the init handshake. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = buildProxyUrl(this.spriteName)
      this.ws = new WebSocket(url, {
        headers: { Authorization: `Bearer ${this.opts.token}` },
      })

      const initTimer = setTimeout(() => {
        this.close(4000, 'TCP Proxy init timeout')
        reject(new Error('TCP Proxy init timeout'))
      }, INIT_TIMEOUT_MS)

      let initDone = false

      this.ws.on('open', () => {
        // Send ProxyInitMessage as text (JSON handshake)
        this.ws!.send(JSON.stringify({
          host: 'localhost',
          port: this.opts.targetPort ?? 8765,
        }))
      })

      this.ws.on('message', (raw) => {
        // Init response comes as text JSON
        if (!initDone) {
          initDone = true
          clearTimeout(initTimer)
          const data = raw.toString()

          try {
            const resp = JSON.parse(data)
            if (resp.status === 'connected') {
              this._state = 'connected'
              resolve()
              return
            }
            this._state = 'closed'
            reject(new Error(`TCP Proxy init failed: ${JSON.stringify(resp)}`))
          } catch {
            this._state = 'closed'
            reject(new Error(`TCP Proxy init: invalid response: ${data}`))
          }
          return
        }

        // After init, proxy sends binary frames -- decode to string lines.
        // TCP frames can split mid-line, so buffer incomplete segments.
        const text = Buffer.isBuffer(raw) ? raw.toString('utf-8') : raw.toString()
        const combined = this._lineBuffer + text
        const segments = combined.split('\n')
        // Last segment is incomplete if text didn't end with newline
        this._lineBuffer = segments.pop()!
        for (const line of segments) {
          if (line.trim()) {
            this.opts.onMessage(line)
          }
        }
      })

      this.ws.on('error', (err) => {
        this.opts.onError?.(err)
        if (!initDone) {
          clearTimeout(initTimer)
          initDone = true
          this._state = 'closed'
          reject(err)
        } else {
          this.close()
        }
      })

      this.ws.on('close', (code, reason) => {
        this._state = 'closed'
        if (!initDone) {
          clearTimeout(initTimer)
          initDone = true
          reject(new Error(`TCP Proxy closed during init: ${code}`))
          return
        }
        this.opts.onClose(code, reason.toString())
      })
    })
  }

  /** Swap the onMessage handler. Returns the previous handler for restoration. */
  replaceMessageHandler(handler: (data: string) => void): (data: string) => void {
    const prev = this.opts.onMessage
    this.opts.onMessage = handler
    return prev
  }

  /** Send a message to the Sprite via TCP proxy as binary (newline-delimited). */
  send(data: string): boolean {
    if (this._state !== 'connected' || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false
    }
    // TCP proxy only forwards binary frames — send as Buffer
    this.ws.send(Buffer.from(data + '\n', 'utf-8'))
    return true
  }

  /** Close the connection. */
  close(code = 1000, reason = 'Bridge closing'): void {
    this._state = 'closed'
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close(code, reason)
    }
    this.ws = null
  }
}
