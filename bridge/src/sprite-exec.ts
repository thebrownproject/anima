/**
 * Run commands on a Sprite via the exec CLI.
 *
 * Shared helper used by bootstrap.ts and updater.ts.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Run a bash command on a sprite via the exec CLI and return stdout.
 * Throws on non-zero exit code or timeout.
 */
export async function spriteExec(
  spriteName: string,
  command: string,
  timeoutMs = 120_000,
): Promise<string> {
  const { stdout, stderr } = await execFileAsync(
    'sprite',
    ['exec', '-s', spriteName, '--', 'bash', '-c', command],
    { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
  )

  if (stderr && !stderr.includes('WARNING') && !stderr.includes('notice')) {
    console.warn(`[sprite-exec] stderr from ${spriteName}: ${stderr.slice(0, 200)}`)
  }

  return stdout
}
