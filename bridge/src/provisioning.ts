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

const DEFAULT_SERVER_CMD = ['/workspace/.venv/bin/python3', '/workspace/src/server.py']

function getEnvVarsForSprite(): Record<string, string> {
  const vars: Record<string, string> = {}
  if (process.env.ANTHROPIC_API_KEY) vars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (process.env.MISTRAL_API_KEY) vars.MISTRAL_API_KEY = process.env.MISTRAL_API_KEY
  return vars
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
export function generateSpriteName(stackId: string): string {
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
 * Build the exec URL for starting the Sprite's Python WS server.
 * Exposed so index.ts can open the WS connection after provisioning.
 */
export function buildServerExecUrl(spriteName: string): string {
  const envVars = getEnvVarsForSprite()
  return buildExecUrl(spriteName, DEFAULT_SERVER_CMD, envVars)
}
