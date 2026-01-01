# Stackdocs Roadmap

**Last Updated:** 2025-01-01

---

## Current Focus

### In Progress

**Agent UI Refactor** (`plans/in-progress/agent-ui-refactor/`) - 🔄 Phase 3 Complete, Phase 4 Next
- Design: Complete (Dynamic Island-style agent bar + popup)
- Implementation Plan: 4 phases (foundation, upload-flow, integration, cleanup)
- **Phase 1 Complete**: Zustand store, AgentBar, AgentActions, AgentPopup, AgentContainer
- **Phase 2 Complete**: UploadFlow, step components (dropzone, configure, fields, extracting, complete), close confirmation
- **Phase 3 Complete**: Root layout integration, upload button routing, E2E testing passed
- Next: Phase 4 (Cleanup - delete old upload-dialog and ai-chat-bar components)

**Stacks UI** (`plans/in-progress/stacks/`) - ⏸️ Paused
- Design: Complete (v2)
- Implementation Plan: 3 phases (foundation, pages, tables)
- Database: Ready (migrations 004 & 005 applied)
- Frontend: Phases 1-2 complete, Phase 3 partial
- Remaining: "Not extracted" indicator, CSV export (deferred until Stack Agent built)
- Status: Paused while Agent UI Refactor is prioritized

### Todo

| Feature | Location | Description |
|---------|----------|-------------|
| Stack Agent | `plans/todo/stack-agent/` | Extraction agent, SSE routes, tools |
| Backend Hardening | `plans/todo/backend-hardening/` | Security headers, rate limiting, logging |

---

## Completed

| Feature | Date | Summary |
|---------|------|---------|
| Header Filters | Dec 2025 | Filter controls in sub-bar (ExpandableSearch, FilterButton) |
| Upload Dialog | Dec 2025 | Multi-step wizard with extraction config, file upload, field customization |
| Sub-bar Toolbar | Dec 2025 | Linear-style sub-bar with filter, search, row selection, bulk actions |
| Frontend Cleanup | Dec 2025 | Tabler icon barrel, component reorganization, tooltips throughout UI |
| Unified Preview State | Dec 2025 | Shared preview panel state, localStorage persistence, context-aware loading skeletons |
| Layout Alignment System | Dec 2025 | Linear-inspired grid, icon-only toggles, floating chat bar, loading skeletons |
| Vercel Deployment | Dec 2025 | Frontend deployed to Vercel, Clerk webhook configured |
| Linear-style Preview Sidebar | Dec 2025 | Document preview panel with Linear-inspired design |
| Extraction Agent | Dec 2025 | Claude Agent SDK with SSE streaming, session resume, AI chat bar |
| Realtime Updates | Dec 2025 | Supabase realtime subscriptions, TanStack Table with expanding rows |
| Documents Page | Dec 2025 | Document list/detail views, PDF preview, AI corrections |
| Issues Tracking | Dec 2025 | Lightweight issue tracking in ISSUES.md |
| Auth Fixes | Dec 2025 | Clerk middleware protection, webhook user sync |
| Clerk + Supabase Integration | Dec 2025 | RLS policies with Clerk JWT, authenticated clients |
| OCR 3 Upgrade | Dec 2025 | Mistral OCR 3, document upload/retry endpoints |
| Service Test Endpoints | Dec 2025 | Claude and Mistral API connectivity tests |
| Next.js Frontend Foundation | Dec 2025 | Next.js 16 + shadcn/ui + Clerk auth |
| Clerk shadcn Theme | Dec 2025 | shadcn theme applied to Clerk components |
| Planning Reorganization | Dec 2025 | Kanban docs structure, superpowers workflow |
| Architecture Migration | Dec 2025 | LangChain to Anthropic SDK direct |
| Backend Core | Nov 2025 | FastAPI + Supabase + Mistral OCR + Claude extraction |

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
