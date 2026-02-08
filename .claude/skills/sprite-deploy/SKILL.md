---
name: sprite-deploy
description: Deploy Sprite code and restart the server process on a Sprites.dev VM. Use when code in sprite/src/ has been modified and needs to be deployed to a running Sprite. Handles file upload via FS API, ownership fix, server kill, and server restart via exec WS API. Invoke with `/sprite-deploy` or `/sprite-deploy <sprite-name>`.
---

# Sprite Deploy

Deploy updated Python code + soul.md to a Sprite VM and restart the server.

## Prerequisites

- Working directory: commands run from `bridge/`
- Environment: `bridge/.env` must contain `SPRITES_TOKEN` and `SPRITES_PROXY_TOKEN`
- Default sprite: `sd-e2e-test` (override with argument)

## Steps

Run sequentially from `bridge/` directory. Replace `<SPRITE>` with the sprite name (default: `sd-e2e-test`).

### 1. Deploy code (FS API)

```bash
cd /Users/fraserbrown/stackdocs/bridge && export $(grep -v '^#' .env | xargs) && npx tsx scripts/deploy-code.ts <SPRITE>
```

Expect: `[bootstrap] Deployed 13 source files + soul.md` + `Done`

If 401 auth error: env vars didn't load. Verify `bridge/.env` exists with `SPRITES_TOKEN`.

### 2. Fix ownership

FS API writes as `ubuntu`, server runs as `sprite`. Fix BOTH `/workspace/src` and `/workspace/memory`:

```bash
sprite exec -s <SPRITE> -- bash -c 'sudo chown -R sprite:sprite /workspace/src /workspace/memory && echo "ownership fixed"'
```

### 3. Kill existing server

**IMPORTANT: Server processes are stubborn on Sprites.** pkill often fails silently or the process respawns. Always verify with a separate pgrep command after killing.

**Step 3a: Kill and wait**
```bash
sprite exec -s <SPRITE> -- bash -c 'pkill -9 -f "python.*src.server" 2>/dev/null; sleep 2; echo "kill sent"'
```

Note: The exit code will be 137 (SIGKILL) — this is expected, not an error.

**Step 3b: Verify it's actually dead**
```bash
sprite exec -s <SPRITE> -- bash -c 'pgrep -f "python.*src.server" || echo "server stopped"'
```

If PIDs still appear, the process respawned. Repeat 3a and 3b. On Sprites, killed processes can take a few seconds to fully terminate due to checkpoint/CRIU. Two rounds of kill + verify is normal.

**Step 3c: Nuclear option (if still running)**
```bash
sprite exec -s <SPRITE> -- bash -c 'ps aux | grep python'
```
Then kill specific PIDs:
```bash
sprite exec -s <SPRITE> -- bash -c 'kill -9 <PID> 2>/dev/null; echo "killed <PID>"'
```

### 4. Start server + verify

Start via exec WS API (`max_run_after_disconnect=0` for persistence) and run a test mission:

```bash
cd /Users/fraserbrown/stackdocs/bridge && export $(grep -v '^#' .env | xargs) && npx tsx scripts/test-e2e-v2.ts <SPRITE>
```

Expect:
- `Sprite server listening on tcp://0.0.0.0:8765`
- Agent response event
- `=== Done ===`

**If `address already in use`:** The first run of test-e2e-v2 may start the server but timeout on the proxy connection (race condition — server needs a moment to bind). In this case, just run the same command again. The second run will connect to the already-running server and succeed.

**If proxy timeout on first run:** This is normal. The server started fine but the proxy couldn't connect in time. Run again — it will work.

### 5. Verify resume (optional)

```bash
cd /Users/fraserbrown/stackdocs/bridge && export $(grep -v '^#' .env | xargs) && npx tsx scripts/test-resume.ts <SPRITE>
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 401 auth | `export $(grep -v '^#' .env \| xargs)` then retry |
| Address in use | Server is already running. Just run test-e2e-v2 again (it connects to existing server) |
| Proxy timeout on first run | Normal race condition. Run test-e2e-v2 again. |
| Exit code 137/143 after kill | Expected — that's the killed process's exit code, not an error |
| Server processes keep respawning | Kill + wait 2s + verify. Repeat up to 3 times. CRIU checkpoint system can delay termination. |
| Server timeout | Check exec output for Python tracebacks |
| Sprite sleeping | Any API call auto-wakes. Just run the command. |
| Permission denied | Re-run step 2 (ownership fix) — include `/workspace/memory` |
