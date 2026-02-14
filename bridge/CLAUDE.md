# Bridge CLAUDE.md

See root `CLAUDE.md` for project overview, tech stack, and development workflow.

## Quick Facts

- **Purpose**: Lightweight WebSocket proxy between browser connections and Sprite VMs
- **Runtime**: Node.js 22 (Fly.io shared-cpu-1x 256MB)
- **Protocol**: WebSocket (browser) + TCP Proxy WebSocket (Sprite)
- **Auth**: Clerk JWT validation on connect only (trust connection after)
- **Data**: Supabase `users` table for Sprite mapping (`sprite_name`, `sprite_status`)
- **Testing**: Vitest 3.0 with real HTTP/WS servers + mock Sprite facade
- **Deployment**: Fly.io app `stackdocs-bridge`, syd region, `wss://ws.stackdocs.io`

## What the Bridge Does

1. **Accept browser WebSocket connections** on `/ws` only (no other routes except `/health` and `/api/*`)
2. **Validate Clerk JWT** on first `auth` message (not on connect — WebSocket upgrade has no auth headers)
3. **Look up user's Sprite** in Supabase `users` table (`sprite_name`, `sprite_status`)
4. **Connect to Sprite** via TCP Proxy WebSocket (one connection per user, shared across tabs)
5. **Proxy messages bidirectionally** (browser → Sprite, Sprite → all browser tabs)
6. **Handle Sprite sleep/wake** reconnection (TCP connections die on sleep, processes survive)
7. **Prevent auto-sleep** during active sessions (keepalive pings every 15s)
8. **Lazy provisioning** (create Sprite VM, bootstrap code, start server if not exists)
9. **Lazy code updates** (check VERSION file on Sprite wake, redeploy if outdated)
10. **Proxy API keys** for Anthropic/Mistral (Sprites use Bridge URL as base, no keys on Sprite)

## Directory Structure

```
bridge/
├── src/
│   ├── index.ts            # HTTP server + WS upgrade on /ws
│   ├── protocol.ts         # SOURCE OF TRUTH — WebSocket message types
│   ├── auth.ts             # Clerk JWT validation + Supabase user lookup
│   ├── proxy.ts            # Sprite connection registry + message forwarding
│   ├── connection-store.ts # Browser connection registry (keyed by connectionId)
│   ├── sprite-connection.ts # TCP Proxy WebSocket client
│   ├── sprites-client.ts   # Sprites.dev REST API client
│   ├── provisioning.ts     # Lazy Sprite creation + bootstrap
│   ├── bootstrap.ts        # Deploy code, init DB, write memory templates
│   ├── reconnect.ts        # Sprite sleep/wake reconnection + buffering
│   ├── keepalive.ts        # Ping sender (prevents 30s auto-sleep)
│   ├── api-proxy.ts        # HTTP proxy for Anthropic/Mistral API calls
│   ├── updater.ts          # Lazy code updates (check VERSION file)
│   └── sprite-exec.ts      # Sprites.dev exec API client
├── tests/
│   ├── setup.ts            # Vitest global setup (mock factories)
│   └── *.test.ts           # 136 tests (real HTTP/WS + mock Sprite)
├── Dockerfile              # Multi-stage build (deps → build → runtime)
├── fly.toml                # Fly.io config (auto-stop/start, health checks)
└── package.json
```

## Key Patterns

### One Sprite Per User (Not Per Tab)

Multiple browser tabs for the same user share ONE Sprite TCP connection. `spriteConnections` Map keyed by `userId`. Last tab disconnect triggers cleanup.

```typescript
// proxy.ts
const spriteConnections = new Map<string, SpriteConnection>()

// ensureSpriteConnection() — called on first browser tab connect
// forwardToSprite() — sends message to Sprite
// broadcastToBrowsers() — sends message to all browser tabs for userId
// disconnectSprite() — called when last browser tab disconnects
```

### Auth Flow (Multi-Message Handshake)

1. Browser connects → WebSocket upgrade (no auth yet)
2. Bridge sends `{type: "connected"}` (unauthenticated state)
3. Browser sends `{type: "auth", token: "jwt"}`
4. Bridge validates JWT → looks up `users` table → sends `{type: "connected"}` again (authenticated)
5. Bridge connects to Sprite → sends `{type: "sprite_ready"}`
6. User can now send messages

**Why not auth on upgrade?** WebSocket upgrade request has no custom headers in browser (CORS).

```typescript
// index.ts
async function handleConnection(ws: WebSocket, connectionId: string) {
  // 1. Send unauthenticated "connected" message
  ws.send(JSON.stringify(createSystemMessage('connected')))

  // 2. Wait for auth message (10s timeout)
  const authResult = await authenticateConnection(token)
  if (isAuthError(authResult)) { /* disconnect */ }

  // 3. Register connection, connect to Sprite
  const spriteConn = await ensureSpriteConnection(userId, spriteName, token)

  // 4. Send sprite_ready
  ws.send(JSON.stringify(createSystemMessage('sprite_ready')))

  // 5. Forward messages
  ws.on('message', (data) => forwardToSprite(userId, data))
}
```

### Protocol Types (Source of Truth)

`bridge/src/protocol.ts` defines ALL message types (base, blocks, messages, type guards). Changes here MUST sync to:
- `sprite/src/protocol.py` (Python dataclasses)
- `frontend/types/ws-protocol.ts` (TypeScript copy)

Every message MUST have:
- `type: string`
- `id: string` (UUID)
- `timestamp: number` (Unix epoch ms)
- Optional `request_id: string` (references request message)

```typescript
// protocol.ts
export interface WebSocketMessageBase {
  type: string
  id: string
  timestamp: number
  request_id?: string
}

export interface ChatMessage extends WebSocketMessageBase {
  type: 'chat'
  text: string
  mode?: 'voice' | 'text'
}
```

### Sprite Sleep/Wake Reconnection

**Sprites.dev behavior:**
- Processes frozen on sleep (checkpoint/CRIU, same PID on wake)
- TCP connections die on sleep/wake
- 30s auto-sleep (unless exec session active or keepalive pings)
- 1-12s cold wake latency

**Bridge reconnect strategy:**
1. Sprite TCP disconnects → `reconnect.ts` detects it
2. Poll Sprite until awake (max 30s)
3. Reconnect TCP Proxy WebSocket
4. Drain buffered messages
5. Send `{type: "sprite_waking"}` during reconnection
6. Send `{type: "sprite_ready"}` when reconnected

Reconnection is **coalesced per user** — if multiple tabs trigger it, only one reconnection happens.

```typescript
// reconnect.ts
export async function handleDisconnect(
  userId: string,
  context: ReconnectContext
): Promise<void> {
  // Coalesce: only one reconnection per user
  if (isReconnecting(userId)) return

  // Poll until awake, reconnect, drain buffer
  await reconnectToSprite(userId, context)
}
```

### Lazy Provisioning

**First browser connect:** If `users.sprite_name` is NULL → provision new Sprite.

1. Create VM via Sprites.dev REST API
2. Deploy code (upload `sprite/src/*` via FS API)
3. Bootstrap (create venv, pip install, init DB, write memory templates)
4. Start server (`python -m src.server` via exec API, `max_run_after_disconnect=0`)
5. Update Supabase `users` table (`sprite_name`, `sprite_status`)

```typescript
// provisioning.ts
export async function provisionSprite(userId: string): Promise<void> {
  const spriteName = `user-${userId.slice(0, 8)}`
  await createSprite(spriteName)
  await bootstrapSprite(spriteName)
  await startSpriteServer(spriteName)
  await updateUserSpriteMapping(userId, spriteName)
}
```

### Lazy Code Updates

**On Sprite wake:** Check `/workspace/VERSION` file. If outdated → redeploy code (not full bootstrap).

```typescript
// updater.ts
export async function checkAndUpdate(spriteName: string): Promise<void> {
  const remoteVersion = await readVersion(spriteName)
  if (remoteVersion !== CURRENT_VERSION) {
    await deployCode(spriteName)
    await writeVersion(spriteName)
  }
}
```

### Keepalive (Prevent Auto-Sleep)

Send `{type: "ping"}` every 15s to Sprite. Sprite ignores pings (no response needed). Prevents 30s auto-sleep during active sessions.

```typescript
// keepalive.ts
export function startKeepalive(userId: string): void {
  const interval = setInterval(() => {
    forwardToSprite(userId, { type: 'ping', id: uuidv4(), timestamp: Date.now() })
  }, 15_000)
  keepalives.set(userId, interval)
}
```

### API Key Proxy

Sprites call `wss://ws.stackdocs.io/api/anthropic/*` or `/api/mistral/*`. Bridge validates `X-Sprite-Token` header, adds real API key, forwards to Anthropic/Mistral.

**Why?** Prevent prompt injection attacks stealing API keys from Sprite env vars.

```typescript
// api-proxy.ts
export async function handleApiProxy(req: IncomingMessage, res: ServerResponse) {
  const spriteToken = req.headers['x-sprite-token']
  if (spriteToken !== process.env.SPRITES_PROXY_TOKEN) {
    res.writeHead(401).end()
    return
  }

  // Forward to real API with real key
  const realUrl = req.url.replace('/api/anthropic', 'https://api.anthropic.com')
  // ... proxy request
}
```

## Testing

**Vitest 3.0** with 136 tests passing. Uses real HTTP/WS servers + mock Sprite (TCP Proxy facade).

### Mock Patterns

```typescript
// tests/setup.ts
vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    verifyToken: vi.fn().mockResolvedValue({ sub: 'user-123' })
  })
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient
}))

// Spy on external calls
vi.spyOn(spritesClient, 'buildProxyUrl').mockReturnValue('ws://mock')
```

### Reset Functions (Between Tests)

```typescript
import {
  resetSpriteConnections,
  resetKeepalives,
  resetReconnectState,
  resetSupabaseClient,
} from './src/index.js'

afterEach(() => {
  resetSpriteConnections()
  resetKeepalives()
  resetReconnectState()
  resetSupabaseClient()
})
```

## Deployment

**Fly.io app:** `stackdocs-bridge`
**Region:** Sydney (`syd`)
**Machine:** `shared-cpu-1x`, 256MB, auto-stop/start, min 0 running (~$2/mo)
**URL:** `wss://ws.stackdocs.io/ws`
**Health:** `https://ws.stackdocs.io/health`

### Secrets

Set via `flyctl secrets set`:
- `CLERK_SECRET_KEY` — Clerk secret key for JWT validation
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key (read `users` table)
- `SPRITES_TOKEN` — Sprites.dev API token (create/read Sprites)
- `ANTHROPIC_API_KEY` — Anthropic API key (proxied to Sprites)
- `MISTRAL_API_KEY` — Mistral API key (proxied to Sprites)
- `SPRITES_PROXY_TOKEN` — Secret token Sprites use to call Bridge API proxy

### Deploy

```bash
cd bridge/
flyctl deploy
```

Multi-stage Dockerfile: deps → build → runtime. Final image ~200MB.

## Common Tasks

**Add new message type:**
1. Update `bridge/src/protocol.ts` (source of truth)
2. Copy to `frontend/types/ws-protocol.ts`
3. Update `sprite/src/protocol.py` (Python dataclasses)
4. Add type guard if needed (`is{MessageType}()`)

**Add new Sprite API call:**
1. Add function to `sprites-client.ts`
2. Call from `provisioning.ts`, `updater.ts`, or `bootstrap.ts`
3. Test via `tests/sprites-client.test.ts`

**Debug connection issues:**
1. Check Bridge logs: `flyctl logs`
2. Check Sprite logs: via Sprites.dev dashboard or exec API
3. Check Supabase `users` table: `sprite_name`, `sprite_status`
4. Test locally: `npm test` (mocks Sprite, real WS server)
