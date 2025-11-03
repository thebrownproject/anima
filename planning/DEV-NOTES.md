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

## Session 3 - 2025-11-03 - Storage & Documentation Updates ✅

**Week**: Week 1 - Infrastructure Setup
**Phase**: Database & Storage Configuration
**Branch**: main

### Tasks Completed

- [x] Documented bucket-level file validation approach
  - Updated TASKS.md to clarify validation is bucket-enforced (10MB, PDF/JPG/PNG)
  - Updated SCHEMA.md column descriptions for file_size_bytes and mime_type
  - Added comprehensive Supabase Storage Configuration section to ARCHITECTURE.md
  - Removed duplicate storage section from ARCHITECTURE.md

- [x] Set up Supabase Storage bucket
  - Created `documents` bucket with 10MB file size limit
  - Configured allowed MIME types (PDF, JPG, PNG) at bucket level
  - Created RLS policies for storage.objects table (SELECT, INSERT, DELETE)
  - File path structure: `documents/{user_id}/{document_id}_{filename}`

- [x] Test RLS policies
  - Created two test users via MCP (User A, User B)
  - Uploaded test file to User A's folder
  - Verified User A can view their file, User B cannot (storage RLS)
  - Verified User A can view their documents, User B cannot (database RLS)
  - Cleaned up test data after verification

- [x] Verify usage tracking trigger
  - Confirmed trigger `on_auth_user_created` exists and is active
  - Tested trigger creates public.users record automatically
  - Verified default values (free tier, 5 docs limit, usage reset date)
  - Trigger already implemented in 001_initial_schema.sql

### Decisions Made

1. **Bucket-Level Validation Strategy:**
   - File size (10MB) and MIME type restrictions enforced at bucket level
   - **Reasoning**: Defense in depth, simpler application code, clearer error messages
   - **Impact**: FastAPI upload endpoint doesn't need validation logic

2. **Storage RLS Policy Pattern:**
   - Uses `(storage.foldername(name))[1] = auth.uid()::text` to enforce folder-based access
   - Folder structure embeds user_id: `documents/{user_id}/...`
   - Policies applied for SELECT, INSERT, DELETE (UPDATE not allowed - files immutable)

3. **Documentation Updates:**
   - Consolidated storage configuration into single comprehensive section
   - Removed old duplicate section from ARCHITECTURE.md
   - Clarified that file_size_bytes/mime_type columns are for display/analytics, not validation

### Issues Encountered

1. **Test File Upload Path:**
   - Initial test file uploaded to bucket root (no folder structure)
   - **Solution**: Updated file path via SQL to move into user-specific folder
   - **Learning**: Supabase Storage UI doesn't enforce folder structure, must be done programmatically

2. **Usage Tracking Trigger Already Existed:**
   - Task asked to "set up" trigger, but it was already in initial migration
   - **Solution**: Verified trigger is working correctly, marked task complete
   - **Note**: Initial schema was well-designed to include all necessary triggers

### Technical Implementation

**Storage RLS Policies Created:**
```sql
-- SELECT: Users can view only their own files
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- INSERT: Users can upload only to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- DELETE: Users can delete only their own files
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**RLS Testing Results:**
- ✅ Storage: User A can view their files, User B cannot
- ✅ Database: User A can query their documents, User B cannot
- ✅ Cross-user access blocked at infrastructure level

### Files Modified

- `planning/TASKS.md` - Marked 3 tasks complete, updated validation notes
- `planning/SCHEMA.md` - Updated column descriptions (file_size_bytes, mime_type)
- `planning/ARCHITECTURE.md` - Added storage config section, removed duplicate

### Git Commits

1. `bf7bacb` - Document bucket-level file validation in planning docs
2. `77720e7` - Mark Supabase Storage bucket setup as complete
3. `03cd488` - Mark RLS policy testing as complete - all policies verified
4. `148d39c` - Mark usage tracking trigger as complete - already implemented in migration

### Current Status

**Week 1, Day 1 Infrastructure Setup: ✅ COMPLETE**

All infrastructure tasks finished:
- ✅ Supabase project (Sydney region)
- ✅ Database schema (3 tables with RLS)
- ✅ Storage bucket (10MB, PDF/JPG/PNG, RLS policies)
- ✅ RLS policies tested and verified
- ✅ Usage tracking trigger verified

**Ready for:** Week 1, Day 2-3 - Backend API Setup

### Next Session

**Task**: Initialize FastAPI project

**Subtasks:**
1. Create FastAPI project structure
2. Set up virtual environment
3. Install dependencies (FastAPI, Supabase, LangChain, Docling, Anthropic)
4. Create basic app structure (`app/main.py`, routes, services)
5. Test basic API endpoint

**Preparation needed:**
- None - infrastructure is ready
- Anthropic API key placeholder in `.env` (user will add actual key later)

---

## Session 4 - 2025-11-03 - FastAPI Backend Initialization ✅

**Week**: Week 1 - Infrastructure Setup
**Phase**: Backend API Setup (Day 2-3)
**Branch**: main

### Tasks Completed

- [x] Initialize FastAPI project with virtual environment
  - Created venv and installed all dependencies with pinned versions from PyPI
  - Installed: fastapi 0.120.2, uvicorn 0.38.0, pydantic 2.12.2, pydantic-settings 2.11.0, supabase 2.23.0, openai 2.6.1, langchain-openai 1.0.1, docling 2.60.0, python-dotenv 1.1.1, python-multipart 0.0.20

- [x] Create complete project structure
  - `app/main.py` - FastAPI app with CORS middleware and health check endpoint
  - `app/config.py` - Type-safe settings using Pydantic BaseSettings with .env loading
  - `app/database.py` - Supabase client setup with lru_cache
  - `app/models.py` - Pydantic response models (DocumentUploadResponse, ExtractionResponse, UsageResponse, HealthResponse)
  - `app/routes/` - documents.py, extractions.py, usage.py (placeholder structure)
  - `app/services/` - storage.py, extractor.py, usage.py (placeholder structure)
  - `requirements.txt` - All dependencies with exact versions

- [x] Configure FastAPI app with best practices
  - CORS middleware configured for frontend (localhost:3000)
  - Health check endpoint (`GET /health`) working and tested
  - Settings pattern using lru_cache for performance
  - Type-safe configuration with Pydantic v2 (SettingsConfigDict)

- [x] Update planning docs for OpenRouter
  - Updated CLAUDE.md LangChain integration examples
  - Updated ARCHITECTURE.md tech stack section
  - Updated .env.example with OpenRouter configuration

### Decisions Made

1. **OpenRouter instead of Anthropic Direct:**
   - **Reasoning**: Provides model flexibility - can use Claude, GPT-4, Gemini, or any other model
   - **Impact**: User can switch models via env variable without code changes
   - **Implementation**: Uses OpenAI SDK with custom base URL (https://openrouter.ai/api/v1)
   - Updated dependencies: `openai==2.6.1`, `langchain-openai==1.0.1` (instead of anthropic packages)

2. **Pydantic Settings Pattern:**
   - **Pattern**: BaseSettings class with SettingsConfigDict + lru_cache wrapper
   - **Benefits**: Type-safe config, auto .env loading, cached instance, validation at startup
   - **Type checker fixes**: Added `# pyright: ignore[reportCallIssue]` and `# pyright: ignore[reportUnannotatedClassAttribute]` for known Pydantic/basedpyright friction

3. **Project Structure:**
   - Follows FastAPI best practices: routes/ for endpoints, services/ for business logic
   - All imports use relative imports (`.config`, `.models`) for proper module resolution
   - Placeholder files with TODO comments for future implementation

4. **Documentation Before Code:**
   - Used `docs` agent to fetch FastAPI and Pydantic documentation before writing code
   - Followed latest Pydantic v2 patterns (SettingsConfigDict, not deprecated Config class)
   - Verified all patterns match current best practices

### Issues Encountered

1. **basedpyright Type Checker Strictness:**
   - **Issue**: Type checker errors on `Settings()` call (missing required args) and `model_config` annotation
   - **Root cause**: Static type checkers don't understand BaseSettings auto-loads from env vars
   - **Solution**: Added targeted `# pyright: ignore[...]` comments with specific rule names
   - **Learning**: basedpyright requires explicit rule names in ignore comments (can't use blanket `# type: ignore`)

2. **Import Resolution:**
   - **Issue**: IDE showed import errors initially (fastapi not found)
   - **Cause**: Packages not installed yet when files created
   - **Resolution**: Cleared after pip install completed

3. **User Interrupted Initial Config Write:**
   - **Context**: Started writing config.py before fetching docs
   - **Correction**: Stopped, fetched FastAPI/Pydantic docs first, then wrote code following best practices
   - **Learning**: Always use `docs` agent before writing code (as per workflow instructions)

### Technical Implementation

**Config Pattern (app/config.py):**
```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    OPENROUTER_API_KEY: str
    OPENROUTER_MODEL: str = "anthropic/claude-3.5-sonnet"
    # ... other fields

    model_config = SettingsConfigDict(  # pyright: ignore[reportUnannotatedClassAttribute]
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

@lru_cache()
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]
```

**FastAPI App (app/main.py):**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="StackDocs MVP", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "app_name": "StackDocs MVP"}
```

**Testing Results:**
- ✅ Server starts successfully with `uvicorn app.main:app`
- ✅ Health check endpoint tested via Swagger UI
- ✅ CORS headers properly configured
- ✅ All type errors resolved

### Files Created

- `backend/app/__init__.py`
- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/database.py`
- `backend/app/models.py`
- `backend/app/routes/__init__.py`
- `backend/app/routes/documents.py`
- `backend/app/routes/extractions.py`
- `backend/app/routes/usage.py`
- `backend/app/services/__init__.py`
- `backend/app/services/storage.py`
- `backend/app/services/extractor.py`
- `backend/app/services/usage.py`
- `backend/requirements.txt`

### Files Modified

- `backend/.env.example` - Updated for OpenRouter configuration
- `planning/ARCHITECTURE.md` - Updated LangChain examples and tech stack
- `planning/CLAUDE.md` - Updated LangChain integration patterns
- `planning/TASKS.md` - Marked completed tasks

### Git Commits

- Pending: Backend initialization commit (to be done in wrap-up)

### Current Status

**Week 1, Day 2-3 Backend API Setup: ✅ COMPLETE**

All backend initialization tasks finished:
- ✅ FastAPI project initialized with latest dependencies
- ✅ Project structure created following best practices
- ✅ Supabase client configured
- ✅ CORS middleware configured
- ✅ Health check endpoint working
- ✅ Type-safe configuration pattern implemented
- ✅ Server tested and verified working

**Ready for:** Week 1, Day 2-3 (continued) - Implement API endpoint logic

### Next Session

**Task**: Implement document upload endpoint

**Subtasks:**
1. Implement file upload validation (size, MIME type)
2. Add Supabase Storage upload logic in `services/storage.py`
3. Create document database record in `documents` table
4. Return document_id and trigger background extraction
5. Test upload flow end-to-end

**Preparation needed:**
- Ensure `.env` file has valid Supabase credentials
- Ensure OpenRouter API key is set (for future extraction testing)
- Have a test PDF/image ready for upload testing

**Technical context:**
- File validation should match bucket config (10MB max, PDF/JPG/PNG only)
- Use `UploadFile` type from FastAPI (requires python-multipart)
- File path structure: `documents/{user_id}/{document_id}_{filename}`
- Background extraction will be implemented in later session

---

## Session 5 - 2025-11-03 - Document Upload Implementation ✅

**Week**: Week 1 - Infrastructure Setup
**Phase**: Backend API Setup (Day 4)
**Branch**: main

### Tasks Completed

- [x] Implement Supabase Storage service (services/storage.py)
  - Created upload_document(), download_document(), create_signed_url(), delete_document()
  - Verified against official Supabase Python docs
  - Used proper named parameters (path=, file=, file_options=)
  - All functions use exception-based error handling

- [x] Implement usage tracking service (services/usage.py)
  - Created check_usage_limit(), increment_usage(), reset_usage(), get_usage_stats()
  - Reads from users table (documents_processed_this_month, documents_limit)
  - Auto-resets monthly counter when usage_reset_date passes
  - Returns 403 when limit exceeded

- [x] Implement POST /api/upload endpoint (routes/documents.py)
  - Accepts multipart/form-data (file, mode, user_id)
  - Full flow: check limit → upload storage → create DB record → increment usage
  - Returns DocumentUploadResponse with document_id and status
  - Integrated with Pydantic models for type safety

- [x] Test upload flow end-to-end
  - Tested via Swagger UI (http://localhost:8000/docs)
  - Uploaded 2 test PDFs successfully
  - Verified files in Supabase Storage bucket
  - Confirmed document records in database
  - Validated usage counter increments (0 → 1 → 2)

- [x] Fix all type checking errors
  - Resolved basedpyright reportExplicitAny warnings (replaced Any with specific types)
  - Fixed reportCallInDefaultInitializer for FastAPI File()/Form() params
  - Added cast() for dict values to satisfy strict type checking
  - All files pass type checking with zero errors

- [x] Update CLAUDE.md with infrastructure status
  - Added "Supabase Infrastructure Setup Status" section
  - Documented all 3 test users with IDs and passwords
  - Clarified database, storage, and auth are fully configured
  - Updated project status from "planning phase" to "in progress"

### Decisions Made

1. **Official Supabase Docs Verification:**
   - Used Supabase MCP search_docs to fetch official Python client patterns
   - Corrected storage.upload() to use named parameters (path=, file=, file_options=)
   - Confirmed exception-based error handling (not dict error checking)
   - Pattern: `supabase.storage.from_("bucket").upload(path=..., file=..., file_options={...})`

2. **Type Safety with UserData Alias:**
   - Created `UserData = dict[str, str | int | bool | None]` type alias
   - Avoided `Any` type to satisfy basedpyright's reportExplicitAny
   - Used cast() for database response data to provide type hints
   - Pattern ensures type safety without suppressing checks

3. **Service Layer Returns Plain Dicts:**
   - storage.py returns dict[str, str | int] (not Pydantic models)
   - Allows flexibility - API layer transforms to Pydantic models
   - Separation: services handle business logic, routes handle HTTP
   - Pattern: `upload_result = await upload_document()` → transform → `DocumentUploadResponse(...)`

4. **Test Users for MVP:**
   - Created 3 test users in auth.users and public.users
   - Supabase trigger auto-creates public.users record when auth user created
   - All have free tier limits (5 docs/month, 0 processed)
   - IDs documented in CLAUDE.md for future sessions

### Issues Encountered

1. **Initial Supabase Setup Confusion:**
   - **Issue**: Agent didn't realize database/storage/auth already existed
   - **Cause**: CLAUDE.md didn't clearly state infrastructure status
   - **Resolution**: Added prominent "Supabase Infrastructure Setup Status" section
   - **Learning**: Always document what's already configured to prevent wasted time

2. **Type Checker Strictness (basedpyright):**
   - **Issue**: Strict mode disallows `Any`, flags FastAPI patterns as errors
   - **Resolution**: Created type aliases (UserData, FieldValue), used cast()
   - **FastAPI params**: Added `# pyright: ignore[reportCallInDefaultInitializer]` for File()/Form()
   - **Learning**: basedpyright requires explicit types everywhere - use aliases for flexibility

3. **Supabase Client Method Naming:**
   - **Issue**: Called `get_supabase()` but function is `get_supabase_client()`
   - **Resolution**: Fixed all imports and calls
   - **Learning**: Check actual function names in codebase before writing code

4. **Storage Upload Parameter Format:**
   - **Issue**: Used positional args, but docs show named parameters
   - **Resolution**: Changed to `upload(path=..., file=..., file_options=...)`
   - **Learning**: Always verify against official docs, not assumptions

### Technical Implementation

**Storage Service Pattern:**
```python
# Clean, exception-based pattern
async def upload_document(user_id: str, file: UploadFile) -> dict[str, str | int]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    try:
        supabase = get_supabase_client()
        _ = supabase.storage.from_("documents").upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": mime_type, "cache-control": "3600"},
        )
        return {"document_id": document_id, "file_path": file_path, ...}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
```

**Usage Tracking Pattern:**
```python
# Type-safe database queries with cast()
async def check_usage_limit(user_id: str) -> bool:
    response = supabase.table("users").select("*").eq("id", user_id).execute()
    user = cast(UserData, response.data[0])
    
    # Auto-reset if needed
    if datetime.now() >= usage_reset_date:
        _ = await reset_usage(user_id)
        return True
    
    return cast(int, user["documents_processed_this_month"]) < cast(int, user["documents_limit"])
```

**Upload Endpoint Pattern:**
```python
# Full integration: storage + database + usage
@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document_endpoint(
    file: UploadFile = File(...),  # pyright: ignore
    mode: str = Form(...),  # pyright: ignore
    user_id: str = Form(...),  # pyright: ignore
) -> DocumentUploadResponse:
    # Check limit FIRST
    if not await check_usage_limit(user_id):
        raise HTTPException(status_code=403, detail="Upload limit reached")
    
    # Upload → Create record → Increment usage
    upload_result = await upload_document(user_id, file)
    _ = supabase.table("documents").insert(document_data).execute()
    _ = await increment_usage(user_id)
    
    return DocumentUploadResponse(...)
```

### Testing Results

**Upload Test 1:**
- File: Ubuntu Server CLI cheat sheet 2024 v6.pdf (189 KB)
- Document ID: 1b21d412-fe4b-4d58-bf23-efd1a8c302cc
- Status: processing
- Usage: 0 → 1 ✅

**Upload Test 2:**
- File: Fraser-Brown-FlowCV-Resume-20251026 (1).pdf (149 KB)
- Document ID: 751a466b-b2bb-4b94-946e-1d8c37c94ff8
- Status: processing
- Usage: 1 → 2 ✅

**Database Verification:**
- ✅ Files exist in Supabase Storage bucket 'documents'
- ✅ Document records created with correct metadata
- ✅ Usage counter increments properly
- ✅ File paths follow pattern: {user_id}/{document_id}_{filename}

### Files Created

- `backend/app/services/storage.py` - Supabase Storage operations
- `backend/app/services/usage.py` - Usage limit tracking and enforcement

### Files Modified

- `backend/app/routes/documents.py` - Added POST /api/upload endpoint
- `backend/app/main.py` - Registered documents router
- `backend/app/models.py` - Fixed type errors (removed Any, Optional deprecated syntax)
- `CLAUDE.md` - Added infrastructure status, updated project status
- `planning/TASKS.md` - Marked upload tasks complete
- `planning/DEV-NOTES.md` - This entry

### Git Commits

- Pending: Document upload implementation commit

### Current Status

**Week 1, Day 4 File Upload: ✅ COMPLETE**

All file upload functionality working:
- ✅ Supabase Storage integration
- ✅ Usage limit enforcement
- ✅ Document upload endpoint
- ✅ Database record creation
- ✅ End-to-end testing verified
- ✅ Type safety (zero basedpyright errors)
- ✅ Code matches official Supabase docs

**Ready for:** Week 1, Day 5 - Docling OCR Integration

### Next Session

**Task**: Implement Docling OCR integration

**Subtasks:**
1. Install Docling and verify dependencies (Poppler, etc.)
2. Create extract_text_from_document() in services/ocr.py
3. Test OCR extraction with sample PDFs
4. Handle multi-page documents and layout preservation

**Preparation needed:**
- Docling may require system dependencies (Poppler for PDF)
- Have test documents ready (PDFs with text, tables, mixed content)
- Research Docling export formats (markdown, JSON, etc.)

**Technical context:**
- Docling runs in same FastAPI process (monolith architecture)
- Extract to markdown format for LLM processing
- Background task will call OCR → LLM extraction pipeline
- Store extracted text temporarily for LangChain processing

---

