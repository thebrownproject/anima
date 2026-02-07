/**
 * Lazy Sprite Updater — checks and updates sprite code on connect.
 *
 * When Bridge connects to a sprite, it reads /workspace/VERSION via the FS API.
 * If the version is behind CURRENT_VERSION, it deploys updated code and bumps
 * the version. This means sprites only get updated when actually used.
 *
 * Update flow:
 *   1. Read /workspace/VERSION from sprite (FS API, no wake needed if warm)
 *   2. Compare with CURRENT_VERSION
 *   3. If outdated: deploy new code, optionally update deps, write new VERSION
 *   4. Restart the Python server if it's running
 */

import { readFile as fsRead } from 'node:fs/promises'
import { join } from 'node:path'
import { readFile, writeFile } from './sprites-client.js'
import { spriteExec } from './sprite-exec.js'
import { CURRENT_VERSION } from './bootstrap.js'

/** Read the current version from a sprite. Returns 0 if VERSION file is missing. */
async function getSpriteVersion(spriteName: string): Promise<number> {
  try {
    const content = await readFile(spriteName, '/workspace/VERSION')
    return parseInt(content.trim(), 10) || 0
  } catch {
    return 0
  }
}

/** Deploy updated source code files to the sprite. */
async function deployCode(spriteName: string): Promise<void> {
  const srcDir = join(import.meta.dirname, '..', '..', 'sprite', 'src')
  const files = ['__init__.py', 'server.py', 'gateway.py', 'protocol.py']

  for (const file of files) {
    const content = await fsRead(join(srcDir, file), 'utf-8')
    await writeFile(spriteName, `/workspace/src/${file}`, content)
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

  if (spriteVersion >= CURRENT_VERSION) {
    return false
  }

  console.log(
    `[updater] Sprite ${spriteName} is at v${spriteVersion}, current is v${CURRENT_VERSION}. Updating...`,
  )
  const start = Date.now()

  // Deploy new code
  await deployCode(spriteName)
  console.log(`[updater] Code deployed to ${spriteName}`)

  // Update deps if requirements changed (pip install is idempotent — skips already-installed)
  await spriteExec(spriteName,
    '/workspace/.venv/bin/pip install -q -r /workspace/requirements.txt 2>&1 | tail -1',
  )

  // Write new VERSION
  await writeFile(spriteName, '/workspace/VERSION', String(CURRENT_VERSION))

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[updater] Updated ${spriteName} from v${spriteVersion} to v${CURRENT_VERSION} in ${elapsed}s`)

  return true
}
