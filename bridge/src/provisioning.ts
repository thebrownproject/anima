/**
 * Lazy Sprite Provisioning.
 *
 * When a user connects and their stack has sprite_status='pending',
 * provisions a new Sprite via bootstrap (installs packages, deploys
 * code, creates DB and memory), then updates the Supabase stacks row.
 *
 * Status transitions: pending -> provisioning -> active
 * On failure: -> failed (retried on next connect)
 */

import { WebSocket } from 'ws'
import { getSupabaseClient } from './auth.js'
import {
  createSprite,
  getSprite,
  buildExecUrl,
} from './sprites-client.js'
import { bootstrapSprite } from './bootstrap.js'

// -- Types --

export interface ProvisionResult {
  spriteName: string
  spriteStatus: 'active' | 'failed'
  error?: string
}

// -- Config --

export const DEFAULT_SERVER_CMD = ['bash', '-c', 'cd /workspace && PYTHONPATH=/workspace/.os /workspace/.os/.venv/bin/python3 -m src.server']

// API keys proxied through Bridge — Sprites never hold master keys (m7b.3.6).
// Sprites use ANTHROPIC_BASE_URL / MISTRAL_BASE_URL pointing to Bridge proxy,
// with SPRITES_PROXY_TOKEN as the "api key" (validated by Bridge, replaced with real key).
function getEnvVarsForSprite(): Record<string, string> {
  const token = process.env.SPRITES_PROXY_TOKEN ?? ''
  const bridgeUrl = process.env.BRIDGE_PUBLIC_URL ?? 'https://ws.stackdocs.io'
  return {
    ANTHROPIC_BASE_URL: `${bridgeUrl}/v1/proxy/anthropic`,
    ANTHROPIC_API_KEY: token,
    MISTRAL_BASE_URL: `${bridgeUrl}/v1/proxy/mistral`,
    MISTRAL_API_KEY: token,
  }
}

// -- Supabase Helpers --

async function updateSpriteStatus(
  stackId: string,
  status: string,
  spriteName?: string,
): Promise<void> {
  const client = getSupabaseClient()
  const update: Record<string, string> = { sprite_status: status }
  if (spriteName) update.sprite_name = spriteName

  const { error } = await client.from('stacks').update(update).eq('id', stackId)
  if (error) throw new Error(`Failed to update stack ${stackId}: ${error.message}`)
}

// -- Provisioning Flow --

/**
 * Generate a unique sprite name from a stack ID.
 * Sprites.dev names must be lowercase alphanumeric + hyphens.
 */
function generateSpriteName(stackId: string): string {
  const clean = stackId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)
  const suffix = Date.now().toString(36).slice(-4)
  return `sd-${clean}-${suffix}`
}

/**
 * Provision a new Sprite for a stack.
 * Creates the Sprite, starts the Python WS server, updates Supabase.
 */
export async function provisionSprite(
  stackId: string,
): Promise<ProvisionResult> {
  const spriteName = generateSpriteName(stackId)

  try {
    // Mark as provisioning
    await updateSpriteStatus(stackId, 'provisioning', spriteName)

    // Create the Sprite and bootstrap it with packages, code, DB, and memory
    await createSprite(spriteName)
    await bootstrapSprite(spriteName)

    // Start the Python server before marking as active
    const token = process.env.SPRITES_TOKEN
    if (token) {
      await startSpriteServer(spriteName, token)
    }

    // Mark as active
    await updateSpriteStatus(stackId, 'active')

    return { spriteName, spriteStatus: 'active' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown provisioning error'
    console.error(`[provisioning] Failed for stack=${stackId}: ${message}`)

    // Mark as failed — retry on next connect
    try {
      await updateSpriteStatus(stackId, 'failed', spriteName)
    } catch (updateErr) {
      console.error(`[provisioning] Failed to mark stack as failed:`, updateErr)
    }

    return { spriteName, spriteStatus: 'failed', error: message }
  }
}

/**
 * Ensure a Sprite is provisioned for the given stack.
 * If already active, returns immediately. If pending/failed, provisions.
 */
export async function ensureSpriteProvisioned(
  stackId: string,
  currentStatus: string,
  currentSpriteName: string | null,
): Promise<ProvisionResult> {
  // Already active — verify the Sprite exists
  if (currentStatus === 'active' && currentSpriteName) {
    try {
      await getSprite(currentSpriteName)
      return { spriteName: currentSpriteName, spriteStatus: 'active' }
    } catch {
      // Sprite no longer exists — re-provision
      console.warn(`[provisioning] Sprite ${currentSpriteName} not found, re-provisioning`)
    }
  }

  // Pending or failed — provision fresh
  return provisionSprite(stackId)
}

/**
 * Start the Sprite's Python server via exec WebSocket.
 * Opens a persistent exec session (max_run_after_disconnect=0) with env vars
 * for API proxy routing, then waits for the server to bind to port 8765.
 */
export async function startSpriteServer(spriteName: string, token: string): Promise<void> {
  const envVars = getEnvVarsForSprite()
  const url = buildExecUrl(spriteName, DEFAULT_SERVER_CMD, envVars)
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } })
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); resolve() }, 3_000)
    ws.on('open', () => { clearTimeout(timer); setTimeout(() => { ws.close(); resolve() }, 1_000) })
    ws.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
  // Wait for server to finish binding to port 8765
  await new Promise((r) => setTimeout(r, 2_000))
}
