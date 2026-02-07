/**
 * Sprites.dev REST API client.
 *
 * Wraps the Sprites.dev REST API for sprite lifecycle management.
 * Uses native fetch (Node 22+). No WebSocket connections here —
 * exec and TCP proxy WS are handled at call sites.
 */

const API_BASE = 'https://api.sprites.dev'

// -- Types --

export interface SpriteInfo {
  id: string
  name: string
  status: 'cold' | 'warm' | 'running'
  organization: string
  created_at: string
}

export interface ExecSession {
  id: number
  created: string
  command: string
  is_active: boolean
  last_activity: string
}

export interface CheckpointInfo {
  id: string
  sprite_name: string
  created_at: string
}

export interface SpritesClientConfig {
  token: string
  baseUrl?: string
}

// -- Client --

let _config: SpritesClientConfig | null = null

export function configureSpritesClient(config: SpritesClientConfig): void {
  _config = config
}

export function resetSpritesClient(): void {
  _config = null
}

function getConfig(): SpritesClientConfig {
  if (_config) return _config

  const token = process.env.SPRITES_TOKEN
  if (!token) throw new Error('Missing SPRITES_TOKEN env var')
  _config = { token }
  return _config
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getConfig().token}`,
    'Content-Type': 'application/json',
  }
}

function baseUrl(): string {
  return getConfig().baseUrl ?? API_BASE
}

async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${baseUrl()}${path}`
  const res = await fetch(url, {
    method,
    headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error')
    throw new Error(`Sprites API ${method} ${path} failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<T>
}

// -- Sprite CRUD --

export async function createSprite(name: string): Promise<SpriteInfo> {
  return apiRequest<SpriteInfo>('POST', '/v1/sprites', { name })
}

export async function getSprite(name: string): Promise<SpriteInfo> {
  return apiRequest<SpriteInfo>('GET', `/v1/sprites/${name}`)
}

export async function deleteSprite(name: string): Promise<void> {
  await apiRequest<unknown>('DELETE', `/v1/sprites/${name}`)
}

// -- Checkpoints --

export async function restoreCheckpoint(spriteName: string, checkpointId: string): Promise<void> {
  await apiRequest<unknown>('POST', `/v1/sprites/${spriteName}/checkpoints/${checkpointId}/restore`)
}

export async function listCheckpoints(spriteName: string): Promise<{ checkpoints: CheckpointInfo[] }> {
  return apiRequest<{ checkpoints: CheckpointInfo[] }>('GET', `/v1/sprites/${spriteName}/checkpoints`)
}

// -- Exec Sessions --

export async function listExecSessions(spriteName: string): Promise<{ count: number; sessions: ExecSession[] }> {
  return apiRequest<{ count: number; sessions: ExecSession[] }>('GET', `/v1/sprites/${spriteName}/exec`)
}

/**
 * Build the exec WebSocket URL for starting a persistent server.
 * Caller opens the WS connection — this just builds the URL with params.
 */
export function buildExecUrl(
  spriteName: string,
  command: string[],
  envVars?: Record<string, string>,
): string {
  const base = baseUrl().replace('https://', 'wss://').replace('http://', 'ws://')
  const url = new URL(`${base}/v1/sprites/${spriteName}/exec`)

  for (const arg of command) {
    url.searchParams.append('cmd', arg)
  }
  url.searchParams.set('max_run_after_disconnect', '0')

  if (envVars) {
    for (const [key, value] of Object.entries(envVars)) {
      url.searchParams.append('env', `${key}=${value}`)
    }
  }

  return url.toString()
}

// -- Filesystem --

export async function readFile(spriteName: string, path: string): Promise<string> {
  const url = `${baseUrl()}/v1/sprites/${spriteName}/fs/read?path=${encodeURIComponent(path)}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error')
    throw new Error(`FS read ${path} failed (${res.status}): ${text}`)
  }
  return res.text()
}

export async function writeFile(spriteName: string, path: string, content: string): Promise<void> {
  const url = `${baseUrl()}/v1/sprites/${spriteName}/fs/write?path=${encodeURIComponent(path)}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/octet-stream' },
    body: content,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error')
    throw new Error(`FS write ${path} failed (${res.status}): ${text}`)
  }
}

// -- URL Builders --

/**
 * Build the TCP Proxy WebSocket URL for connecting to a Sprite's internal port.
 */
export function buildProxyUrl(spriteName: string): string {
  const base = baseUrl().replace('https://', 'wss://').replace('http://', 'ws://')
  return `${base}/v1/sprites/${spriteName}/proxy`
}
