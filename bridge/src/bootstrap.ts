/**
 * Sprite Bootstrap — initializes a fresh sprite with packages, code, DB, and memory.
 *
 * Called during provisioning when a new sprite is created. Uses the Sprites.dev
 * exec WebSocket for heavy operations (pip install, DB init) and the FS API
 * for deploying source code files.
 *
 * The golden sprite (stackdocs-golden) serves as the reference environment.
 * New sprites are bootstrapped from scratch to match it.
 */

import { readFile as fsRead } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFile } from './sprites-client.js'
import { spriteExec } from './sprite-exec.js'

// Current version — bump this when code or deps change.
// The updater checks this against the sprite's /workspace/VERSION file.
export const CURRENT_VERSION = 2

// -- Source code deployment --

/** Deploy sprite/src/ Python files to /workspace/src/ on the sprite. */
export async function deployCode(spriteName: string): Promise<void> {
  const srcDir = join(import.meta.dirname, '..', '..', 'sprite', 'src')
  const files = ['__init__.py', 'server.py', 'gateway.py', 'protocol.py', 'database.py', 'runtime.py']

  for (const file of files) {
    const content = await fsRead(join(srcDir, file), 'utf-8')
    await writeFile(spriteName, `/workspace/src/${file}`, content)
  }

  console.log(`[bootstrap] Deployed ${files.length} source files`)
}

/** Deploy requirements.txt to /workspace/ on the sprite. */
async function deployRequirements(spriteName: string): Promise<void> {
  const content = await fsRead(
    join(import.meta.dirname, '..', '..', 'sprite', 'requirements.txt'),
    'utf-8',
  )
  await writeFile(spriteName, '/workspace/requirements.txt', content)
}

// -- SQLite schema --

const INIT_DB_SCRIPT = `
import sqlite3
DB_PATH = "/workspace/agent.db"
SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    status TEXT DEFAULT 'processing' CHECK(status IN ('processing','ocr_complete','completed','failed')),
    display_name TEXT,
    tags TEXT,
    summary TEXT,
    session_id TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ocr_results (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL UNIQUE REFERENCES documents(id),
    ocr_file_path TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS extractions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    extracted_fields TEXT NOT NULL,
    confidence_scores TEXT,
    mode TEXT NOT NULL,
    custom_fields TEXT,
    status TEXT DEFAULT 'completed' CHECK(status IN ('pending','in_progress','completed','failed')),
    session_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    chunk_id, content, source_file, agent_id
);
"""
conn = sqlite3.connect(DB_PATH)
conn.executescript(SCHEMA)
conn.close()
print("OK")
`

// -- Memory templates --

const SOUL_MD = `# Stack Identity

This stack has not been configured yet.

## Purpose
(Agent will update this after learning what the user needs)

## Extraction Rules
(Agent will learn extraction patterns from user corrections)
`

const USER_MD = `# User Preferences

(Agent will learn preferences from interactions)
`

const MEMORY_MD = `# Global Memory

No documents processed yet. No sessions completed.
`

// -- Bootstrap orchestration --

/**
 * Bootstrap a fresh sprite with everything needed to run the agent.
 * Takes ~30-60 seconds depending on pip install speed.
 */
export async function bootstrapSprite(spriteName: string): Promise<void> {
  console.log(`[bootstrap] Starting bootstrap for ${spriteName}`)
  const start = Date.now()

  // 1. Create directories
  await spriteExec(spriteName, [
    'mkdir -p /workspace/documents /workspace/ocr /workspace/artifacts',
    '/workspace/memory /workspace/transcripts /workspace/src',
  ].join(' '))
  console.log(`[bootstrap] Directories created`)

  // 2. Install python3-venv (needed for venv creation)
  await spriteExec(spriteName,
    'sudo apt-get update -qq && sudo apt-get install -y -qq python3-venv 2>&1 | tail -1',
  )

  // 3. Create venv and install packages
  await spriteExec(spriteName, 'python3 -m venv /workspace/.venv')
  await deployRequirements(spriteName)
  await spriteExec(spriteName,
    '/workspace/.venv/bin/pip install -r /workspace/requirements.txt 2>&1 | tail -1',
  )
  console.log(`[bootstrap] Venv created and packages installed`)

  // 4. Deploy source code
  await deployCode(spriteName)

  // 5. Initialize SQLite database
  await spriteExec(spriteName,
    `/workspace/.venv/bin/python3 -c '${INIT_DB_SCRIPT.replace(/'/g, "'\\''")}'`,
  )
  console.log(`[bootstrap] SQLite database initialized`)

  // 6. Create memory templates
  await writeFile(spriteName, '/workspace/memory/soul.md', SOUL_MD)
  await writeFile(spriteName, '/workspace/memory/user.md', USER_MD)
  await writeFile(spriteName, '/workspace/memory/MEMORY.md', MEMORY_MD)
  console.log(`[bootstrap] Memory templates created`)

  // 7. Write VERSION file
  await writeFile(spriteName, '/workspace/VERSION', String(CURRENT_VERSION))

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[bootstrap] Bootstrap complete for ${spriteName} in ${elapsed}s`)
}
