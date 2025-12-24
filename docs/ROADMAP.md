# StackDocs Roadmap

**Last Updated:** 2025-12-24

---

## Current Focus

### In Progress

**Upload Dialog** (`plans/in-progress/upload-dialog/`)
- Design: Complete (multi-step wizard with extraction config)
- Plan: Complete (17 tasks across 3 phases, reviewed and sharded)
- Implementation: Complete (16/17 tasks, pending manual testing)
- Enables: Upload documents with extraction options (auto/custom fields)

**Vercel Deployment** (`plans/in-progress/vercel-deployment/`)
- Deploy frontend to Vercel with environment variables
- Configure Clerk webhook for production URL
- Test user sync to Supabase

**Extraction Agent Frontend** (`plans/in-progress/extraction-agent/`)
- Backend: Complete (Claude Agent SDK integration, SSE streaming, session resume)
- Frontend: Complete (AI chat bar with SSE streaming)
- Enables: Real-time streaming of Claude's thinking, natural language corrections

### Todo

**Stacks Feature** (`plans/todo/stacks/`)
- Database: Ready (migrations 004 & 005 applied)
- Backend: Not started (depends on extraction agent patterns)
- Frontend: Not started (depends on documents page)
- Enables: Group documents into stacks, extract tabular data with consistent schema

---

## Completed

**Realtime Updates & Table Redesign** (Dec 2025) ✅
- Supabase realtime subscription for extraction updates (auto-refresh when AI updates)
- TanStack Table with expanding rows for nested data
- Data shape detection (key-value, arrays, grouped arrays, object arrays)
- Token refresh to keep WebSocket alive (Clerk JWT expires every 60s)
- Known issue: Highlight animation not visible (see ISSUES.md #8)
- Enables: Live updates to extracted data without page refresh

**Documents Page** (Dec 2025) ✅
- Documents list with TanStack Table (sorting, filtering, pagination, selection)
- Document detail page with extracted data table and PDF/Visual preview
- AI chat bar with SSE streaming for natural language corrections
- Page header system with breadcrumbs and actions
- Enables: View/manage documents, see extracted data, ask AI to correct extractions

**Auth Fixes** (Dec 2025) ✅
- Edge middleware route protection with Clerk
- Webhook handler for user sync to Supabase (`/api/webhooks/clerk`)
- Sign-out redirect to homepage
- Removed redundant layout auth check
- Removed legacy unauthenticated Supabase client
- Enables: Complete Clerk auth flow with automatic user data sync

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
