# Development Notes

A running diary of development decisions, important context, and session-to-session notes.

---

## Session Template (DO NOT REMOVE - Used by Claude Code)

```markdown
## Session [N] - YYYY-MM-DD - [Brief Description] [✅ if complete]

**Week**: [X - Name]
**Phase**: [Planning/Backend/Frontend/Launch]
**Branch**: [branch-name]

### Tasks Completed

- [x] [Description] - [Brief note on what was done]

### Tasks In Progress

- [~] [Description] - [Current status, what's left]

### Decisions Made

- [Key technical decisions, library choices, architecture choices]
- [Pattern decisions, API design choices]

### Issues Encountered

- [Any bugs, blockers, or challenges and how they were resolved]
- [Performance issues, dependency conflicts, etc.]

### Next Session

- Continue with: [Next task description]
- [Any preparation needed - e.g., "Ensure Supabase project is created", "Have API keys ready"]
```

---

## Session 1 - 2025-11-02 - Project Planning & Architecture ✅

**What was completed:**

- Created planning documents: `PRD.md`, `TASKS.md`, `ARCHITECTURE.md`, `SCHEMA.md`
- Defined MVP scope with two extraction modes (Auto + Custom)
- Established monolithic architecture pattern
- Created 4-week build plan with daily tasks

**Important Decisions Made:**

1. **Architecture Pattern - Monolithic FastAPI + Next.js:**

   - **Backend**: FastAPI with Docling bundled (OCR in same process)
   - **Frontend**: Next.js deployed on Vercel
   - **Database**: Supabase PostgreSQL + Storage
   - **AI**: LangChain + Claude 3.5 Sonnet for extraction
   - **Async Processing**: FastAPI BackgroundTasks (not Celery for MVP)

2. **Data Flow Patterns:**

   - **Upload**: Next.js → FastAPI → Supabase Storage → Create document record → Trigger BackgroundTask
   - **Extraction**: BackgroundTask → Docling OCR → LangChain + Claude → Save to extractions table
   - **Status**: Frontend polls `/api/extractions/{id}/status` every 2 seconds
   - **Download**: Frontend fetches from `/api/extractions/{id}/export?format=csv|json`

3. **Database Schema Design:**

   - **documents** table: File metadata, status tracking
   - **extractions** table: Multiple extractions per document, JSONB for flexibility
   - **usage_tracking** table: Monthly limits, tier enforcement
   - **Key decision**: `is_latest` flag on extractions for re-extraction support

4. **Two Extraction Modes:**

   - **Auto mode**: AI decides what fields to extract (flexible, exploratory)
   - **Custom mode**: User specifies field names (predictable, structured)
   - Custom fields flow: Frontend form → API → Database → BackgroundTask → LangChain prompt

5. **File Organization:**

   - All planning docs in `planning/` folder
   - Backend code will be in `backend/` (FastAPI)
   - Frontend code will be in `frontend/` (Next.js)
   - Database migrations in `backend/migrations/`

6. **MVP Scope (P0 Features):**
   - Two extraction modes (Auto + Custom)
   - Document library with grid view
   - Edit extraction results
   - CSV/JSON export
   - Re-extraction support
   - Usage limits (5 free docs/month)
   - Full auth from day 1 (Supabase)

7. **Explicitly Out of Scope:**
   - ❌ Batch upload (one document at a time)
   - ❌ Saved templates
   - ❌ Schema learning system (from spike)
   - ❌ Integrations (Xero, QuickBooks)
   - ❌ Team accounts

**Current Status:**

- Phase: Planning complete
- Next Task: Week 1 - Backend setup (FastAPI project, Supabase, Docling, LangChain)
- Reference spike validated at: `/Users/fraserbrown/Documents/Programming/portfolio/stackdocs/doc-extraction-spike/`

**Git Status:**

- No git repo initialized yet (will create in Week 1)

**Next Steps:**

1. Initialize FastAPI project with proper structure
2. Set up Supabase project (database + storage)
3. Integrate Docling for OCR
4. Set up LangChain + Claude for extraction
5. Create background task processing system

---
