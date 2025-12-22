# StackDocs Roadmap

**Last Updated:** 2025-12-22

---

## Current Focus

### In Progress

**Extraction Agent Frontend** (`plans/in-progress/extraction-agent/`)
- Backend: Complete (Claude Agent SDK integration, SSE streaming, session resume)
- Frontend: Pending (Phase 6-7)
- Enables: Real-time streaming of Claude's thinking, natural language corrections

**Auth Fixes** (`plans/in-progress/auth-fixes/`)
- Middleware route protection with Clerk
- Webhook handler for user sync to Supabase
- Sign-out redirect, cleanup redundant layout auth
- Enables: Complete Clerk auth flow with user data sync

### Todo

**Stacks Feature** (`plans/todo/stacks/`)
- Database: Ready (migrations 004 & 005 applied)
- Backend: Not started (depends on extraction agent patterns)
- Frontend: Not started (depends on extraction agent frontend)
- Enables: Group documents into stacks, extract tabular data with consistent schema

---

## Completed

**Clerk + Supabase Integration** (Dec 2025) ✅
- Database: All user_id columns changed to TEXT for Clerk IDs
- RLS: 8 policies using `auth.jwt()->>'sub'` for Clerk JWT
- Frontend: Clerk-authenticated Supabase clients (client + server + hook)
- Backend: FastAPI routes protected with Clerk auth dependency
- Enables: Secure multi-tenant data access with Clerk authentication

**OCR 3 Upgrade + Document Upload Endpoint** (Dec 2025) ✅
- Upgraded from Mistral OCR 2 to OCR 3 (`mistral-ocr-latest`)
- New `POST /api/document/upload` endpoint (sync upload + OCR)
- New `POST /api/document/retry-ocr` endpoint (retry failed OCR)
- Deleted deprecated `/api/process` and `/api/re-extract`
- HTML tables stored in `ocr_results.html_tables` for document preview

**Service Test Endpoints** (Dec 2025) ✅
- `GET /api/test/claude` - Test Claude Agent SDK connectivity
- `GET /api/test/mistral` - Test Mistral OCR API connectivity

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

**Next.js Frontend Foundation** (Dec 2025) ✅
- Next.js 16 + shadcn/ui (new-york style, sidebar-08)
- Clerk authentication with modal sign-in/sign-up
- Supabase client configured
- Route groups: `(app)/` for protected routes
- Sidebar navigation: Workspace (Documents, Extractions) + Stacks
- Placeholder pages ready for feature implementation

**Clerk shadcn Theme Integration** (Dec 2025) ✅
- Applied shadcn theme to all Clerk components (modals, UserButton)
- Replaced NavUser with Clerk UserButton in sidebar
- Enabled Waitlist mode for beta access control

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
