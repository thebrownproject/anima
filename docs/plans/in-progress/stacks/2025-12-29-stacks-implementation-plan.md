# Stacks Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Stacks UI feature - pages and tables that mirror Documents, with Supabase direct queries.

**Scope:** Frontend only. Agent integration and chat bar redesign are separate features (see `docs/plans/todo/`).

**Architecture:**
- Frontend: Next.js 16 App Router with parallel routes, TanStack Table
- Database: Supabase direct (existing tables: stacks, stack_documents, stack_tables, stack_table_rows)

**Tech Stack:** Next.js 16, TanStack Table v8, Supabase JS, shadcn/ui

---

## Plan Structure

| File | Description |
|------|-------------|
| [01-foundation.md](./01-foundation.md) | Types, Supabase queries, sidebar integration |
| [02-stack-pages.md](./02-stack-pages.md) | Stacks list page, stack detail page with tabs |
| [03-stack-tables.md](./03-stack-tables.md) | Table view component, dynamic columns, CSV export |

---

## Implementation Order

### Phase 1: Foundation (01-foundation.md)
1. Type definitions for stacks
2. Supabase query functions
3. Sidebar integration with dynamic stacks

### Phase 2: Frontend Pages (02-stack-pages.md)
4. Stacks list page
5. Stack detail page with tabs
6. Header parallel routes (using existing PageHeader)

### Phase 3: Stack Table View (03-stack-tables.md)
7. StackTableView component with dynamic columns
8. "Not extracted" indicator for pending docs
9. CSV export functionality

---

## Future Work (separate plans)

| Feature | Location |
|---------|----------|
| Stack Agent (extraction, tools) | `docs/plans/todo/stack-agent/` |
| Agent UI Refactor (chat bar) | `docs/plans/todo/agent-ui-refactor/` |

---

## Success Criteria (MVP)

- [ ] Stacks appear in sidebar with document counts
- [ ] Stacks list page shows all stacks as cards
- [ ] Stack detail page has Documents tab and Table tabs
- [ ] Table view shows spreadsheet with document column
- [ ] Pending documents show "not extracted" indicator
- [ ] Export to CSV works
