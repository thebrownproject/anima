import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/sprites-client.js', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('../src/sprite-exec.js', () => ({
  spriteExec: vi.fn().mockResolvedValue(''),
}))

vi.mock('../src/bootstrap.js', () => ({
  CURRENT_VERSION: '0.4.0',
  deployCode: vi.fn().mockResolvedValue(undefined),
}))

import { compareSemver, checkAndUpdate } from '../src/updater.js'
import { readFile, writeFile } from '../src/sprites-client.js'
import { spriteExec } from '../src/sprite-exec.js'
import { deployCode, CURRENT_VERSION } from '../src/bootstrap.js'

const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)
const mockSpriteExec = vi.mocked(spriteExec)
const mockDeployCode = vi.mocked(deployCode)

describe('compareSemver', () => {
  it('equal versions return 0', () => {
    expect(compareSemver('0.3.0', '0.3.0')).toBe(0)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
  })

  it('older version returns -1', () => {
    expect(compareSemver('0.2.0', '0.3.0')).toBe(-1)
    expect(compareSemver('0.3.0', '1.0.0')).toBe(-1)
    expect(compareSemver('0.2.9', '0.3.0')).toBe(-1)
  })

  it('newer version returns 1', () => {
    expect(compareSemver('0.3.0', '0.2.0')).toBe(1)
    expect(compareSemver('1.0.0', '0.9.9')).toBe(1)
  })

  it('handles legacy integer versions', () => {
    expect(compareSemver('3', '0.3.0')).toBe(-1)
    expect(compareSemver('0', '0.3.0')).toBe(-1)
    expect(compareSemver('3', '3')).toBe(0)
    expect(compareSemver('2', '3')).toBe(-1)
  })

  it('handles missing minor/patch', () => {
    expect(compareSemver('1', '1.0.0')).toBe(-1) // "1" -> 0.0.1 < 1.0.0
    expect(compareSemver('0.0.0', '0.0.0')).toBe(0)
  })

  it('handles whitespace in version strings', () => {
    expect(compareSemver(' 0.3.0 ', '0.3.0')).toBe(0)
    expect(compareSemver('0.3.0', ' 0.3.0\n')).toBe(0)
  })
})

describe('checkAndUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteFile.mockResolvedValue(undefined as any)
    mockSpriteExec.mockResolvedValue('')
    mockDeployCode.mockResolvedValue(undefined)
  })

  it('skips update when sprite is already current', async () => {
    mockReadFile.mockResolvedValue(CURRENT_VERSION)

    const updated = await checkAndUpdate('test-sprite')

    expect(updated).toBe(false)
    expect(mockDeployCode).not.toHaveBeenCalled()
    expect(mockSpriteExec).not.toHaveBeenCalled()
  })

  it('skips update when sprite version is newer', async () => {
    mockReadFile.mockResolvedValue('99.0.0')

    const updated = await checkAndUpdate('test-sprite')

    expect(updated).toBe(false)
    expect(mockDeployCode).not.toHaveBeenCalled()
  })

  it('runs full update flow when sprite is outdated', async () => {
    mockReadFile.mockResolvedValue('0.2.0')

    const updated = await checkAndUpdate('test-sprite')

    expect(updated).toBe(true)
    // Verify update steps ran in expected order
    expect(mockSpriteExec).toHaveBeenCalledWith('test-sprite', 'mkdir -p /workspace/.os/src/tools')
    expect(mockDeployCode).toHaveBeenCalledWith('test-sprite')
    expect(mockWriteFile).toHaveBeenCalledWith('test-sprite', '/workspace/.os/VERSION', CURRENT_VERSION)
    // chown runs last
    expect(mockSpriteExec).toHaveBeenCalledWith('test-sprite', 'sudo chown -R sprite:sprite /workspace/.os')
  })

  it('treats missing VERSION file as 0.0.0 (triggers update)', async () => {
    mockReadFile.mockRejectedValue(new Error('404'))

    const updated = await checkAndUpdate('test-sprite')

    expect(updated).toBe(true)
    expect(mockDeployCode).toHaveBeenCalledWith('test-sprite')
  })

  it('treats legacy integer version as outdated', async () => {
    mockReadFile.mockResolvedValue('3')

    const updated = await checkAndUpdate('test-sprite')

    // "3" -> 0.0.3, which is < 0.3.1
    expect(updated).toBe(true)
    expect(mockDeployCode).toHaveBeenCalled()
  })

  it('installs poppler-utils if missing during update', async () => {
    mockReadFile.mockResolvedValue('0.1.0')

    await checkAndUpdate('test-sprite')

    const popplerCall = mockSpriteExec.mock.calls.find(
      (call) => typeof call[1] === 'string' && call[1].includes('poppler-utils')
    )
    expect(popplerCall).toBeDefined()
    expect(popplerCall![1]).toContain('pdftotext')
  })

  it('cleans stale files from previous versions', async () => {
    mockReadFile.mockResolvedValue('0.1.0')

    await checkAndUpdate('test-sprite')

    const cleanupCall = mockSpriteExec.mock.calls.find(
      (call) => typeof call[1] === 'string' && call[1].includes('rm -rf')
    )
    expect(cleanupCall).toBeDefined()
    expect(cleanupCall![1]).toContain('/workspace/.os/src/agents')
  })

  it('installs deps via pip', async () => {
    mockReadFile.mockResolvedValue('0.1.0')

    await checkAndUpdate('test-sprite')

    const pipCall = mockSpriteExec.mock.calls.find(
      (call) => typeof call[1] === 'string' && call[1].includes('pip install')
    )
    expect(pipCall).toBeDefined()
  })
})
