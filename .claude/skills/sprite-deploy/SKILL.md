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

### 1. Kill existing server

**Kill by port PID — this is the only reliable method.** Do NOT use `pkill -f` (kills the exec session too, exit code 137) or `pgrep -f` (matches its own exec bash process, gives false positives).

**Step 1a: Kill the process holding port 8765**
```bash
sprite exec -s <SPRITE> -- bash -c 'PID=$(ss -tlnp | grep 8765 | grep -oP "pid=\K\d+"); if [ -n "$PID" ]; then kill -9 $PID; sleep 1; echo "killed PID $PID"; else echo "no server on 8765"; fi'
```

**Step 1b: Verify port is free**
```bash
sprite exec -s <SPRITE> -- bash -c 'ss -tlnp | grep 8765 || echo "port 8765 free"'
```

If the port is still in use, repeat 1a. On Sprites, CRIU checkpoint can delay process termination — a second round is occasionally needed.

### 2. Deploy code (FS API)

```bash
cd /Users/fraserbrown/stackdocs/bridge && export $(grep -v '^#' .env | xargs) && npx tsx scripts/deploy-code.ts <SPRITE>
```

Expect: `[bootstrap] Deployed 14 source files + soul.md, os.md` + `Done`

If 401 auth error: env vars didn't load. Verify `bridge/.env` exists with `SPRITES_TOKEN`.

### 3. Fix ownership + update VERSION

FS API writes as `ubuntu`, server runs as `sprite`. Fix permissions and bump VERSION:

```bash
sprite exec -s <SPRITE> -- bash -c 'sudo chown -R sprite:sprite /workspace/.os && echo "ownership fixed"'
```

Update the VERSION file (replace `X.Y.Z` with CURRENT_VERSION from `bridge/src/bootstrap.ts`):
```bash
sprite exec -s <SPRITE> -- bash -c 'echo -n "X.Y.Z" > /workspace/.os/VERSION && echo "VERSION: $(cat /workspace/.os/VERSION)"'
```

### 4. Start server + verify

Start via exec WS API (`max_run_after_disconnect=0` for persistence) and run a test mission:

```bash
cd /Users/fraserbrown/stackdocs/bridge && export $(grep -v '^#' .env | xargs) && npx tsx scripts/test-e2e-v2.ts <SPRITE>
```

Expect:
- `Sprite server listening on tcp://0.0.0.0:8765`
- `Proxy connected`
- Agent response event (e.g. `"content": "4"`)
- `=== Done ===`

**If proxy timeout or address-in-use:** The port was not fully freed before starting. Go back to Step 1 — verify port is free, then retry.

### 5. Post-deploy verification

```bash
sprite exec -s <SPRITE> -- bash -c 'echo "VERSION: $(cat /workspace/.os/VERSION)"; ss -tlnp | grep 8765 && echo "server listening"; ls /workspace/src 2>/dev/null && echo "WARNING: stale /workspace/src exists" || echo "no stale code"'
```

### 6. Verify resume (optional)

```bash
cd /Users/fraserbrown/stackdocs/bridge && export $(grep -v '^#' .env | xargs) && npx tsx scripts/test-resume.ts <SPRITE>
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 401 auth | `export $(grep -v '^#' .env \| xargs)` then retry |
| Address in use | Port not freed. Run Step 1 (kill by port PID), verify free, then retry Step 4 |
| Proxy timeout | Same as above — port must be confirmed free before starting server |
| Server timeout | Check exec output for Python tracebacks (import errors, missing deps) |
| Sprite sleeping | Any API call auto-wakes. Just run the command. |
| Permission denied | Re-run Step 3 ownership fix |
| `pkill` exit code 137 | Don't use `pkill -f` — it kills the exec session. Use port-based kill (Step 1) |
| `pgrep` shows PIDs but no Python running | False positive — `pgrep -f` matches its own exec bash. Use `ss -tlnp` instead |

## Key Lessons

- **Always kill by port, not by process name.** `ss -tlnp | grep 8765` is the source of truth for whether the server is running.
- **Always verify port is free before starting.** The "run test twice" workaround was masking stale processes holding the port.
- **Kill and verify must be separate exec sessions.** `pkill -9` propagates and kills the exec session itself.
- **`pgrep -f` is unreliable on Sprites.** It matches the bash process running the grep. Use `ps aux | grep "[p]ython"` or `ss -tlnp` instead.
