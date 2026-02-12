import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Mock sprites-client and sprite-exec
vi.mock('../src/sprites-client.js', () => ({
  writeFile: vi.fn(),
}))

vi.mock('../src/sprite-exec.js', () => ({
  spriteExec: vi.fn(),
}))

import { writeFile } from '../src/sprites-client.js'
import { deployCode, bootstrapSprite, CURRENT_VERSION } from '../src/bootstrap.js'

const mockWriteFile = vi.mocked(writeFile)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('deployCode', () => {
  it('deploys soul.md and os.md as deploy-managed files', async () => {
    await deployCode('test-sprite')

    const calls = mockWriteFile.mock.calls
    const paths = calls.map(c => c[1] as string)

    expect(paths).toContain('/workspace/.os/memory/soul.md')
    expect(paths).toContain('/workspace/.os/memory/os.md')
  })

  it('deploys soul.md content from sprite/memory/soul.md', async () => {
    await deployCode('test-sprite')

    const soulCall = mockWriteFile.mock.calls.find(c => c[1] === '/workspace/.os/memory/soul.md')
    expect(soulCall).toBeDefined()

    const actualContent = await readFile(
      join(import.meta.dirname, '..', '..', 'sprite', 'memory', 'soul.md'),
      'utf-8',
    )
    expect(soulCall![2]).toBe(actualContent)
  })

  it('deploys os.md content from sprite/memory/os.md', async () => {
    await deployCode('test-sprite')

    const osCall = mockWriteFile.mock.calls.find(c => c[1] === '/workspace/.os/memory/os.md')
    expect(osCall).toBeDefined()

    const actualContent = await readFile(
      join(import.meta.dirname, '..', '..', 'sprite', 'memory', 'os.md'),
      'utf-8',
    )
    expect(osCall![2]).toBe(actualContent)
  })

  it('does NOT deploy daemon-managed files (tools, files, user, context)', async () => {
    await deployCode('test-sprite')

    const calls = mockWriteFile.mock.calls
    const paths = calls.map(c => c[1] as string)

    expect(paths).not.toContain('/workspace/.os/memory/tools.md')
    expect(paths).not.toContain('/workspace/.os/memory/files.md')
    expect(paths).not.toContain('/workspace/.os/memory/user.md')
    expect(paths).not.toContain('/workspace/.os/memory/context.md')
  })

  it('deploys new tools/ structure, not old agents/shared/', async () => {
    await deployCode('test-sprite')

    const calls = mockWriteFile.mock.calls
    const paths = calls.map(c => c[1] as string)

    // New paths
    expect(paths).toContain('/workspace/.os/src/tools/canvas.py')
    expect(paths).toContain('/workspace/.os/src/tools/memory.py')
    expect(paths).toContain('/workspace/.os/src/tools/__init__.py')
    expect(paths).toContain('/workspace/.os/src/memory/hooks.py')
    expect(paths).toContain('/workspace/.os/src/memory/processor.py')

    // Old paths should NOT be deployed
    expect(paths).not.toContain('/workspace/.os/src/agents/shared/canvas_tools.py')
    expect(paths).not.toContain('/workspace/.os/src/agents/shared/memory_tools.py')
    expect(paths).not.toContain('/workspace/.os/src/agents/shared/__init__.py')
    expect(paths).not.toContain('/workspace/.os/src/memory/journal.py')
    expect(paths).not.toContain('/workspace/.os/src/memory/transcript.py')
  })
})

describe('bootstrapSprite', () => {
  it('deploys all 6 memory files', async () => {
    await bootstrapSprite('test-sprite')

    const calls = mockWriteFile.mock.calls
    const paths = calls.map(c => c[1] as string)

    // Deploy-managed (via deployCode)
    expect(paths).toContain('/workspace/.os/memory/soul.md')
    expect(paths).toContain('/workspace/.os/memory/os.md')

    // Daemon-managed (bootstrap step 6)
    expect(paths).toContain('/workspace/.os/memory/tools.md')
    expect(paths).toContain('/workspace/.os/memory/files.md')
    expect(paths).toContain('/workspace/.os/memory/user.md')
    expect(paths).toContain('/workspace/.os/memory/context.md')
  })

  it('does NOT deploy old MEMORY.md', async () => {
    await bootstrapSprite('test-sprite')

    const calls = mockWriteFile.mock.calls
    const paths = calls.map(c => c[1] as string)

    expect(paths).not.toContain('/workspace/.os/memory/MEMORY.md')
  })

  it('deploys daemon-managed files from sprite/memory/ templates', async () => {
    await bootstrapSprite('test-sprite')

    for (const file of ['tools.md', 'files.md', 'user.md', 'context.md']) {
      const call = mockWriteFile.mock.calls.find(
        c => c[1] === `/workspace/.os/memory/${file}`,
      )
      expect(call).toBeDefined()

      const actualContent = await readFile(
        join(import.meta.dirname, '..', '..', 'sprite', 'memory', file),
        'utf-8',
      )
      expect(call![2]).toBe(actualContent)
    }
  })

  it('writes VERSION in semver format', async () => {
    await bootstrapSprite('test-sprite')

    const versionCall = mockWriteFile.mock.calls.find(
      c => c[1] === '/workspace/.os/VERSION',
    )
    expect(versionCall).toBeDefined()
    expect(versionCall![2]).toBe(CURRENT_VERSION)
    expect(CURRENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
