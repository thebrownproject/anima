---
name: sprite-deploy
description: Deploy Sprite code and restart the server process on a Sprites.dev VM. Use when code in sprite/src/ has been modified and needs to be deployed to a running Sprite. Handles file upload via FS API, ownership fix, server kill, and server restart via exec WS API. Invoke with `/sprite-deploy` or `/sprite-deploy <sprite-name>`.
---

# Sprite Deploy

Deploy updated Python code to a Sprite VM and restart the server.

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

Expect: `[bootstrap] Deployed 13 source files` + `Done`

If 401 auth error: env vars didn't load. Verify `bridge/.env` exists with `SPRITES_TOKEN`.

### 2. Fix ownership

FS API writes as `ubuntu`, server runs as `sprite`:

```bash
sprite exec -s <SPRITE> -- bash -c 'sudo chown -R sprite:sprite /workspace/src && echo "ownership fixed"'
```

### 3. Kill existing server

```bash
sprite exec -s <SPRITE> -- bash -c 'pkill -f "python.*src.server" 2>/dev/null; sleep 1; pgrep -f "python.*src.server" || echo "server stopped"'
```

If processes persist, force kill:

```bash
sprite exec -s <SPRITE> -- bash -c 'pkill -9 -f "python.*src.server" 2>/dev/null; sleep 1; echo "force killed"'
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

If `address already in use`: old server wasn't killed. Go back to step 3 with force kill.

### 5. Verify resume (optional)

```bash
cd /Users/fraserbrown/stackdocs/bridge && export $(grep -v '^#' .env | xargs) && npx tsx scripts/test-resume.ts <SPRITE>
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 401 auth | `export $(grep -v '^#' .env \| xargs)` then retry |
| Address in use | Force kill: `pkill -9 -f "python.*src.server"` |
| Server timeout | Check exec output for Python tracebacks |
| Sprite sleeping | Any API call auto-wakes. Just run the command. |
| Permission denied | Re-run step 2 (ownership fix) |
