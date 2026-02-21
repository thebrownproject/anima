# Exploration: Demo Readiness Roadmap

**Date:** 2026-02-21
**Status:** Ready for planning
**Reviewed by:** 2 external agents (Codex). Verdict: APPROVE WITH CHANGES. Changes applied.

## Problem

Two external code review agents (Codex) recommended enterprise infrastructure as the next priority: observability/SLOs, chaos testing, idempotency guarantees, canary deploys, protocol governance, and security hardening.

However, a codebase audit revealed that Stackdocs is much closer to a working demo than expected. The core product flows (auth, chat, Canvas, memory) are architecturally complete. The single biggest blocker is that API keys aren't deployed to Fly.io, meaning the agent literally can't respond to users.

The Codex recommendations optimize for production reliability at scale. Stackdocs has zero users and hasn't been turned on yet. The highest-leverage work is getting the product demoable, not layering infrastructure.

This spec defines the post-m7b.14 roadmap: three phases that take Stackdocs from "built but off" to "working and impressive."

## Solution

Four sequential phases after m7b.14 (Connection Stability) completes:

**Phase A: "Turn it on"** -- Deploy configuration, security baseline, remove dev scaffolding, smoke test end-to-end. Goal: a user can sign up, connect, and talk to the agent.

**Phase B1: "Core value prop"** -- Build the extraction pipeline and wire table rendering. Goal: a user can upload an invoice and see structured data in a table card.

**Phase B2: "Polish the experience"** -- Markdown chat, welcome flow, export, UX polish. Goal: the product feels finished, not prototyped.

**Phase C: "Make it impressive"** -- Cherry-picked engineering quality items that serve both portfolio and product. Goal: the codebase demonstrates professional engineering practices.

Codex-suggested infrastructure (deployment maturity, chaos testing, data lifecycle) defers to Phase D+ when real users are imminent.

## Requirements

### Phase A: Turn It On (target: 1 day)

**Deployment preflight (all secrets verified before proceeding):**
- [ ] Verify/set `ANTHROPIC_API_KEY` on Fly.io Bridge
- [ ] Verify/set `MISTRAL_API_KEY` on Fly.io Bridge
- [ ] Verify/set `SPRITES_TOKEN` on Fly.io Bridge (Sprites.dev API access)
- [ ] Verify/set `SPRITES_PROXY_TOKEN` on Fly.io Bridge (Sprite-to-Bridge auth)
- [ ] Verify/set `CLERK_SECRET_KEY` on Fly.io Bridge
- [ ] Verify/set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` on Fly.io Bridge
- [ ] Verify `BRIDGE_PUBLIC_URL` is set (used by provisioning env injection in `bridge/src/provisioning.ts:38`)
- [ ] Bridge startup validation: app boots, health endpoint responds, logs confirm secrets loaded
- [ ] Document rollback path: `flyctl secrets unset` + `flyctl deploy --image <previous>` commands ready

**Security baseline (minimum for any external access):**
- [ ] Verify proxy token validation is enforced on API proxy endpoints
- [ ] Verify request size limits are active (25MB frontend, 50MB Sprite TCP buffer)
- [ ] Audit for exposed debug/dev/prototype routes in production builds -- disable or gate any found
- [ ] Fail-fast on missing secrets: Bridge should refuse to start if required env vars are absent (not silently 503)
- [ ] Confirm no secrets are logged in Bridge stdout/stderr

**Scaffolding removal:**
- [ ] Remove hardcoded `DEMO_CARDS` seeding in `desktop/page.tsx` (or gate behind "no Sprite data" condition)
- [ ] Remove or disable any dev-only routes or prototype endpoints

**Bug fixes:**
- [ ] Fix card close button to send `canvas_interaction` with `archive_card` action to Sprite (optimistic UI removal, no wait for ack -- card reappears on next state_sync if archive fails)

**Validation:**
- [ ] End-to-end smoke test (manual): sign up, connect to Sprite, send chat message, receive response, create Canvas card, upload a document
- [ ] Scripted happy-path smoke test: auth, connect, chat round-trip, card create -- for repeatable regression checking

### Phase B1: Core Value Prop (target: 2 days)

**Extraction pipeline:**
- [ ] Install `poppler-utils` in Sprite bootstrap script (ensures `pdftotext` available)
- [ ] Build extraction tool: agent receives invoice, extracts fields using a guided extraction prompt (not free-form "summarize"), outputs structured data to table card
- [ ] Extraction uses a narrow invoice schema for v1 demo: vendor, date, line items (description, quantity, unit price, total), subtotal, tax, grand total
- [ ] Table card renders extracted data correctly with the existing `TableCard` template

**Persistence and state:**
- [ ] Extracted data persists to workspace.db via existing card storage
- [ ] Cards survive reconnection (state_sync restores them)

### Phase B2: Polish the Experience (target: 2-3 days)

- [ ] Add markdown rendering to chat messages (react-markdown or similar -- headings, bold, code blocks, lists)
- [ ] Add welcome message flow: new users get a greeting from the agent explaining what Stackdocs can do (trigger: TBD in planning)
- [ ] Wire CSV export from table cards (m7b.4.8)
- [ ] Wire JSON export from table cards (m7b.4.8)
- [ ] General UX polish pass on the extraction flow (loading states, error messages, card badges)

### Phase C: Make It Impressive (target: 1 week)

- [ ] Protocol codegen: TypeScript as source of truth (`bridge/src/protocol.ts`), generate Python dataclasses via build script. Migration path: run codegen, diff against existing `sprite/src/protocol.py`, replace once parity confirmed.
- [ ] Structured correlation logging: use existing `request_id` (already present in protocol messages across all three layers) to add structured log lines at key points (Bridge proxy, Sprite gateway, agent runtime). Wire into debug panel.
- [ ] Agent quality eval suite: golden dataset of 10-20 real invoices with expected extraction outputs, precision/recall scoring per field, regression gate on changes.

## Non-Requirements

- Not building observability dashboards, SLO error budgets, or alerting systems
- Not implementing chaos/soak testing or nightly CI harnesses
- Not adding canary/blue-green deployment pipelines
- Not building idempotency/dedup/ack semantics for messages
- Not implementing secret rotation strategy
- Not building formal DB migration/versioning tooling (SQLite on single-user VMs)
- Not creating one-command local development environment
- Not building cost/latency dashboards or token budgets
- Not doing a full security hardening pass (deferred to pre-public-access, but minimum baseline included in Phase A)

## Architecture

No runtime architecture changes in Phases A or B. The existing architecture (Vercel frontend, Fly.io Bridge, Sprites.dev VMs) supports the product flow end-to-end.

Phase C adds **build/tooling architecture** only: a codegen script in the build pipeline and an eval harness alongside the Sprite code.

**Phase A** is configuration, security baseline, and minor bug fixes.

**Phase B1** additions:
- Extraction tool: new tool in `sprite/src/tools/extraction.py` following existing tool factory pattern (scoped closures with `send_fn`, `workspace_db`, `stack_id_fn`)
- Bootstrap change: add `poppler-utils` to `bridge/src/bootstrap.ts` apt-get step

**Phase B2** additions:
- Markdown rendering: new dependency in frontend (`react-markdown` + `remark-gfm`)
- Welcome flow: triggered in `sprite/src/gateway.py` (trigger mechanism TBD in planning)
- Export: new functions in frontend for CSV/JSON generation from table card data

**Phase C** additions:
- Protocol codegen: build script (likely Node.js) that parses TS interfaces and emits Python dataclasses. Replaces manual `sprite/src/protocol.py` maintenance.
- Structured logging: additions to Bridge and Sprite log statements using existing `request_id`
- Eval suite: new `sprite/evals/` directory with golden documents and scoring scripts

## Constraints

- Must complete m7b.14 (Connection Stability) first. Phases A-C depend on stable WebSocket connections.
- API keys must be deployed before any end-to-end testing is possible (blocks all agent functionality).
- Sprite bootstrap changes require redeploying to existing Sprites (VERSION bump + lazy update).
- Protocol changes must update all three locations: `bridge/src/protocol.ts`, `sprite/src/protocol.py`, `frontend/types/ws-protocol.ts` (until Phase C codegen replaces this).
- Extraction tool should use a guided prompt with invoice schema, not free-form "summarize whatever you find." Agent still has autonomy in how it reads the document, but output structure is defined.
- Frontend additions should follow existing patterns: glass components, Zustand stores, shadcn/ui primitives.
- Phase C codegen migration must not break existing TS/Python parity during transition. Run codegen, diff, replace only when output matches.

## Success Criteria

**Phase A gate (must pass before B1 starts):**
- [ ] A new user can sign up, connect to a Sprite, send "hello", and receive an agent response within 10 seconds
- [ ] Agent can create a Canvas card via tool call and it renders correctly in the viewport
- [ ] No hardcoded demo data appears in production
- [ ] Scripted smoke test passes: auth, connect, chat, card create
- [ ] No secrets visible in Bridge logs
- [ ] Bridge refuses to start with missing required env vars

**Phase B1 gate (must pass before B2 starts):**
- [ ] User can upload a PDF invoice and see extracted fields (vendor, date, line items, totals) in a table card
- [ ] Extraction completes within 60 seconds for a standard 1-page invoice
- [ ] Extracted data persists across reconnection

**Phase B2 gate:**
- [ ] Chat messages render markdown correctly (headings, bold, code blocks, lists)
- [ ] User can export table card data as CSV
- [ ] New users receive a welcome message without prompting

**Phase C gate:**
- [ ] Protocol types are generated from TypeScript source (changing `protocol.ts` regenerates Python dataclasses)
- [ ] Any message can be traced across all three layers using existing `request_id` in structured logs
- [ ] Agent extraction quality scored against golden invoice dataset with defined pass threshold (e.g., 8/10 invoices extract correctly)

## Resolved Decisions

1. **Protocol codegen source**: TypeScript as source of truth. `bridge/src/protocol.ts` is already the documented authority. Generates Python dataclasses. Simpler toolchain, can add JSON Schema generation later if needed.

2. **Extraction approach**: Schema-guided for v1 demo, not free-form. Agent uses a defined invoice schema (vendor, date, line items, totals). Gives reliable, exportable output. Free-form can be added later for non-invoice documents.

3. **request_id**: Already exists across all three layers. Phase C is about structured logging and debug tooling using the existing field, not adding it.

4. **Card close behavior**: Optimistic UI removal. Frontend removes card immediately on close, sends `archive_card` to Sprite. If archive fails, card reappears on next `state_sync`.

## Open Questions

1. **Welcome message trigger**: On first-ever connection? On first connection with empty chat history? On every new stack creation? To be decided in Phase B2 planning.

2. **Eval dataset source**: Need 10-20 real invoices with expected outputs. Where do these come from? Public datasets, generated samples, or real documents?

3. **Eval pass threshold**: What constitutes "correct" extraction? Exact field match? Fuzzy match? Per-field scoring? To be defined when building the eval suite.

## Next Steps

1. Complete m7b.14 (Connection Stability) -- currently in progress, Wave 1 ready
2. `/plan` this spec to create implementation tasks for Phases A, B1, B2
3. Phase A still benefits from task tracking (deployment preflight is easy to miss steps on)
4. Phase B1 needs detailed task breakdown (extraction tool is the core engineering)
5. Phase C can be planned separately after B2 is validated
