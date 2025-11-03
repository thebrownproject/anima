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

## Session 2 - 2025-11-03 - Infrastructure & Database Setup ✅

**What was completed:**

- Created monorepo folder structure (`/backend`, `/frontend`)
- Set up Supabase project (stackdocs, Sydney region)
- Created environment variable templates and files
- Designed and implemented simplified database schema
- Applied initial migration to Supabase

**Important Decisions Made:**

1. **Simplified Database Schema (3 Tables):**

   - **`users`**: User profiles with integrated usage tracking (current month only)
   - **`documents`**: Uploaded file metadata and processing status
   - **`extractions`**: AI-extracted structured data (multiple per document)

   **Key simplifications:**
   - Merged `usage_tracking` into `users` table (MVP only needs current month)
   - Removed `is_latest` flag (use date sorting: `ORDER BY created_at DESC`)
   - Removed `processed_at`, `processing_time_ms`, `error_message` (not needed for MVP)
   - Kept `confidence_scores` for UX (show field confidence to users)

2. **Separate `public.users` Table:**
   - Links to `auth.users` via FK
   - Allows custom user fields (subscription, usage tracking)
   - Auto-created via trigger when user signs up
   - Better separation of concerns (auth vs app data)

3. **Date-Based Sorting for Latest Extraction:**
   - Simpler than managing `is_latest` boolean flag
   - Query: `SELECT * FROM extractions WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1`
   - Can add "pin extraction" feature later if users request it

4. **Environment Variables:**
   - Created `.env.example` templates (committed to git)
   - Created actual `.env` files (gitignored for security)
   - Backend: Supabase URL/key, Anthropic API key (placeholder for now)
   - Frontend: Public Supabase config, API URL

5. **Database Region Selection:**
   - Chose Sydney (`ap-southeast-2`) for lowest latency during development
   - Good enough global coverage for MVP
   - Can add edge functions/replicas later if needed

**Technical Implementation:**

1. **Monorepo Structure:**
   ```
   stackdocs-mvp/
   ├── backend/
   │   ├── migrations/
   │   │   └── 001_initial_schema.sql
   │   ├── .env (gitignored)
   │   └── .env.example
   ├── frontend/
   │   ├── .env.local (gitignored)
   │   └── .env.local.example
   └── planning/
       ├── PRD.md
       ├── ARCHITECTURE.md
       ├── SCHEMA.md (updated)
       ├── TASKS.md
       └── DEV-NOTES.md
   ```

2. **Database Schema (Final):**
   ```sql
   -- users: 7 columns (id, email, usage tracking, subscription)
   -- documents: 9 columns (id, user_id, file info, mode, status, timestamp)
   -- extractions: 9 columns (id, document_id, user_id, extracted_fields, confidence_scores, mode, custom_fields, timestamps)
   ```

3. **Row-Level Security:**
   - All tables have RLS enabled
   - Policies enforce `auth.uid() = user_id` (or `id` for users table)
   - Database-level security (impossible to bypass)

4. **Supabase Project Details:**
   - Project: stackdocs
   - Project ID: mhunycthasqrqctfgfkt
   - Region: ap-southeast-2 (Sydney)
   - PostgreSQL version: 17.6
   - Auth: Email/password enabled

**Learnings & Context:**

1. **PostgreSQL Reserved Keywords:**
   - `limit` is a reserved keyword - must be quoted as `"limit"`
   - Fixed in migration by using double quotes

2. **Schema Design Philosophy:**
   - Started with 4 tables (users, documents, extractions, usage_tracking)
   - Simplified to 3 tables after discussing with user
   - **Reasoning**: MVP only needs current month data, not historical analytics
   - Can always add `usage_history` table later if needed

3. **MCP Tool Usage:**
   - Used Supabase MCP to apply migrations directly
   - Verified tables and RLS policies created correctly
   - Much faster than manual SQL Editor workflow

**Files Created/Modified:**

- Created: `backend/migrations/001_initial_schema.sql`
- Created: `backend/.env.example`, `backend/.env`
- Created: `frontend/.env.local.example`, `frontend/.env.local`
- Created: `backend/README.md`, `frontend/README.md`
- Updated: `planning/SCHEMA.md` (complete rewrite to match simplified schema)
- Updated: `planning/TASKS.md` (marked completed tasks)

**Git Commits:**

1. `40250ff` - Create monorepo structure with backend and frontend folders
2. `e395db6` - Add environment variable template files
3. `bbf5ebc` - Mark Supabase and environment setup tasks as complete
4. `e4fd877` - Create simplified database schema with 3 tables
5. `4efefa4` - Update SCHEMA.md to reflect simplified 3-table design
6. `7b2b93f` - Mark database setup task as complete in TASKS.md

**Current Status:**

- Phase: Week 1, Day 1 - Infrastructure Setup
- Database: ✅ Complete (3 tables with RLS)
- Environment: ✅ Complete (template files created)
- Next Task: Set up Supabase Storage bucket for document uploads

**Blockers/Open Questions:**

1. **Anthropic API Key**: Placeholder in `.env` - user will add actual key later (considering OpenRouter as alternative)
2. **Deployment Platforms**: Skipped for now (Render/Railway setup can wait until Week 3)
3. **Supabase Storage**: Next task - create `documents` bucket with RLS policies

**Next Session:**

1. Set up Supabase Storage bucket (`documents`)
2. Configure storage RLS policies (users can only access their own files)
3. Start FastAPI project structure
4. Install dependencies (FastAPI, Supabase client, LangChain, Docling)

---
