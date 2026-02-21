# Feature: Demo Readiness Roadmap

**Goal:** Take Stackdocs from "built but off" to a working, demoable product where a user can sign up, talk to the agent, upload an invoice, see extracted data in a table card, and export it.

## Overview

A codebase audit revealed that most product flows are architecturally complete. The primary blocker is that API keys aren't deployed to Fly.io, meaning the agent can't respond. After deploying configuration and fixing a few gaps, the core demo flow (chat + document extraction + Canvas cards) should work end-to-end.

This plan covers Phases A (turn it on), B1 (extraction core), and B2 (polish). Phase C (protocol codegen, observability, evals) is deferred until B2 validates.

**Prerequisite:** m7b.14 (Connection Stability) must be complete before starting.

## Tasks

### Task: Deploy API Keys and Verify Bridge Secrets

**Goal:** Set all required Fly.io secrets so the Bridge can boot and proxy API calls to Sprites.
**Files:** Modify `bridge/src/index.ts` (REQUIRED_ENV_VARS array, lines 50-54). Fly.io secrets via CLI.
**Depends on:** None
**Priority:** P1

**Steps:**
1. Add `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `SPRITES_PROXY_TOKEN`, `BRIDGE_PUBLIC_URL` to the `REQUIRED_ENV_VARS` array in `bridge/src/index.ts`
2. Write unit test: `validateEnv()` throws listing ALL missing vars when any are absent
3. Run `flyctl secrets set ANTHROPIC_API_KEY=... MISTRAL_API_KEY=... SPRITES_PROXY_TOKEN=... BRIDGE_PUBLIC_URL=https://ws.stackdocs.io` from bridge dir
4. Deploy: `flyctl deploy`
5. Verify: `curl https://ws.stackdocs.io/health` returns OK
6. Verify: `flyctl logs` shows no secret values, no "missing env" errors
7. Document rollback: `flyctl secrets unset <key>` + `flyctl deploy --image <previous>`

**Tests:**
- [ ] `validateEnv()` throws when `ANTHROPIC_API_KEY` is missing
- [ ] `validateEnv()` throws when `MISTRAL_API_KEY` is missing
- [ ] `validateEnv()` throws when `SPRITES_PROXY_TOKEN` is missing
- [ ] Error message lists ALL missing vars, not just the first
- [ ] Health endpoint returns OK after deploy
- [ ] No secret values in Bridge logs

### Task: Security Baseline and Scaffolding Removal

**Goal:** Remove dev scaffolding, verify security baseline for external access.
**Files:** Modify `frontend/app/(desktop)/desktop/page.tsx` (remove DEMO_CARDS). Verify `bridge/src/api-proxy.ts` (proxy token validation). Verify `bridge/src/index.ts` (routes audit).
**Depends on:** None (can be coded in parallel with Task 1)
**Priority:** P1

**Steps:**
1. Remove `DEMO_CARDS` constant and seeding `useEffect` from `desktop/page.tsx` (lines 43-67). Remove unused imports (`setCards`, `DesktopCardType` if unused).
2. Keep the wallpaper-setting `useEffect`.
3. Verify `api-proxy.ts` enforces proxy token validation via `timingSafeEqual` (line 94) -- already implemented, just confirm test coverage.
4. Audit Bridge routes: only `/health`, `/v1/proxy/*`, and `/ws` should exist. Confirm no dev/prototype routes.
5. Verify `frontend/` production build succeeds with no unused variable warnings.

**Tests:**
- [ ] No `DEMO_CARDS` references in production desktop page
- [ ] `npm run build` in frontend/ succeeds cleanly
- [ ] API proxy returns 401 for missing/invalid token (existing test coverage)
- [ ] No dev-only routes exist in Bridge beyond /health, /v1/proxy/*, /ws

### Task: Fix Card Close to Send canvas_interaction

**Goal:** Card close button sends `archive_card` to Sprite for persistence (optimistic UI removal).
**Files:** Modify `frontend/components/desktop/desktop-card.tsx` (handleClose, lines 177-183).
**Depends on:** None
**Priority:** P1

**Steps:**
1. In `handleClose` callback, after `removeCard(card.id)` (optimistic), add `send()` call with `canvas_interaction` message: `{ type: 'canvas_interaction', payload: { card_id: card.id, action: 'archive_card', data: {} } }`
2. The `send` function is available from `useWebSocket()` already imported at line 28.
3. Add `send` to the `useCallback` deps array.
4. Check if template cards (DocumentCard, MetricCard, etc.) go through the same `handleClose`. If they have separate close buttons in `BaseCard`, apply the same fix there. If not, consider adding a floating close button on the `DesktopCard` wrapper so ALL card types can be closed.
5. Verify Sprite-side: `archive_card` handler already exists in `gateway.py`.

**Tests:**
- [ ] Clicking close removes card from viewport immediately (optimistic)
- [ ] Clicking close sends `canvas_interaction` with `action: 'archive_card'` via WebSocket (visible in debug panel)
- [ ] Card does NOT reappear after reconnection (Sprite archived it)
- [ ] Close works for both template cards and generic block cards

### Task: End-to-End Smoke Test

**Goal:** Validate Phase A gate: auth, chat, Canvas all work end-to-end.
**Files:** Create `scripts/smoke-test.ts`. Manual checklist.
**Depends on:** Deploy API Keys, Security Baseline, Fix Card Close
**Priority:** P1

**Steps:**
1. Write a simple smoke test script (`scripts/smoke-test.ts`) that: connects WebSocket to `wss://ws.stackdocs.io/ws`, sends auth token, waits for `sprite_ready`, sends a `mission` message, waits for `agent_event` response, verifies round-trip. Use `ws` library. Gate behind `SMOKE_TEST=1` env var.
2. Run manual smoke test checklist:
   - Sign up in incognito at stackdocs.io
   - Observe connection status goes green
   - Type "Hello, what can you do?" in chat
   - Receive agent response within 10s
   - Ask agent to create a card
   - Card appears on Canvas
   - Close card, refresh -- card does not reappear
   - Check debug panel (Cmd+Shift+D) for errors
3. Document any failures as bugs.

**Tests:**
- [ ] New user sign-up completes without errors
- [ ] Agent responds to "hello" within 10 seconds
- [ ] Agent can create a Canvas card via tool call
- [ ] No hardcoded demo data appears
- [ ] Scripted smoke test exits 0 on success

### Task: Install poppler-utils in Sprite Bootstrap

**Goal:** Ensure `pdftotext` is available on Sprites for PDF text extraction.
**Files:** Modify `bridge/src/bootstrap.ts` (apt-get step, line 172-174; CURRENT_VERSION, line 19).
**Depends on:** Deploy API Keys (for deploy)
**Priority:** P2

**Steps:**
1. In `bootstrap.ts`, add `poppler-utils` to the apt-get install command (line 172-174): `sudo apt-get install -y -qq python3-venv poppler-utils`
2. Bump `CURRENT_VERSION` (e.g., `'0.4.0'`) to trigger lazy update on existing Sprites.
3. **Important**: The lazy updater (`updater.ts`) only redeploys CODE, not apt packages. For existing Sprites, poppler-utils must be installed separately. Options: (a) add a one-time apt-get check in the updater when VERSION changes, or (b) manually install on existing test Sprite via exec. Option (a) is better for production; option (b) is fine for now with few Sprites.

**Tests:**
- [ ] Bootstrap apt-get command includes `poppler-utils`
- [ ] CURRENT_VERSION is bumped
- [ ] On a fresh Sprite, `which pdftotext` returns a path
- [ ] Existing Bridge tests still pass

### Task: Build Extraction Tool for Invoice Processing

**Goal:** Create a structured extraction tool that the agent calls after reading a PDF, outputting invoice data to a table card.
**Files:** Create `sprite/src/tools/extraction.py`. Modify `sprite/src/gateway.py` (_run_extraction prompt). Modify `sprite/src/runtime.py` (register tool). Modify `bridge/src/bootstrap.ts` (add to srcFiles). Create `sprite/tests/test_extraction_tools.py`.
**Depends on:** Install poppler-utils
**Priority:** P1

**Steps:**
1. Write tests first (`test_extraction_tools.py`): tool validates inputs, creates table card with correct columns, persists to workspace.db, handles missing file_path.
2. Create `extraction.py` following the tool factory pattern from `canvas.py`: `create_extraction_tools(send_fn, workspace_db, stack_id_fn)` returning a list of tools.
3. Implement `extract_invoice` tool: accepts vendor, date, line_items, subtotal, tax, grand_total. Builds blocks (HeadingBlock + KeyValueBlock + TableBlock + BadgeBlock). Sends `canvas_update` with `create_card`. Persists to workspace.db.
4. **Critical**: Set BOTH `blocks` (for expanded view via BlockRenderer) AND `headers`/`preview_rows` (for collapsed TableCard view) on the CanvasUpdatePayload. Without `preview_rows`, the card face shows nothing.
5. Update `_run_extraction` prompt in `gateway.py` to guide the agent: "Read the document using pdftotext. If it's an invoice, use extract_invoice with the structured schema."
6. Register tool in `runtime.py` alongside canvas and memory tools.
7. Add `tools/extraction.py` to bootstrap srcFiles list.
8. Handle `line_items` arriving as JSON string (Claude sometimes stringifies lists).

**Tests:**
- [ ] `extract_invoice` validates required inputs (file_path, vendor)
- [ ] Creates table card with correct columns (Description, Quantity, Unit Price, Total)
- [ ] Sets both `blocks` and `preview_rows` on the card
- [ ] Persists card to workspace.db
- [ ] Handles line_items as JSON string
- [ ] Returns error (not crash) for empty inputs

### Task: Wire Table Card Rendering for Extracted Data

**Goal:** Verify extracted invoice data renders correctly in both collapsed (TableCard template) and expanded (BlockRenderer) views.
**Files:** Verify `frontend/components/desktop/cards/table-card.tsx`. Verify `frontend/components/desktop/block-renderer.tsx`. Possibly modify extraction tool for format alignment.
**Depends on:** Build Extraction Tool
**Priority:** P1

**Steps:**
1. Verify TableCard reads `card.headers` (string[]) and `card.previewRows` (string[][]) for the collapsed card face.
2. Verify BlockRenderer handles `TableBlock` with `columns` (string[]) and `rows` (Record<string, unknown>[]) for the expanded overlay view.
3. Test with real extraction output: upload an invoice, check both views render.
4. Add empty-state handling to TableCard: if no headers/rows, check for table blocks in the blocks array as fallback.
5. Verify column/row data types: extraction sends strings, renderer expects strings. Confirm no type mismatches.

**Tests:**
- [ ] TableCard collapsed view shows headers and row data from extraction
- [ ] Expanded overlay shows full table via BlockRenderer
- [ ] Empty table shows appropriate fallback (not blank card)
- [ ] Columns align with data (no off-by-one between headers and row values)

### Task: Verify Extraction Persistence Across Reconnection

**Goal:** Confirm extracted data cards survive Sprite sleep/wake and browser reconnects.
**Files:** Verify `sprite/src/state_sync.py`, `sprite/src/database.py`, `frontend/components/desktop/ws-provider.tsx`.
**Depends on:** Wire Table Card Rendering
**Priority:** P2

**Steps:**
1. Extract an invoice, see the table card.
2. Close the browser tab, reopen `/desktop`.
3. Card should reappear via state_sync with all data intact.
4. Check state_sync message in debug panel -- it should include the extraction card with blocks.
5. If persistence fails, check: blocks stored as JSON text in workspace.db (via `_serialize_block()`), state_sync reads and parses blocks correctly, frontend `mergeCards` maps snake_case to camelCase.

**Tests:**
- [ ] After extraction, disconnect and reconnect -- card reappears with same table data
- [ ] state_sync includes extraction card with blocks as parsed JSON array
- [ ] Frontend correctly maps snake_case fields to camelCase

### Task: Add Markdown Rendering to Chat Messages

**Goal:** Agent messages render markdown formatting (headings, bold, code blocks, lists).
**Files:** Modify `frontend/components/desktop/chat-panel.tsx` (MessageBubble). Install `react-markdown` + `remark-gfm`. Possibly install `@tailwindcss/typography`.
**Depends on:** Smoke Test (Phase A gate)
**Priority:** P2

**Steps:**
1. Install deps: `cd frontend && npm install react-markdown remark-gfm`
2. Check if `@tailwindcss/typography` is installed. If not, install it and add to Tailwind config.
3. In `chat-panel.tsx` MessageBubble, replace `<p className="whitespace-pre-wrap">{message.content}</p>` with ReactMarkdown for agent messages (role !== 'user').
4. Wrap in `<div className="prose prose-invert prose-sm max-w-none">` for dark-theme styling.
5. Keep user messages as plain text (or optionally markdown too).
6. Verify code blocks render with monospace font and subtle background.

**Tests:**
- [ ] `**bold**` renders as bold text
- [ ] `# Heading` renders as a heading
- [ ] Triple-backtick code blocks render with monospace font
- [ ] `- list items` render as bullet lists
- [ ] No layout overflow in the chat panel

### Task: Add Welcome Message for New Users

**Goal:** New users receive an agent-generated greeting explaining what Stackdocs can do.
**Files:** Modify `sprite/src/gateway.py` (add welcome check after state_sync).
**Depends on:** Smoke Test (Phase A gate)
**Priority:** P2

**Steps:**
1. In `_handle_state_sync_request()`, after sending state_sync, check if chat history is empty: `chat_rows = await self._workspace_db.get_chat_history(limit=1)`
2. If empty and runtime is available, fire a background task: `asyncio.create_task(self._send_welcome_message())`
3. Implement `_send_welcome_message()`: pass a welcome context to `runtime.handle_message()` instructing the agent to greet the user and explain Stackdocs capabilities (2-3 sentences, no card creation).
4. Use `self.mission_lock` to prevent race with user messages.
5. Do NOT block state_sync waiting for the welcome.

**Tests:**
- [ ] New user (empty chat history) receives welcome message within 5 seconds
- [ ] Existing user (has chat history) does NOT receive welcome
- [ ] Welcome appears as a normal agent message in chat panel

### Task: Wire CSV and JSON Export from Table Cards

**Goal:** Users can download table card data as CSV or JSON files.
**Files:** Create `frontend/lib/export.ts`. Modify `frontend/components/desktop/cards/table-card.tsx` (add export buttons).
**Depends on:** Wire Table Card Rendering (soft -- can code against types)
**Priority:** P3

**Steps:**
1. Create `frontend/lib/export.ts` with `exportAsCSV(headers, rows, filename)` and `exportAsJSON(data, filename)` utility functions.
2. CSV: headers row + data rows, all values escaped (wrap in quotes, escape internal quotes).
3. JSON: `JSON.stringify({ headers, rows }, null, 2)`
4. Both use Blob + object URL + temporary anchor for download.
5. Add export buttons to TableCard (or card overlay). Buttons disabled when no data.
6. Sanitize filenames (no slashes, special chars).

**Tests:**
- [ ] CSV export produces valid CSV with headers and rows
- [ ] JSON export produces valid JSON with structured data
- [ ] Downloaded files have sensible filenames
- [ ] Buttons disabled/hidden when table has no data

### Task: UX Polish Pass on Extraction Flow

**Goal:** Polish loading states, error messages, and transitions during extraction.
**Files:** Modify `sprite/src/gateway.py` (error messages). Modify `frontend/components/desktop/block-renderer.tsx` (badge rendering). Modify `sprite/src/tools/extraction.py` (type_badge).
**Depends on:** Wire Table Card Rendering, Add Markdown Rendering
**Priority:** P3

**Steps:**
1. Verify "Processing..." badge animates (pulse or spinner). Add animation if static.
2. Make extraction failure error messages user-friendly (gateway.py line 302-306 sends raw exception). Wrap in readable message.
3. Add "Invoice" type badge to extraction cards for visual identification.
4. Verify badge variants render with correct colors: default (neutral), success (green), warning (yellow), destructive (red).
5. Ensure card transition from "Processing..." to extracted data is smooth (no layout jump).

**Tests:**
- [ ] Processing card shows animated indicator
- [ ] Failed extraction shows human-readable error (not Python traceback)
- [ ] Badge variants render with correct colors
- [ ] Card transition is smooth

## Sequence

**Wave 1:** Deploy API Keys (no dependencies)
**Wave 2:** Security Baseline + Fix Card Close (independent of each other, can be coded before Wave 1 deploys)
**Wave 3:** Install poppler-utils + End-to-End Smoke Test (smoke test is Phase A gate)

**--- Phase A Gate: Can a user sign up, chat, and see Canvas cards? ---**

**Wave 4:** Build Extraction Tool + Markdown Rendering + Welcome Message (all independent)
**Wave 5:** Wire Table Card Rendering + CSV/JSON Export (rendering depends on extraction tool)

**--- Phase B1 Gate: Can a user upload an invoice and see extracted data? ---**

**Wave 6:** Verify Extraction Persistence + UX Polish (verification + polish pass)

**--- Phase B2 Gate: Is the product demo-ready? ---**

**Critical path:** Tasks 1 → 5 → 6 → 7 → 8 (API keys → poppler → extraction → rendering → persistence)

**Recommended single-developer order:** 1 → 2 → 3 → 5 → 4 → 9 → 6 → 10 → 7 → 11 → 8 → 12

Rationale: Code tasks 2, 3, 5 before the smoke test (deploy together). Do markdown (9) before extraction (6) as a quick win. Welcome (10) after extraction since it can mention document processing. Export (11) and polish (12) are the tail.

## Estimated Time

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase A | 1-4 | 6-9 hours (1 day) |
| Phase B1 | 5-8 | 9-12 hours (1.5-2 days) |
| Phase B2 | 9-12 | 5-7 hours (1 day) |
| **Total** | 12 | **20-28 hours (~3-4 days)** |

Variance is dominated by Task 6 (extraction tool): prompt engineering and real-PDF testing can take 3-5 hours.

## Risks

1. **Task 6 (Extraction Tool):** Prompt engineering uncertainty. Invoice formats vary widely. Mitigation: start with one known invoice as golden test case, get it perfect before generalizing.
2. **Task 1 (API Keys):** Misconfigured secrets block everything. Mitigation: test each secret individually, have rollback commands ready.
3. **Task 5 (poppler-utils):** Lazy updater doesn't re-run apt-get. Existing Sprites need manual install or updater extension. Mitigation: manually install on test Sprite, add apt-get to updater for production.
4. **Task 10 (Welcome):** Open design question on trigger. Mitigation: use "empty chat history after state_sync" -- simple, reliable, testable.

## Success Criteria

- [ ] New user can sign up, connect, chat, and see agent response within 10 seconds
- [ ] Agent can create Canvas cards via tool calls
- [ ] No demo data visible in production
- [ ] User can upload a PDF invoice and see extracted fields in a table card within 60 seconds
- [ ] Extracted data persists across reconnection
- [ ] Chat renders markdown (headings, bold, code, lists)
- [ ] Users can export table data as CSV
- [ ] New users receive a welcome message
