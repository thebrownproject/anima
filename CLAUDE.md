# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

---

## Project Overview

**Stackdocs** is a document data extraction SaaS that uses AI to extract structured data from documents (invoices, receipts, contracts).

**Core Value:** Upload document → AI extracts structured data → Download CSV/JSON

**Target Audience:** SMBs eliminating manual data entry from documents

**Business Model:** Free tier (freemium) → Paid tiers ($50-100/month)

---

## Development Workflow

This project uses the **Space-Agents workflow** for planning and implementing features:

| Phase   | Skill                  | Output                                        |
| ------- | ---------------------- | --------------------------------------------- |
| Explore | `/exploration`         | Brainstorm, debug, plan, or review modes      |
| Plan    | `/exploration-plan`    | Task-by-task implementation plan in Beads     |
| Execute | `/mission`             | Working code with Worker/Inspector/Analyst    |

**Plan storage:** Plans are now created directly in Beads via `/exploration-plan`. Use `bd list` and `bd ready` to view tasks.

> **Legacy plans:** Archived at `docs/archive/plans/` (read-only reference)

**Session Commands:**

| Command   | When to Use |
|-----------|-------------|
| `/launch` | Start of session - loads context, displays project status |
| `/land`   | End of session - syncs CAPCOM and Beads, commits |
| `/capcom` | Check mission status and progress |

**MCP Tools Guide:**

- **context7** - Fetch current library docs before writing code
- **perplexity** - Verify latest versions, APIs, and best practices
- **supabase** - Direct database access (ask user to activate if disconnected)

**Reference Docs:**

| Doc                          | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| `docs/specs/ARCHITECTURE.md` | System design, data flows, API surface     |
| `docs/specs/SCHEMA.md`       | Database tables, relationships, migrations |
| `docs/specs/PRD.md`          | Product requirements, user stories         |
| `docs/archive/plans/roadmap/`| Legacy roadmap (archived)                  |
| `.space-agents/comms/capcom.md` | Session history (CAPCOM - grep for context) |
| `docs/CLAUDE.md`             | Planning index, workflow details           |
| Beads                        | Issue tracking - use `bd list`, `bd show`, etc. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
├─────────────────────────────────────────────────────────────┤
│  Supabase Client (Direct)     │    FastAPI (AI Only)        │
│  ─────────────────────────    │    ──────────────────       │
│  • Auth (login/signup)        │    • POST /api/document/*   │
│  • Read documents             │    • POST /api/agent/*      │
│  • Read extractions           │                             │
│  • Edit extractions           │                             │
│  • Realtime subscriptions     │                             │
└───────────────┬───────────────┴─────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────────┐  ┌─────────────────────────┐
│      Supabase Platform        │  │   FastAPI Backend       │
│  • PostgreSQL (RLS enforced)  │  │  • Mistral OCR API      │
│  • Storage (documents)        │  │  • Claude Agent SDK     │
│  • Auth (JWT tokens)          │  │  • Background tasks     │
│  • Realtime (status updates)  │  └─────────────────────────┘
└───────────────────────────────┘
```

---

## Frontend

Next.js 16 (App Router) with Clerk auth and shadcn/ui components. Uses Supabase directly for data reads/writes, calls FastAPI only for AI operations.

```
frontend/
├── app/(app)/          # Protected routes with @header parallel slots
├── components/         # shadcn/ui + feature components
└── lib/                # Supabase clients, queries
```

See `frontend/CLAUDE.md` for patterns and directory structure.

---

## Backend

FastAPI with Claude Agent SDK for AI extraction. Agents use custom tools to read OCR text and write structured data to Supabase.

```
backend/
├── app/routes/         # API endpoints (document, agent, test)
├── app/services/       # OCR, storage, usage
└── app/agents/         # extraction_agent, stack_agent
```

See `backend/CLAUDE.md` for agents, endpoints, and deployment.

---

## Supabase Setup

**Project:** `stackdocs` (ID: `mhunycthasqrqctfgfkt`, Region: ap-southeast-2)

**Tables (all with RLS):**

| Table              | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `users`            | User profiles + usage tracking             |
| `documents`        | Uploaded file metadata + processing status |
| `ocr_results`      | Cached OCR text from Mistral               |
| `extractions`      | AI-extracted structured data for documents |
| `stacks`           | Document groupings for batch extraction    |
| `stack_documents`  | Links documents to stacks (many-to-many)   |
| `stack_tables`     | Table definitions within stacks            |
| `stack_table_rows` | Extracted row data for stack tables        |

**Storage:** `documents` bucket (private, signed URLs)

**DO NOT** create tables/buckets - they already exist.

See `docs/specs/SCHEMA.md` for complete database schema.

---

## Deployment

| Component | URL | Host |
|-----------|-----|------|
| Frontend  | `www.stackdocs.io` | Vercel |
| Backend   | `api.stackdocs.io` | DigitalOcean |

See `backend/CLAUDE.md` for deployment details and commands.

---

## Code Principles

**KISS:** Keep it simple. Use FastAPI BackgroundTasks, JSONB for flexibility, direct API calls.

**YAGNI:** Don't build features not in current task. Ask before adding "helpful" extras.

**DRY:** Reuse OCR caching logic, shared error handling, common patterns.

**Understand before solving:** Always examine the existing structure before proposing workarounds. Check where components are rendered, what CSS/props already exist, and what the parent hierarchy provides. The simplest fix is often already enabled by the existing architecture.

---

## Key Reminders

1. **Frontend uses Supabase directly** - No FastAPI endpoints for reading data
2. **OCR is cached** - Re-extraction uses cached text (saves API costs)
3. **Usage limits** - Check before upload, increment after success
4. **Status updates** - Via Supabase Realtime, not polling
5. **Ask before adding** - No extra features without explicit request
