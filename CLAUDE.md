# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

---

## Project Overview

**StackDocs** is a document data extraction SaaS that uses AI to extract structured data from documents (invoices, receipts, contracts).

**Core Value:** Upload document → AI extracts structured data → Download CSV/JSON

**Target Audience:** SMBs eliminating manual data entry from documents

**Business Model:** Free tier (freemium) → Paid tiers ($50-100/month)

---

## Development Workflow

This project uses the **superpowers workflow** for planning and implementing features:

| Phase   | Skill                       | Output                                        |
| ------- | --------------------------- | --------------------------------------------- |
| Design  | `/superpowers:brainstorm`   | Design doc with requirements and architecture |
| Plan    | `/superpowers:write-plan`   | Task-by-task implementation plan              |
| Execute | `/superpowers:execute-plan` | Working code with review checkpoints          |

**Plan storage:** `docs/plans/` with kanban structure:

- `todo/` - Designed, ready to implement
- `in-progress/` - Currently being worked on
- `complete/` - Done

**Session Commands:**

| Command | When to Use |
|---------|-------------|
| `/continue` | Start of session - loads context, waits for direction |
| `/wrap-up` | End of session - updates plans, DEV-NOTES, commits |
| `/handover-prompt` | Mid-session handover - creates prompt for next session |

**MCP Tools Guide:**

- **context7** - Fetch current library docs before writing code. Spawn agent to retrieve and report back for large docs (prevents context rot).
- **perplexity** - Verify latest versions, APIs, and best practices before implementing (training data may be outdated).
- **supabase** - Direct database access. May be disconnected - ask user to activate if needed.
- **claude-in-chrome** - Browser automation for frontend testing and navigation.

**Reference Docs:**

| Doc                    | Purpose                                    |
| ---------------------- | ------------------------------------------ |
| `docs/ARCHITECTURE.md` | System design, data flows, API surface     |
| `docs/SCHEMA.md`       | Database tables, relationships, migrations |
| `docs/PRD.md`          | Product requirements, user stories         |
| `docs/ROADMAP.md`      | Feature priorities                         |
| `docs/DEV-NOTES.md`    | Session history & decisions (NEVER read full - grep for context) |
| `docs/CLAUDE.md`       | Planning index, workflow details           |

---

## Tech Stack

| Component  | Technology                                      |
| ---------- | ----------------------------------------------- |
| Frontend   | Next.js 16 + TypeScript + Tailwind              |
| Backend    | FastAPI (Python 3.11+)                          |
| Database   | Supabase PostgreSQL                             |
| Storage    | Supabase Storage                                |
| Auth       | Clerk (not yet integrated)                      |
| OCR        | Mistral OCR API                                 |
| Extraction | Claude Agent SDK (migrating from Anthropic SDK) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
├─────────────────────────────────────────────────────────────┤
│  Supabase Client (Direct)     │    FastAPI (AI Only)        │
│  ─────────────────────────    │    ──────────────────       │
│  • Auth (login/signup)        │    • POST /api/document/*   │
│  • Read documents             │    • POST /api/stack/*      │
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

See `docs/ARCHITECTURE.md` for detailed system design.

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

**Auth:** Clerk (not yet integrated)

**Test Users:**

- `test1@stackdocs.com` / `password123`
- `test2@stackdocs.com` / `password123`

**DO NOT** create tables/buckets - they already exist.

See `docs/SCHEMA.md` for complete database schema.

---

## Agents (in progress)

Built with Claude Agent SDK using custom database tools. Defined in `backend/app/agents/`.

Agents operate autonomously using a full agentic workflow (like Claude Code):

1. **User gives task** → "Extract data from this document"
2. **Agent reads data** → Uses tools to fetch OCR text, current state
3. **Agent acts via tools** → Tools perform real DB operations
4. **Agent summarizes** → Tells user what was accomplished

---

**extraction_agent** - Single document extraction

Extracts structured data from a single document. Reads OCR text, determines what fields to extract (auto mode) or uses user-specified fields (custom mode), writes structured JSONB to the extractions table. Supports session resume for corrections/updates.

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   ocr_results   │  READ   │ extraction_agent│  WRITE  │   extractions   │
│                 │────────▶│                 │────────▶│                 │
│  (Mistral OCR)  │         │  (Claude SDK)   │         │  (structured)   │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

| Tool              | Table         | Purpose                       |
| ----------------- | ------------- | ----------------------------- |
| `read_ocr`        | `ocr_results` | Fetch OCR text for document   |
| `read_extraction` | `extractions` | Read current extraction JSONB |
| `save_extraction` | `extractions` | Write full extraction         |
| `set_field`       | `extractions` | Update value at JSON path     |
| `delete_field`    | `extractions` | Remove field at JSON path     |
| `complete`        | `documents`   | Mark extraction complete      |

---

**stack_agent** - Multi-document batch extraction

Extracts structured data across multiple documents into a unified table. Reads all documents in a stack, creates/manages table schema, extracts one row per document. Enables cross-document analysis (e.g., all invoices from a vendor).

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ stack_documents │  READ   │   stack_agent   │  WRITE  │  stack_tables   │
│ + ocr_results   │────────▶│                 │────────▶│ stack_table_rows│
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

| Tool               | Table                       | Purpose                        |
| ------------------ | --------------------------- | ------------------------------ |
| `read_documents`   | `stack_documents`           | List documents in stack        |
| `read_ocr`         | `ocr_results`               | Fetch OCR text for document    |
| `read_tables`      | `stack_tables`              | Read table definitions         |
| `create_table`     | `stack_tables`              | Create new table               |
| `add_column`       | `stack_tables.columns`      | Add column to table            |
| `set_column`       | `stack_tables.columns`      | Modify column definition       |
| `delete_column`    | `stack_tables.columns`      | Remove column from table       |
| `read_rows`        | `stack_table_rows`          | Read existing rows             |
| `create_row`       | `stack_table_rows`          | Insert new row                 |
| `set_row_field`    | `stack_table_rows.row_data` | Update value at JSON path      |
| `delete_row_field` | `stack_table_rows.row_data` | Remove field at JSON path      |
| `complete`         | `stack_tables`              | Mark stack extraction complete |

---

## API Endpoints

Routes defined in `backend/app/routes/`. Endpoints trigger agents with scoped context (user_id, document_id).

### Current Endpoints (to be deprecated)

These endpoints exist and work, but will be replaced by the proposed endpoints below.

| Endpoint                  | Purpose                             | Status     |
| ------------------------- | ----------------------------------- | ---------- |
| `GET /health`             | Health check                        | Keep       |
| `POST /api/process`       | Upload + OCR + extract (background) | Deprecated |
| `POST /api/re-extract`    | Re-extract from cached OCR          | Deprecated |
| `POST /api/agent/extract` | Extract with SSE streaming          | Deprecated |
| `POST /api/agent/correct` | Correct via session resume          | Deprecated |
| `GET /api/agent/health`   | Agent health check                  | Deprecated |

### Proposed Endpoints (aligned with agents)

New endpoint structure matching extraction_agent and stack_agent.

| Endpoint                     | Purpose                                  | Agent            |
| ---------------------------- | ---------------------------------------- | ---------------- |
| `GET /health`                | Health check                             | -                |
| `POST /api/document/upload`  | Upload file + run OCR (background)       | -                |
| `POST /api/document/extract` | Trigger extraction_agent (SSE streaming) | extraction_agent |
| `POST /api/document/update`  | Update extraction via session resume     | extraction_agent |
| `POST /api/stack/extract`    | Trigger stack_agent (SSE streaming)      | stack_agent      |
| `POST /api/stack/update`     | Update stack extraction via session      | stack_agent      |

**Frontend uses Supabase directly for:** reading documents/extractions, editing fields, usage stats, auth.

---

## Frontend (planned)

Next.js 16 (App Router) + TypeScript + Tailwind. Uses Supabase directly for data, calls backend API for agent operations.

**URL:** `www.stackdocs.io` (Vercel)

**UI Stack:**

- shadcn/ui - Tailwind-native components (Button, Card, Badge, Dialog, etc.)
- TanStack Table - Headless data table with sorting, filtering, dynamic columns

**Key Features:**

- Real-time agent streaming via SSE (see AI thinking as it extracts)
- Dynamic columns generated from extraction schema
- Inline expansion for nested data (arrays, objects)
- AI-first editing - corrections via natural language, not manual forms

**Data Flow:**

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│    Frontend     │  SSE    │  FastAPI        │  Tools  │    Supabase     │
│  www.stackdocs  │────────▶│ api.stackdocs   │────────▶│                 │
│  shadcn + React │◀────────│  (Agent SDK)    │◀────────│  (PostgreSQL)   │
└─────────────────┘ stream  └─────────────────┘         └─────────────────┘
        │                                                        ▲
        └────────────────── Direct reads/writes ─────────────────┘
```

---

## Environment Variables

**Backend `.env`:**

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_service_role_key
MISTRAL_API_KEY=your_mistral_key
ANTHROPIC_API_KEY=sk-ant-xxx
CLAUDE_MODEL=claude-haiku-4-5-latest
```

---

## Deployment

**Frontend:** Vercel

- URL: `www.stackdocs.io`
- CI/CD: Automatic on push to `main`

**Backend:** DigitalOcean Droplet (2GB, Sydney region)

- URL: `api.stackdocs.io`
- Reverse proxy: Caddy
- Container runs on port 8001 internally

**Backend CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`)

- Triggers on push to `main` when `backend/**` changes
- Builds Docker image → pushes to GitHub Container Registry (ghcr.io)

**Container Management:**

```bash
docker logs stackdocs-api -f    # View logs
docker restart stackdocs-api    # Restart
docker ps | grep stackdocs      # Check status
```

---

## Code Principles

**KISS:** Keep it simple. Use FastAPI BackgroundTasks, JSONB for flexibility, direct API calls.

**YAGNI:** Don't build features not in current task. Ask before adding "helpful" extras.

**DRY:** Reuse OCR caching logic, shared error handling, common patterns.

---

## Key Reminders

1. **Frontend uses Supabase directly** - No FastAPI endpoints for reading data
2. **OCR is cached** - Re-extraction uses cached text (saves API costs)
3. **Usage limits** - Check before upload, increment after success
4. **Status updates** - Via Supabase Realtime, not polling
5. **Ask before adding** - No extra features without explicit request
