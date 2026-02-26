/**
 * Sprite Bootstrap — initializes a fresh sprite with packages, code, DB, and memory.
 *
 * Called during provisioning when a new sprite is created. Uses the Sprites.dev
 * exec WebSocket for heavy operations (pip install, DB init) and the FS API
 * for deploying source code files.
 *
 * The golden sprite (anima-golden) serves as the reference environment.
 * New sprites are bootstrapped from scratch to match it.
 */

import { readFile as fsRead } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFile } from './sprites-client.js'
import { spriteExec } from './sprite-exec.js'

// Current version — bump this when code or deps change.
// The updater checks this against the sprite's /workspace/.os/VERSION file.
export const CURRENT_VERSION = '0.4.0'

// Resolve sprite directory: /app/sprite/ in Docker, ../../sprite/ locally
function getSpriteDir(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/app/sprite'
  }
  return join(import.meta.dirname, '..', '..', 'sprite')
}

// -- Source code deployment --

/** Deploy sprite/src/ Python files to /workspace/.os/src/ on the sprite. */
export async function deployCode(spriteName: string): Promise<void> {
  const spriteDir = getSpriteDir()

  const srcFiles = [
    '__init__.py',
    'server.py',
    'gateway.py',
    'protocol.py',
    'database.py',
    'runtime.py',
    'state_sync.py',
    'memory/__init__.py',
    'memory/loader.py',
    'memory/hooks.py',
    'memory/processor.py',
    'tools/__init__.py',
    'tools/canvas.py',
    'tools/memory.py',
  ]

  for (const file of srcFiles) {
    const content = await fsRead(join(spriteDir, 'src', file), 'utf-8')
    await writeFile(spriteName, `/workspace/.os/src/${file}`, content)
  }

  // Deploy-managed memory files — overwritten on every deploy
  const deployManagedFiles = ['soul.md', 'os.md']
  for (const file of deployManagedFiles) {
    const content = await fsRead(join(spriteDir, 'memory', file), 'utf-8')
    await writeFile(spriteName, `/workspace/.os/memory/${file}`, content)
  }

  console.log(`[bootstrap] Deployed ${srcFiles.length} source files + ${deployManagedFiles.join(', ')}`)
}

/** Deploy requirements.txt to /workspace/.os/ on the sprite. */
async function deployRequirements(spriteName: string): Promise<void> {
  const content = await fsRead(
    join(getSpriteDir(), 'requirements.txt'),
    'utf-8',
  )
  await writeFile(spriteName, '/workspace/.os/requirements.txt', content)
}

// -- SQLite schema --

const INIT_DB_SCRIPT = `
import sqlite3

# transcript.db — append-only conversation log
t_conn = sqlite3.connect("/workspace/.os/memory/transcript.db")
t_conn.execute("PRAGMA journal_mode=WAL")
t_conn.execute("PRAGMA foreign_keys=ON")
t_conn.execute("PRAGMA busy_timeout=5000")
t_conn.executescript("""
CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY,
    timestamp REAL,
    session_id TEXT,
    sequence_num INTEGER,
    user_message TEXT,
    tool_calls_json TEXT,
    agent_response TEXT,
    processed INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at REAL,
    ended_at REAL,
    message_count INTEGER,
    observation_count INTEGER
);
CREATE INDEX IF NOT EXISTS idx_observations_processed ON observations(processed);
""")
t_conn.close()

# memory.db — searchable learnings archive with FTS5
m_conn = sqlite3.connect("/workspace/.os/memory/memory.db")
m_conn.execute("PRAGMA journal_mode=WAL")
m_conn.execute("PRAGMA foreign_keys=ON")
m_conn.execute("PRAGMA busy_timeout=5000")
m_conn.executescript("""
CREATE TABLE IF NOT EXISTS learnings (
    id INTEGER PRIMARY KEY,
    created_at REAL,
    session_id TEXT,
    type TEXT,
    content TEXT,
    source_observation_id INTEGER,
    confidence REAL
);
CREATE TABLE IF NOT EXISTS pending_actions (
    id INTEGER PRIMARY KEY,
    created_at REAL,
    content TEXT,
    priority INTEGER,
    status TEXT,
    source_learning_id INTEGER
);
CREATE VIRTUAL TABLE IF NOT EXISTS learnings_fts USING fts5(
    content, type, content=learnings, content_rowid=id
);
CREATE TRIGGER IF NOT EXISTS learnings_ai AFTER INSERT ON learnings BEGIN
    INSERT INTO learnings_fts(rowid, content, type) VALUES (new.id, new.content, new.type);
END;
CREATE TRIGGER IF NOT EXISTS learnings_ad AFTER DELETE ON learnings BEGIN
    INSERT INTO learnings_fts(learnings_fts, rowid, content, type) VALUES ('delete', old.id, old.content, old.type);
END;
CREATE TRIGGER IF NOT EXISTS learnings_au AFTER UPDATE ON learnings BEGIN
    INSERT INTO learnings_fts(learnings_fts, rowid, content, type) VALUES ('delete', old.id, old.content, old.type);
    INSERT INTO learnings_fts(learnings_fts, rowid, content, type) VALUES (new.id, new.content, new.type);
END;
""")
m_conn.close()
print("OK")
`

// Daemon-managed memory files — deployed once on bootstrap, not overwritten by updates.
const DAEMON_MANAGED_FILES = ['tools.md', 'files.md', 'user.md', 'context.md']

// -- Bootstrap orchestration --

/**
 * Bootstrap a fresh sprite with everything needed to run the agent.
 * Takes ~30-60 seconds depending on pip install speed.
 */
export async function bootstrapSprite(spriteName: string): Promise<void> {
  console.log(`[bootstrap] Starting bootstrap for ${spriteName}`)
  const start = Date.now()

  // 1. Create directories and fix ownership (FS API writes as ubuntu, server runs as sprite)
  await spriteExec(spriteName, [
    'sudo chown sprite:sprite /workspace',
    '&& mkdir -p /workspace/.os/src /workspace/.os/src/tools',
    '/workspace/.os/src/memory /workspace/.os/memory /workspace/.os/.venv /workspace/.os/apps',
    '/workspace/documents /workspace/ocr /workspace/extractions /workspace/artifacts',
  ].join(' '))
  console.log(`[bootstrap] Directories created`)

  // 2. Install python3-venv (needed for venv creation)
  await spriteExec(spriteName,
    'sudo apt-get update -qq && sudo apt-get install -y -qq python3-venv poppler-utils 2>&1 | tail -1',
  )

  // 3. Create venv and install packages
  await spriteExec(spriteName, 'python3 -m venv /workspace/.os/.venv')
  await deployRequirements(spriteName)
  await spriteExec(spriteName,
    '/workspace/.os/.venv/bin/pip install -r /workspace/.os/requirements.txt 2>&1 | tail -1',
  )
  console.log(`[bootstrap] Venv created and packages installed`)

  // 4. Deploy source code
  await deployCode(spriteName)

  // 5. Initialize SQLite database
  await spriteExec(spriteName,
    `/workspace/.os/.venv/bin/python3 -c '${INIT_DB_SCRIPT.replace(/'/g, "'\\''")}'`,
  )
  console.log(`[bootstrap] SQLite databases initialized (transcript.db + memory.db)`)

  // 6. Deploy daemon-managed memory templates (only on fresh bootstrap, not overwritten by updates)
  const spriteDir = getSpriteDir()
  for (const file of DAEMON_MANAGED_FILES) {
    const content = await fsRead(join(spriteDir, 'memory', file), 'utf-8')
    await writeFile(spriteName, `/workspace/.os/memory/${file}`, content)
  }
  console.log(`[bootstrap] Memory templates created (${DAEMON_MANAGED_FILES.length} daemon-managed)`)

  // 7. Write VERSION file
  await writeFile(spriteName, '/workspace/.os/VERSION', CURRENT_VERSION)

  // 8. Fix ownership — FS API writes as ubuntu, but server runs as sprite
  await spriteExec(spriteName, 'sudo chown -R sprite:sprite /workspace')
  console.log(`[bootstrap] Ownership fixed (sprite:sprite)`)

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[bootstrap] Bootstrap complete for ${spriteName} in ${elapsed}s`)
}
