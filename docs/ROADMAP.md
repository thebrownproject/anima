# StackDocs Roadmap

**Last Updated:** 2025-12-21

---

## Current Focus

### In Progress

**OCR 3 Upgrade + Document Upload Endpoint** (`plans/in-progress/ocr-3-upgrade/`)
- Upgrade from Mistral OCR 2 to OCR 3 (`mistral-ocr-2512`)
- New `POST /api/document/upload` endpoint (sync upload + OCR)
- Deprecate `/api/process` and `/api/re-extract`
- Store HTML tables for future document preview
- Enables: Better extraction accuracy, cleaner API separation, document preview

**Extraction Agent Frontend** (`plans/in-progress/extraction-agent/`)
- Backend: Complete (Claude Agent SDK integration, SSE streaming, session resume)
- Frontend: Pending (Phase 6-7)
- Enables: Real-time streaming of Claude's thinking, natural language corrections

### Todo

**Next.js Frontend Foundation** (`plans/todo/nextjs-frontend-foundation/`)
- Setup Next.js 16 + shadcn/ui (Nova style preset)
- Integrate Clerk authentication
- Integrate Supabase client
- Create sidebar navigation (Workspace: Documents/Extractions, Stacks)
- Enables: Foundation for all future frontend features

**Service Test Endpoints** (`plans/todo/service-test-endpoints/`)
- GET /api/test/claude - Minimal ping using Agent SDK
- GET /api/test/mistral - List models (free call)
- Enables: Swagger-friendly debugging of external service connectivity

**Stacks Feature** (`plans/todo/stacks/`)
- Database: Ready (migrations 004 & 005 applied)
- Backend: Not started (depends on extraction agent patterns)
- Frontend: Not started (depends on extraction agent frontend)
- Enables: Group documents into stacks, extract tabular data with consistent schema

---

## Completed

**Backend Core** (Nov 2025)
- FastAPI setup with Supabase integration
- Mistral OCR for text extraction
- Claude extraction (auto + custom modes)
- Background processing with status updates

**Architecture Migration** (Dec 2025)
- Migrated from LangChain to Anthropic SDK direct
- Reduced to 2 core endpoints (`/api/process`, `/api/re-extract`)
- Added Claude Agent SDK endpoints (`/api/agent/extract`, `/api/agent/correct`)

**Planning Reorganization** (Dec 2025)
- Consolidated docs into kanban structure
- Refactored plans to superpowers format
- Cleaned up archive

---

## Future Features (P1 - Post-MVP)

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Batch upload | Process multiple documents at once | Frontend |
| Saved templates | Reusable custom field configs | Frontend |
| Stripe integration | Paid tiers, usage limits | Frontend |
| CSV export improvements | Match Xero import specs | User feedback |
| Email forwarding | Forward invoices to auto-process | Infrastructure |

---

## Future Features (P2 - Later)

- Xero/QuickBooks integration
- API access for programmatic extraction
- Team accounts (shared document libraries)
- Webhook notifications

---

## Related Documentation

| Doc | Purpose |
|-----|---------|
| `PRD.md` | Product requirements |
| `ARCHITECTURE.md` | System design |
| `SCHEMA.md` | Database schema |
| `plans/` | Feature plans (kanban) |
