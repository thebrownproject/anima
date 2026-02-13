/**
 * Auth Module — Clerk JWT validation and Supabase user lookup.
 *
 * Validates JWT once on WebSocket connect, then trusts the connection.
 * Looks up user's Sprite mapping via Supabase users table.
 */

import { verifyToken } from '@clerk/backend'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface AuthResult {
  userId: string
  spriteName: string | null
  spriteStatus: string
}

export interface AuthError {
  code: number  // WebSocket close code (4001 = auth failed, 4003 = unauthorized)
  reason: string
}

interface UserRow {
  id: string
  sprite_name: string | null
  sprite_status: string
}

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

/**
 * Look up a user in Supabase to get their Sprite mapping.
 * One Sprite per user — no ownership check needed.
 */
export async function lookupUser(userId: string): Promise<UserRow> {
  const client = getSupabaseClient()

  const { data, error } = await client
    .from('users')
    .select('id, sprite_name, sprite_status')
    .eq('id', userId)
    .single()

  if (error || !data) {
    throw new Error(`User not found: ${userId}`)
  }

  return data as UserRow
}

/**
 * Full auth flow: validate JWT + look up user's Sprite.
 * Returns AuthResult on success, AuthError on failure.
 */
export async function authenticateConnection(
  token: string,
): Promise<AuthResult | AuthError> {
  let userId: string
  try {
    userId = await verifyClerkToken(token)
  } catch {
    return { code: 4001, reason: 'Invalid or expired JWT' }
  }

  let user: UserRow
  try {
    user = await lookupUser(userId)
  } catch {
    return { code: 4003, reason: 'User not found' }
  }

  return {
    userId,
    spriteName: user.sprite_name,
    spriteStatus: user.sprite_status,
  }
}

export function isAuthError(result: AuthResult | AuthError): result is AuthError {
  return 'code' in result && 'reason' in result && !('userId' in result)
}
