/**
 * Auth Module — Clerk JWT validation and Supabase stack lookup.
 *
 * Validates JWT once on WebSocket connect, then trusts the connection.
 * Looks up stack ownership via Supabase stacks table.
 */

import { verifyToken } from '@clerk/backend'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// Types
// =============================================================================

export interface AuthResult {
  userId: string
  stackId: string
  spriteName: string | null
  spriteStatus: string
}

export interface AuthError {
  code: number  // WebSocket close code (4001 = auth failed, 4003 = unauthorized)
  reason: string
}

interface StackRow {
  id: string
  user_id: string
  sprite_name: string | null
  sprite_status: string
}

// =============================================================================
// Supabase Client (singleton)
// =============================================================================

let supabase: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
  }

  supabase = createClient(url, key)
  return supabase
}

/** Reset singleton for testing. */
export function resetSupabaseClient(): void {
  supabase = null
}

// =============================================================================
// JWT Validation
// =============================================================================

/**
 * Verify a Clerk JWT token. Returns the user ID (sub claim) on success.
 * Uses CLERK_JWT_KEY for networkless verification when available,
 * falls back to CLERK_SECRET_KEY for JWKS-based verification.
 */
export async function verifyClerkToken(token: string): Promise<string> {
  const jwtKey = process.env.CLERK_JWT_KEY
  const secretKey = process.env.CLERK_SECRET_KEY

  if (!jwtKey && !secretKey) {
    throw new Error('Missing CLERK_JWT_KEY or CLERK_SECRET_KEY env var')
  }

  const result = await verifyToken(token, {
    // Prefer networkless verification with JWT public key
    ...(jwtKey ? { jwtKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    // Allow some clock drift between browser and server
    clockSkewInMs: 10_000,
  })

  // verifyToken returns the JWT payload directly on success
  const userId = result.sub
  if (!userId) {
    throw new Error('JWT missing sub claim')
  }

  return userId
}

// =============================================================================
// Stack Lookup
// =============================================================================

/**
 * Look up a stack in Supabase and verify the user owns it.
 * Returns stack details including sprite_name and sprite_status.
 */
export async function lookupStack(
  stackId: string,
  userId: string,
): Promise<StackRow> {
  const client = getSupabaseClient()

  const { data, error } = await client
    .from('stacks')
    .select('id, user_id, sprite_name, sprite_status')
    .eq('id', stackId)
    .single()

  if (error || !data) {
    throw new Error(`Stack not found: ${stackId}`)
  }

  if (data.user_id !== userId) {
    throw new Error(`User ${userId} does not own stack ${stackId}`)
  }

  return data as StackRow
}

// =============================================================================
// Combined Auth Flow
// =============================================================================

/**
 * Full auth flow: validate JWT + verify stack ownership.
 * Returns AuthResult on success, AuthError on failure.
 */
export async function authenticateConnection(
  token: string,
  stackId: string,
): Promise<AuthResult | AuthError> {
  // Step 1: Validate JWT
  let userId: string
  try {
    userId = await verifyClerkToken(token)
  } catch {
    return { code: 4001, reason: 'Invalid or expired JWT' }
  }

  // Step 2: Verify stack ownership
  let stack: StackRow
  try {
    stack = await lookupStack(stackId, userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stack lookup failed'
    // Distinguish "not found" from "not owned"
    if (message.includes('does not own')) {
      return { code: 4003, reason: 'Unauthorized: you do not own this stack' }
    }
    return { code: 4003, reason: 'Stack not found' }
  }

  return {
    userId,
    stackId: stack.id,
    spriteName: stack.sprite_name,
    spriteStatus: stack.sprite_status,
  }
}

/**
 * Type guard: check if auth result is an error.
 */
export function isAuthError(result: AuthResult | AuthError): result is AuthError {
  return 'code' in result && 'reason' in result && !('userId' in result)
}
