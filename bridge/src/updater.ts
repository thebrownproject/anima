/**
 * Lazy Sprite Updater — checks and updates sprite code on connect.
 *
 * When Bridge connects to a sprite, it reads /workspace/.os/VERSION via the FS API.
 * If the version is behind CURRENT_VERSION, it deploys updated code and bumps
 * the version. This means sprites only get updated when actually used.
 *
 * Update flow:
 *   1. Read /workspace/.os/VERSION from sprite (FS API, no wake needed if warm)
 *   2. Compare with CURRENT_VERSION (semver)
 *   3. If outdated: deploy new code, clean stale files, update deps, write new VERSION
 *   4. Restart the Python server if it's running
 */

import { readFile, writeFile } from './sprites-client.js'
import { spriteExec } from './sprite-exec.js'
import { CURRENT_VERSION, deployCode } from './bootstrap.js'

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b, 0 if a == b, 1 if a > b
 *
 * Also handles legacy integer versions (e.g. "3") by treating them as "0.0.3".
 */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string): number[] => {
    const trimmed = v.trim()
    // Legacy integer format — treat as 0.0.N
    if (/^\d+$/.test(trimmed)) {
      return [0, 0, parseInt(trimmed, 10)]
    }
    return trimmed.split('.').map(n => parseInt(n, 10) || 0)
  }

  const pa = parse(a)
  const pb = parse(b)
  const len = Math.max(pa.length, pb.length)

  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va < vb) return -1
    if (va > vb) return 1
  }
  return 0
}

/** Read the current version from a sprite. Returns '0.0.0' if VERSION file is missing. */
async function getSpriteVersion(spriteName: string): Promise<string> {
  try {
    const content = await readFile(spriteName, '/workspace/.os/VERSION')
    return content.trim() || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Check if a sprite needs updating and apply updates if so.
 * Returns true if an update was applied, false if already current.
 *
 * Call this after connecting to the sprite but before forwarding user messages.
 */
export async function checkAndUpdate(spriteName: string): Promise<boolean> {
  const spriteVersion = await getSpriteVersion(spriteName)

  if (compareSemver(spriteVersion, CURRENT_VERSION) >= 0) {
    return false
  }

  console.log(
    `[updater] Sprite ${spriteName} is at v${spriteVersion}, current is v${CURRENT_VERSION}. Updating...`,
  )
  const start = Date.now()

  // Create new directories that may not exist on older sprites
  await spriteExec(spriteName, 'mkdir -p /workspace/.os/src/tools')

  // Install system packages needed by newer versions (idempotent, skips if present)
  await spriteExec(spriteName,
    'which pdftotext > /dev/null 2>&1 || (sudo apt-get update -qq && sudo apt-get install -y -qq poppler-utils 2>&1 | tail -1)',
  )

  // Deploy new code
  await deployCode(spriteName)
  console.log(`[updater] Code deployed to ${spriteName}`)

  // Clean up stale files from previous versions
  await spriteExec(spriteName, [
    'rm -rf /workspace/.os/src/agents',
    '/workspace/.os/src/memory/journal.py',
    '/workspace/.os/src/memory/transcript.py',
    '/workspace/src',
  ].join(' '))
  console.log(`[updater] Cleaned stale files`)

  // Update deps if requirements changed (pip install is idempotent — skips already-installed)
  await spriteExec(spriteName,
    '/workspace/.os/.venv/bin/pip install -q -r /workspace/.os/requirements.txt 2>&1 | tail -1',
  )

  // Write new VERSION
  await writeFile(spriteName, '/workspace/.os/VERSION', CURRENT_VERSION)

  // Fix ownership
  await spriteExec(spriteName, 'sudo chown -R sprite:sprite /workspace/.os')

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[updater] Updated ${spriteName} from v${spriteVersion} to v${CURRENT_VERSION} in ${elapsed}s`)

  return true
}
