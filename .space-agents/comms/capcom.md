# CAPCOM Master Log

*Append-only. Grep-only. Never read fully.*

---

## [2026-01-25 00:00] System Initialized

Space-Agents installed. HOUSTON standing by.

---
[2026-01-25 09:54:51] RALPH: Ralph loop starting
[2026-01-25 09:54:51] RALPH: Starting task: stackdocs-830.1 - Transform DEV-NOTES to CAPCOM

## [2025-01-01] Session 80: Agent UI Refactor Phase 3 Integration

**Completed:** Task 3.1: Add AgentContainer to root layout; Task 3.1.5: Add viewport-fit=cover; Task 3.2: Add Upload button to header
**Decisions:** Remove create-stack action: Removed until flow implemented; Popup width fix: Added `w-full` to container
**Next:** Complete E2E testing then Phase 4 Cleanup

---
## [2025-01-01] Session 81: Agent UI E2E Testing & Bug Fixes

**Completed:** Fix upload button routing; Fix ActionButton icon size; E2E Testing (comprehensive)
**Decisions:** Remove header Upload button: Deleted entirely; Keep ActionButton styling: Used same component for consistency
**Next:** Phase 4 Cleanup (delete old components)

---
## [2025-11-02] Session 1: Project Planning & Architecture (complete)

**Completed:** Created planning documents: `PRD.md`, `TASKS.md`, `ARCHITECTURE.md`, `SCHEMA.md`; Defined MVP scope with two extraction modes (Auto + Custom); Established monolithic architecture pattern
**Decisions:** Architecture Pattern - Monolithic FastAPI + Next.js:; Data Flow Patterns:; Database Schema Design:
**Next:** Initialize FastAPI project with proper structure

---
## [2025-11-03] Session 2: Infrastructure & Database Setup (complete)

**Completed:** Created monorepo folder structure (`/backend`, `/frontend`); Set up Supabase project (stackdocs, Sydney region); Created environment variable templates and files
**Decisions:** Simplified Database Schema (3 Tables):; Separate `public.users` Table:; Date-Based Sorting for Latest Extraction:
**Next:** Set up Supabase Storage bucket (`documents`)

---
## [2025-11-03] Session 3: Storage & Documentation Updates (complete)

**Completed:** Documented bucket-level file validation approach; Set up Supabase Storage bucket; Test RLS policies
**Decisions:** Bucket-Level Validation Strategy:; Reasoning; Impact
**Issues:** Test File Upload Path:; Solution
**Next:** Initialize FastAPI project

---
## [2025-11-03] Session 4: FastAPI Backend Initialization (complete)

**Completed:** Initialize FastAPI project with virtual environment; Create complete project structure; Configure FastAPI app with best practices
**Decisions:** OpenRouter instead of Anthropic Direct:; Reasoning; Impact
**Issues:** basedpyright Type Checker Strictness:; Issue
**Next:** Implement document upload endpoint

---
## [2025-11-03] Session 5: Document Upload Implementation (complete)

**Completed:** Implement Supabase Storage service (services/storage.py); Implement usage tracking service (services/usage.py); Implement POST /api/upload endpoint (routes/documents.py)
**Decisions:** - Created `UserData = dict[str, str: int; - storage.py returns dict[str, str: int] (not Pydantic models)
**Issues:** Initial Supabase Setup Confusion:; Issue
**Next:** Implement Docling OCR integration

---
## [2025-11-03] Session 6: Docling OCR Integration (complete)

**Completed:** Implement `extract_text_ocr()` in `services/extractor.py`; Create test endpoint `POST /api/test-ocr/{document_id}`; Test OCR extraction with uploaded PDFs
**Decisions:** Used Context7 docs agent proactively:; Singleton DocumentConverter pattern:; Async wrapper with to_thread():
**Issues:** Long processing time on first run:; Type errors with database response:
**Next:** Implement LangChain extraction with OpenRouter

---
## [2025-11-04] Session 7: OCR Solution Research & Migration Planning

**Completed:** Researched OCR solutions for migration from Docling; Updated all planning documentation for OCR migration; Created spike tests for OCR validation
**Decisions:** Abandoned DeepSeek-OCR migration; Chose Mistral OCR Direct API over OpenRouter; Keep `ocr_results` table architecture
**Issues:** DeepSeek-OCR context limit confusion; OpenRouter Mistral OCR token inflation
**Next:** Complete Mistral OCR spike test validation, then begin implementation

---
## [2025-11-05] Session 8: Mistral OCR Integration & Code Review (complete)

**Completed:** Updated all planning documentation from DeepSeek → Mistral OCR; Implemented `backend/app/services/ocr.py` with Mistral OCR integration; Refactored `backend/app/services/extractor.py` to placeholder
**Decisions:** OCR service naming; Enhanced metadata capture; Schema improvements
**Issues:** Config integration issue; Solution
**Next:** Create and apply `ocr_results` table migration

---
## [2025-11-06] Session 9: Enhanced OCR Metadata & Migration Creation (complete)

**Completed:** Enhanced OCR service to capture all Mistral API fields; Investigated Mistral OCR text output formats; Created database migration for `ocr_results` table
**Decisions:** Single text field (raw_text) storing markdown; Added model field to schema; Document annotation out of scope for MVP
**Issues:** Server restart issue; Solution
**Next:** Apply `ocr_results` migration to Supabase database

---
## [2025-11-06] Session 10: OCR Optimization & Database Caching Implementation (complete)

**Completed:** Applied `ocr_results` migration to Supabase database; Optimized OCR service to use Supabase signed URLs directly; Implemented OCR result database caching
**Decisions:** Signed URLs vs Base64 encoding; Direct Supabase calls instead of repository pattern; Upsert strategy for OCR caching
**Issues:** Processing time increase with signed URLs; Cause
**Next:** Implement LangChain + OpenRouter integration for structured extraction

---
## [2025-11-06] Session 11: LangChain Extraction Engine Implementation (complete)

**Completed:** Refactored OCR endpoint into dedicated routes file; Implemented LangChain + Claude extraction service; Implemented auto extraction mode
**Decisions:** Use ChatOpenAI with OpenRouter instead of ChatAnthropic; Use `method="function_calling"` for structured output; Separate OCR routes from document routes
**Issues:** Initial structured output error with `json_mode`; Solution
**Next:** Integrate extraction into full upload pipeline

---
## [2025-11-10] Session 12: Schema Refinement & Re-Extraction Testing (complete)

**Completed:** Created and applied migration 003_add_extraction_metadata.sql; Updated extraction test endpoints to fetch cached OCR; Tested re-extraction flow end-to-end
**Decisions:** Keep confidence_scores separate from extracted_fields; Add model and processing_time_ms to extractions table; Keep updated_at field
**Issues:** Initial approach had text as manual input; Type hints warnings in IDE
**Next:** Begin full pipeline integration or implement production extraction endpoints

---
## [2025-12-16] Session 13: Architecture Migration Planning (complete)

**Completed:** Analyzed AGENT-NATIVE-ARCHITECTURE.md for migration direction; Created `planning/MIGRATION-PLAN.md` - architecture overview; Created `planning/MIGRATION-TASKS.md` - task checklist with 12 tasks
**Decisions:** Hybrid Architecture; LangChain → Anthropic SDK; Simplified Endpoints
**Next:** Start with `/resume` command

---
## [2025-12-16] Session 14: Route Consolidation (Tasks 3.2-3.3) (complete)

**Completed:** Task 3.2; Task 3.3
**Next:** Continue with Phase 4: Testing & Validation

---
## [2025-12-16] Session 15: Documentation Cleanup & PRD Review

**Completed:** Phase 5: Documentation Updates (Complete); Archived Migration Documents; PRD.md Updates
**Decisions:** Word docs (.docx): No - PDF/images only for MVP; Re-extract behavior: Creates new extraction (preserves history); Document preview: Markdown viewer showing OCR output
**Next:** Begin Phase 3: Frontend MVP

---
## [2025-12-20] Session 16: Planning Folder Reorganization (In Progress)

**Completed:** Brainstormed new folder structure using superpowers:brainstorming skill; Designed kanban-style planning system integrated with superpowers workflow; Created new `docs/` folder structure:
**Decisions:** Consolidated under `docs/`; Kanban in plans/; Feature subfolders
**Next:** See Session 17 below.

---
## [2025-12-20] Session 17: Planning Reorganization Phase 2 (Content Review)

**Completed:** Refactored stacks-schema to superpowers format
**Next:** **Continue**: Refactor agent-sdk folder

---
## [2025-12-20] Session 18: Planning Reorganization Phase 2 (Extraction Agent Refactor)

**Completed:** Refactored agent-sdk to extraction-agent with superpowers format; Corrected implementation state understanding; Organized project-level archive
**Next:** Update reference docs (PRD, ROADMAP, SCHEMA, ARCHITECTURE)

---
## [2025-12-21] Session 19: Documentation Review & Session Commands

**Completed:** Comprehensive documentation review; Created session slash commands; Updated root CLAUDE.md
**Decisions:** DEV-NOTES usage: Grep only, never read full; Session note format: `## Session N - YYYY-MM-DD - Description`; Slash commands: 3 commands (continue, wrap-up, handover-prompt)
**Next:** Continue with extraction-agent frontend implementation

---
## [2025-12-21] Session 20: Model Fix & Service Test Endpoints Design

**Completed:** Fixed invalid Claude model identifier; Designed service test endpoints; Created implementation plan
**Decisions:** Claude model ID: `claude-haiku-4-5`; Test approach: Minimal ping; Response format: Always 200 + status field
**Next:** Implement service test endpoints OR continue extraction-agent frontend

---
## [2025-12-21] Session 21: OCR 3 Upgrade Design & Planning (complete)

**Completed:** Researched Mistral OCR 3; Designed OCR 3 upgrade; Created implementation plan
**Decisions:** Storage approach: Add `html_tables` column; Agent impact: None - uses markdown only; Sync vs async: Synchronous request
**Next:** Execute OCR 3 upgrade implementation plan

---
## [2025-12-21] Session 22: Frontend Foundation Design & Planning

**Completed:** Researched shadcn Nova style; Brainstormed frontend foundation; Created implementation plan
**Decisions:** Project structure: Use existing `frontend/` directory; shadcn initialization: `npx shadcn@latest create` with Nova preset; Components approach: Import from shadcn, customize content only

---
## [2025-12-22] Session 23: Frontend Foundation Implementation (complete)

**Completed:** Executed implementation plan; Adapted plan based on Clerk docs; Fixed issues discovered during testing
**Decisions:** Style preset: new-york (not nova); Font: Geist (keep default); Route structure: `(app)/` route group
**Next:** Continue with next priority from ROADMAP (OCR 3 Upgrade or Extraction Agent Frontend)

---
## [2025-12-22] Session 24: Extraction Agent Agentic Tools Implementation

**Completed:** Verified Claude Agent SDK API patterns; Implemented database migrations; Implemented 6 agentic tools
**Decisions:** Tool organization: Individual files per tool; SSE event format: Flat objects: `{"text": ...}`; TextBlock handling: User-facing response (NOT "thinking")
**Next:** Continue with OCR 3 Upgrade or Extraction Agent Frontend

---
## [2025-12-22] Session 25: Clerk shadcn Theme Integration (complete)

**Completed:** Verified frontend foundation implementation; Implemented Clerk shadcn theme; Replaced NavUser with Clerk UserButton
**Decisions:** Sidebar user component: Clerk UserButton; Custom menu items: None (Clerk default); Beta access control: Waitlist mode
**Next:** Clerk + Supabase Integration (JWT, RLS policies)

---
## [2025-12-22] Session 26: Clerk + Supabase Integration Design & Planning (complete)

**Completed:** Brainstormed Clerk + Supabase integration; Researched Clerk Billing; Configured Clerk + Supabase dashboard integration
**Decisions:** User ID type: TEXT (not UUID); Keep `public.users`: Yes with JIT creation; Backend auth: Clerk Python SDK
**Next:** Execute Clerk + Supabase Integration Plan

---
## [2025-12-22] Session 27: Clerk + Supabase Integration Phase 1 & 2

**Completed:** Phase 1: Database Migration (Tasks 1-3); Phase 2: Frontend Supabase Clients (Tasks 4-6)
**Decisions:** Supabase client approach: `accessToken` callback; Skip JWT template: Yes
**Next:** Complete Clerk + Supabase Integration (Phase 3: Backend Auth)

---
## [2025-12-22] Session 28: OCR 3 Upgrade + Document Upload Endpoint (complete)

**Completed:** Upgraded Mistral SDK; Database migration; OCR service update
**Decisions:** Model ID: `mistral-ocr-latest`; Upload flow: Synchronous; Table format: HTML
**Next:** See Session 29.

---
## [2025-12-22] Session 29: Clerk + Supabase Integration Phase 3 Complete (complete)

**Completed:** Task 7; Task 8; Task 9
**Decisions:** SDK package: `clerk-backend-api`; Dev testing: DEBUG mode bypass; Dev user ID: `dev_user_test`
**Next:** Test Clerk + Supabase integration end-to-end OR start Extraction Agent Frontend

---
## [2025-12-22] Session 30: Auth Fixes Implementation (complete)

**Completed:** Task 1: Route protection middleware; Task 2: Clerk webhook handler; Task 3: Sign-out redirect
**Decisions:** Webhook testing: Deploy to Vercel
**Next:** Deploy frontend to Vercel and test webhook

---
## [2025-12-22] Session 31: Documents Page Implementation Plan

**Completed:** Documents Page Design Review; Technical Research; Implementation Plan Created
**Decisions:** Table library: TanStack Table + shadcn Table; PDF viewer: react-pdf with dynamic import; Header system: React Context + portal pattern
**Next:** Execute documents page implementation plan

---
## [2025-12-22] Session 32: Vercel Deployment & Clerk Production Setup (complete)

**Completed:** Created Vercel deployment plan; Fixed TypeScript build error; Fixed auth middleware for webhook
**Decisions:** Clerk production setup: Clone dev instance; DNS for Clerk: 5 CNAME records in Vercel; gitignore fix: `/documents/` not `documents/`
**Next:** Complete Vercel deployment - add env vars and test webhook

---
## [2025-12-23] Session 33: Documents Page Plan Sharding

**Completed:** Reviewed Documents Page plan from previous session; Sharded monolithic plan into 4 phase files; Created README.md master index
**Decisions:** Sharding strategy: By phase (4 files); Index format: README.md with checkboxes; Original plan: Deleted
**Next:** Execute Documents Page Phase 1 (Foundation)

---
## [2025-12-23] Session 34: Documents Page Phase 1 Complete (complete)

**Completed:** Phase 1: Foundation - All 3 tasks complete; Built PageHeader component; Updated app layout
**Decisions:** Breadcrumb pattern: `usePathname()` instead of React Context; PageHeader location: `components/layout/` folder; SidebarTrigger placement: Keep in layout, not in PageHeader
**Next:** Execute Documents Page Phase 2 (Documents List)

---
## [2025-12-23] Session 35: Documents Page Phase 2 Complete (complete)

**Completed:** Phase 2: Documents List - All 8 tasks complete; Schema alignment; Design refinements
**Decisions:** Status column: Removed for MVP; Checkboxes: Removed for MVP; Actions dropdown: Removed for MVP
**Next:** Execute Documents Page Phase 3 (Document Detail)

---
## [2025-12-23] Session 36: Local Dev Environment Fixes (complete)

**Completed:** Fixed CORS for local development; Fixed "User not found" error; Verified Clerk webhook implementation
**Decisions:** Local user sync: Manual insert via Supabase; Webhook pattern: Keep current implementation
**Next:** Execute Documents Page Phase 3 (Document Detail)

---
## [2025-12-23] Session 37: Documents Page Phase 3 Partial (Tasks 12-14) (complete)

**Completed:** Task 12: Install react-pdf; Task 13: Create PDF Viewer Component; Task 14: Create Visual Preview Component
**Decisions:** PDF library: react-pdf; Worker config: import.meta.url; ocr_complete status: Keep in TypeScript type
**Next:** Continue Documents Page Phase 3 (Tasks 15-20)

---
## [2025-12-23] Session 38: Documents Page Phase 3 Complete (Tasks 15-20) (complete)

**Completed:** Task 15: Create PreviewPanel component; Task 16: Create ExtractedDataTable component; Task 17: Create StacksDropdown component
**Decisions:** Skip DocumentDetail wrapper: Wire directly to page.tsx; Markdown renderer: react-markdown; Link sanitization: Custom component filter
**Next:** Either finish AiChatBar (Task 19) or move to Phase 4 Integration

---
## [2025-12-23] Session 39: Linear Design Refresh + Layout Debugging

**Completed:** Linear-inspired design refresh; Layout constraint attempt
**Decisions:** Design direction: Linear-inspired; Table refactor: Simple divs with divide-y; Confidence display: Hover-only
**Next:** Fix chat bar visibility layout issue

---
## [2025-12-23] Session 40: Layout Debugging & PageHeader Architecture

**Completed:** Fixed chat bar visibility; Identified duplicate PageHeader issue; Attempted context-based solution
**Decisions:** Nested main fix: Changed to `<div>`; Context vs Composition: Tried both, neither ideal
**Next:** Resolve PageHeader architecture - must be in header bar with page-specific data

---
## [2025-12-23] Session 41: Parallel Routes PageHeader Architecture (complete)

**Completed:** Implemented parallel routes @header slot architecture; Created header slots for documents routes; Fixed data deduplication with React cache()
**Decisions:** Header architecture: Parallel routes; Data deduplication: React cache(); Filter architecture: URL search params (future)
**Next:** Continue Documents Page Phase 4 or implement header filters

---
## [2025-12-23] Session 42: AI Chat Bar Design & Planning (complete)

**Completed:** Brainstormed AI chat bar design with Linear inspiration; Created design document; Created implementation plan
**Decisions:** SSE approach: fetch + ReadableStream; Panel position: Fixed viewport bottom; Auto-collapse: 3 seconds after complete
**Next:** Execute AI Chat Bar implementation plan

---
## [2025-12-23] Session 43: CLAUDE.md Documentation Restructure (complete)

**Completed:** Created `frontend/CLAUDE.md`; Created `backend/CLAUDE.md`; Slimmed root `CLAUDE.md`
**Decisions:** Doc structure: Root overview + subdirectory details; What to track: Commands + CLAUDE.md, not settings.local.json; docs/CLAUDE.md: Keep unique content only
**Next:** Continue Documents Page Phase 4 or execute AI Chat Bar plan

---
## [2025-12-23] Session 44: AI Chat Bar Implementation (complete)

**Completed:** Implemented AI Chat Bar with SSE streaming; Code reviews and fixes; Completed Documents Page feature
**Decisions:** SSE approach: fetch + ReadableStream; Panel position: Floating above input; Input style: Simple Input with Enter hint
**Next:** Realtime updates and document page enhancements

---
## [2025-12-23] Session 45: Realtime Updates Design & Planning (complete)

**Completed:** Brainstormed realtime updates feature; Created design document; Created implementation plan
**Decisions:** Realtime approach: Supabase subscription on `extractions` table; Page architecture: Client wrapper with server-fetched initial data; Table styling: shadcn TanStack Table style (horizontal dividers ...
**Next:** Execute realtime updates implementation plan

---
## [2025-12-24] Session 46: Realtime Updates Implementation (complete)

**Completed:** Stage 1: Realtime Subscription; Stage 2: TanStack Table Redesign; Supabase Configuration
**Decisions:** Token refresh: 50s interval; setAuth vs accessToken: Both; Data shape detection: Cascade checks
**Next:** Stacks feature or Vercel deployment

---
## [2025-12-24] Session 47: Upload Dialog Design & Planning (complete)

**Completed:** Upload Dialog Design; Implementation Plan Creation; Plan Sharding
**Decisions:** Step order: Dropzone first; State management: Self-contained in UploadDialogContent; Custom fields format: `{name, description}` JSON
**Next:** Execute upload dialog implementation plan

---
## [2025-12-24] Session 48: Linear-Style Preview Sidebar Design (complete)

**Completed:** UI Refinements; Resizable Component Setup; Implementation Plan Creation
**Decisions:** State persistence: localStorage (manual); Panel type import: `ImperativeHandle as PanelImperativeHandle`; Layout data format: `number[]` array
**Next:** Execute Linear-style preview sidebar implementation plan

---
## [2025-12-24] Session 50: Linear-Style Preview Sidebar Implementation (complete)

**Completed:** Created Preview Panel Context; Created Preview Toggle Button; Created Document Header Actions
**Decisions:** Library version: react-resizable-panels 2.1.9; Provider location: (app)/layout.tsx; PDF scaling: CSS transform
**Next:** Update breadcrumbs styling/functionality

---
## [2025-12-24] Session 50: Upload Dialog Implementation (complete)

**Completed:** Phase 1: Foundation; Phase 2: UI Components; Phase 3: Integration
**Decisions:** Type location: `@/types/upload` instead of co-located; Code review false positives: Identified 3/3 Phase 2 "critical" issues as non-issues; Dialog state: Controlled via parent with `onClose` callback
**Next:** Manual testing of upload dialog

---
## [2025-12-24] Session 51: Sub-bar Toolbar Design & Planning (complete)

**Completed:** Brainstormed Linear-style sub-bar design; Defined layout structure; Documents List page design
**Decisions:** Actions location: Sub-bar, not header; Filter vs Search order: Filter first, then Search; Checkboxes visibility: Hover to show
**Next:** Execute sub-bar toolbar implementation plan

---
## [2025-12-25] Session 52: Sub-bar Toolbar Plan Refinement (complete)

**Completed:** Brainstormed component architecture; Updated design doc with decisions; Updated implementation plan
**Decisions:** Search component: shadcn InputGroup; Filter button location: `components/documents/`; Sub-bar placement: In page content
**Next:** Execute sub-bar toolbar implementation plan Phase 1

---
## [2025-12-26] Session 53: Sub-bar Toolbar Implementation (complete)

**Completed:** Phase 1: Foundation Components; Phase 2: Documents List - Row Selection & Sub-bar; Phase 3: Document Detail - Sub-bar & Header Cleanup
**Decisions:** ActionButton location: `components/layout/`; Button styling: ghost, h-7, px-2, text-xs, mr-0.5 icon gap; Filter icon: SlidersHorizontal
**Next:** Fix table alignment and complete sub-bar toolbar feature

---
## [2025-12-26] Session 54: Layout Alignment System Design & Planning (complete)

**Completed:** Brainstormed Layout Alignment System; Created Design Document; Created Implementation Plan
**Decisions:** 3-column grid: checkbox \; Row click behavior: Click row→preview, click filename→navigate; Filename hover: Underline + pointer
**Next:** Implement Layout Alignment System starting with Phase 1

---
## [2025-12-26] Session 55: Layout Alignment Phase 1-2 Partial (Blocked)

**Completed:** Phase 1: Breadcrumb Icons (Tasks 1-2); Phase 2 Tasks 3-5
**Decisions:** Remove Size column: Yes; Remove pagination: Yes; Column resizing approach: BLOCKED
**Next:** Debug and fix TanStack Table column resizing

---
## [2025-12-27] Session 56: Layout Alignment Phase 2 Complete

**Completed:** Task 6: Row click for preview vs filename click for navigate; Task 7: Add preview panel to documents list; Table overflow fix
**Decisions:** Column resizing: Skip (Tasks 4-5); Dynamic truncation: `max-w-0` trick; Preview state: Shared via layout provider
**Next:** Phase 3 - Document Detail Page (Tasks 8-9, 11-12)

---
## [2025-12-27] Session 57: Extracted Data Table Checkboxes & Selection

**Completed:** Task 8: Add checkboxes to extracted data table; Task 9: Move chevron/confidence to Field column; Selection actions integration
**Decisions:** Indicator column: Merge into Field column; Column resizing (Task 10): Skip; Confidence display: Colored dot with tooltip
**Next:** Phase 3 Tasks 11-12 (Floating chat bar, icon-only preview toggle)

---
## [2025-12-27] Session 58: Floating AI Chat Bar Design

**Completed:** Task 11: Floating AI chat bar; Code review fixes
**Decisions:** Placeholder text: "How can I help you today?"; Icon: Tabler `IconBrandDatabricks`; Background: `bg-sidebar`
**Next:** Task 12 (icon-only preview toggle) then Phase 4

---
## [2025-12-27] Session 59: Layout Alignment Complete (complete)

**Completed:** Task 12: Icon-only preview toggle; Task 13: Update loading skeletons; Feature complete - moved to `docs/plans/complete/`
**Next:** Unified Preview State implementation

---
## [2025-12-28] Session 60: Unified Preview State Complete (complete)

**Completed:** Task 1-3: Context providers; Task 4-6: Component updates; Task 7-8: Loading skeletons
**Decisions:** localStorage consolidation: Single key with object; Don't clear URL on selection change: Keep URL until new one fetched; PdfViewer key prop: `key={pdfUrl}`
**Next:** Frontend Cleanup or Upload Dialog testing

---
## [2025-12-28] Session 62: Frontend Cleanup: Icon Migration

**Completed:** Task 1: Create icons barrel file; Tasks 2-9: Migrate shadcn UI components; Tasks 10-13: Migrate app components
**Decisions:** Keep lucide-react installed: Skip Task 14; Documents icon: IconFiles; Filter icon: IconFilter2
**Next:** Continue Frontend Cleanup Phase 4+ (component organization, tooltips)

---
## [2025-12-28] Session 63: Frontend Cleanup: Component Organization

**Completed:** Task 15-18.5: Component organization; Task 19: Add tooltips to sidebar header buttons; Additional layout reorganization (user-requested)
**Decisions:** global-search-dialog location: `layout/` not `search/`; upload-dialog barrel file: Removed; AI chat bar location: `layout/` not `documents/`
**Next:** Complete remaining tooltips (Tasks 20-22) and documentation (Task 23-24)

---
## [2025-12-28] Session 64: Frontend Cleanup: Tooltip Implementation

**Completed:** Task 22: Sidebar trigger tooltip; Global tooltip delay; Stackdocs dropdown tooltip
**Decisions:** Tooltip delay: 700ms global default; Stackdocs focus fix: `onCloseAutoFocus` prevent; PreviewToggle tooltip side: left
**Next:** Brainstorm sub-bar tooltips, then complete Tasks 20-21

---
## [2025-12-28] Session 65: Frontend Cleanup Complete (complete)

**Completed:** Tasks 20-21: Table and PDF tooltips; Sub-bar tooltips; Task 23: Update frontend CLAUDE.md

---
## [2025-12-28] Session 66: Issues Reorganization & UI Polish

**Completed:** Issues tracking reorganization; Extracted data table alignment fix; Expand/collapse chevron tooltips
**Next:** **Focus**: Stacks Feature - the core value proposition

---
## [2025-12-29] Session 67: Stacks Feature Design & Planning

**Completed:** Stacks feature brainstorm; Key design decisions; Design document v2
**Decisions:** AI-first UI: Chat bar + popup as primary; Dynamic chat bar: iPhone Dynamic Island style; Stack-level AI session: One conversation per stack
**Next:** Begin Stacks implementation - Phase 1 Foundation

---
## [2025-12-29] Session 68: Stacks Plan Review & Reorganization (complete)

**Completed:** Plan reviews with code-reviewer agent; Architecture alignment for 04-backend-routes.md; Plan reorganization
**Decisions:** Stacks scope: UI only (01-03); Implementation order: Stacks UI → Agent UI → Stack Agent; Backend routes: Move to todo
**Next:** Begin Stacks UI implementation - Phase 1 Foundation

---
## [2025-12-29] Session 70: Stacks Foundation Implementation (complete)

**Completed:** Phase 1 Foundation (01-foundation.md); Build error fixes; Code review improvements
**Decisions:** Server/client sidebar split: `app-sidebar-server.tsx` + `app-sidebar-client.tsx`; Type for minimal stacks: `StackSummary = Pick<Stack, 'id' \; Omit pattern for server props: `Omit<React.ComponentPr...
**Next:** Brainstorm sidebar layout redesign, then continue Stacks UI implementation

---
## [2025-12-30] Session 71: Stacks Phase 2 Enhancement (complete)

**Completed:** Phase 2 enhancements; Code review
**Decisions:** Table feature parity: Match Documents table exactly; Selection state lifting: `onSelectionChange` callback; Defer table abstraction: Keep tables separate for now
**Next:** Phase 3 - Stack Tables implementation (`03-stack-tables.md`)

---
## [2025-12-30] Session 72: Stacks Phase 3 Partial + Agent UI Refactor Setup (complete)

**Completed:** Phase 3 Tasks 1-2; Phase 3 Tasks 3-5 deferred; Test data created
**Decisions:** Defer remaining Phase 3 tasks: Skip until Stack Agent; Next priority: Agent UI Refactor; Test data approach: Supabase MCP direct insert
**Next:** Agent UI Refactor - Chat bar redesign

---
## [2025-12-30] Session 73: Agent UI Refactor Design (Dynamic Island) (complete)

**Completed:** Design brainstorming session; Architecture validation; Design doc v2 created
**Decisions:** State management: Zustand (not Context); Flow routing: Discriminated unions; Popup width: Match chat bar (max 640px)
**Next:** Agent UI Refactor - Write implementation plan

---
## [2025-12-30] Session 74: Documents Navigation Performance & Architecture Cleanup (complete)

**Completed:** Navigation Performance Optimization; Persistent Preview Panel; SubBar Architecture Refactor
**Decisions:** Loading skeletons: Remove them; Preview panel: Persistent in layout; SubBar pattern: @subbar parallel route
**Next:** Continue with Agent UI Refactor implementation plan

---
## [2025-12-30] Session 75: @subbar Architecture for Stacks + Documents Refactor (complete)

**Completed:** Design: @subbar Architecture; Stacks Filter Contexts; Stacks @subbar Parallel Routes
**Decisions:** Provider placement: App-level layout; SubBar data fetching: Async server component; Context content: Client state only
**Next:** Continue with Agent UI Refactor implementation plan

---
## [2025-12-30] Session 76: Agent UI Refactor Plan Sharding & Code Review (complete)

**Completed:** Plan Sharding; Architecture Brainstorming; Code Review & Fixes
**Decisions:** AgentContainer placement: Root layout; Visibility management: Self-managed via usePathname; Context awareness: Route + existing contexts
**Next:** Execute Agent UI Refactor implementation plan

---
## [2025-12-31] Session 77: Gemini Code Review & Plan Finalization (complete)

**Completed:** Crafted Gemini CLI Review Prompt; Gemini External Reviews; Incorporated Gemini Recommendations
**Decisions:** Zustand persist scope: Persist `flow` + `isPopupOpen`, exclude `File` objects; Mobile max-width: `sm:max-w-xl` (576px); iOS safe area: `pb-[env(safe-area-inset-bottom)]` + viewport-fit
**Next:** Execute Agent UI Refactor implementation plan

---
## [2025-12-31] Session 78: Agent UI Refactor Phase 1 Implementation (complete)

**Completed:** Task 0: Add Missing Icons; Task 1: Create Agent Store; Task 2 & 3: AgentBar + AgentActions
**Decisions:** SSE cleanup location: Component level (UploadFlow); AgentPopupContent export: Internal (not in barrel); getUploadTitle type: `UploadFlowStep` not `string`
**Next:** Agent UI Refactor Phase 2 (Upload Flow)

---
## [2025-12-31] Session 79: Agent UI Refactor Phase 2 Implementation (complete)

**Completed:** Task 1: Create Upload Flow Component; Task 2: Create Upload Step Components; Task 3: Wire Upload Flow into Popup Content
**Decisions:** Native `<label>` vs Label component: Native `<label>`; FieldTagInput props: `onAdd`/`onRemove`; Accessibility enhancements: Added aria attributes
**Next:** Agent UI Refactor Phase 3 (Integration)

---
## [2026-01-01] Session 82: Agent UI Refactor Phase 4 Complete (complete)

**Completed:** Task 4.1: Update imports; Task 4.2: Delete old components; Task 4.3: Update documentation
**Decisions:** Migrate shared components: Copy to agent folder; Add Agent System docs: Added to CLAUDE.md
**Next:** Brainstorm Agent UI Design Refinements

---
## [2026-01-01] Session 83: Agent Bar Redesign Design (complete)

**Completed:** Brainstormed unified agent bar design; Created design document; Added post-MVP issues (#33-35)
**Decisions:** Bar + popup structure: Single unified card; Position: Bottom-anchored, expands upward; Animation: Spring physics (iOS-inspired)
**Next:** Create implementation plan for Agent Bar Redesign

---
## [2026-01-01] Session 84: Agent Bar Redesign Implementation Plan (complete)

**Completed:** Analyzed Andrej Karpathy's YC talk on AI software; Reviewed current agent system architecture; Designed Config + Hook Hybrid architecture
**Decisions:** Architecture pattern: Config + Hook Hybrid; Smart Config vs Hybrid: Hybrid; Component split: AgentCard → IdleContent + ActiveFlowContent + RegisteredFlowContent
**Next:** Execute implementation plan using subagent-driven development

---
## [2026-01-01] Session 85: Agent Bar Redesign Phase 1 Implementation (complete)

**Completed:** Phase 1 Infrastructure (6 tasks); Subagent-Driven Development Process
**Decisions:** types.tsx vs types.ts: .tsx extension; Unused `get` param: Removed from store; Escape propagation: Added stopPropagation
**Next:** Execute Phase 2 - Unified Card (AgentCard, StatusBar, animations)

---
## [2026-01-01] Session 86: Agent Bar Redesign Phase 2 Implementation (complete)

**Completed:** Phase 2: Unified Card (8 tasks); Bug Fix
**Decisions:** Unused store selectors: Removed expand/collapse from StatusBar; Route filtering: Preserved in AgentContainer; Subagent model: Switched to opus
**Next:** Execute Phase 3 - Upload Migration

---
## [2026-01-01] Session 87: Agent Bar Redesign Phase 3 Implementation (complete)

**Completed:** Phase 3: Upload Migration (7 tasks)
**Decisions:** Subagent workflow: Implementer → Spec Review → Code Quality Review; context7 verification: Used for TypeScript patterns; Old popup content: Deleted with upload-flow.tsx
**Next:** Execute Phase 4 - Remaining Flows (stub out 7 flow types)

---
## [2026-01-01] Session 88: Agent Bar Redesign Phase 4 Complete (complete)

**Completed:** Phase 4: Remaining Flows (7 tasks); Documentation Updates
**Decisions:** Review workflow: Implementer → Spec Review → Code Quality Review; File extension: `.tsx` for metadata files; Step extraction: `flow.step` pattern
**Next:** **Feature complete.** Move to next priority:

---
## [2026-01-01] Session 89: Documents Sub-bar Design (complete)

**Completed:** Browser exploration of documents UI; Brainstorming session for sub-bar completion; Design document created
**Decisions:** Agent for Delete: Yes; Agent for Export: Yes; Filter without agent: Simple dropdown
**Next:** Create implementation plan for Documents Sub-bar

---
## [2026-01-05] Session 90: Documents Sub-bar Design Refinement (complete)

**Completed:** Continued brainstorming session for sub-bar UX; Key UX simplifications; Delete implementation design
**Decisions:** Agent flows: 1 only (Edit); Delete location: Supabase direct; Storage cleanup: Best-effort
**Next:** Create implementation plan for Documents Sub-bar

---
## [2026-01-05] Session 91: Documents Sub-bar Plan Review (complete)

**Completed:** Reviewed implementation plan with 6 subagents; Applied 14 code review fixes; Added date utilities task
**Decisions:** Supabase client pattern: `useSupabase()` hook; Date filtering: Extract to `lib/date.ts`; ConfirmClose pattern: Reference only
**Next:** Execute Documents Sub-bar implementation plan

---
## [2026-01-05] Session 92: Phase 1-2 Execution + Filter Redesign Plan

**Completed:** Phase 1: Install Sonner; Phase 2: Filter Dropdown; Updated /execute command
**Decisions:** Agent pattern: 3 agents per task; Filter redesign priority: Before Phase 3-6; Filter pills: Individual (not combined)
**Next:** Execute Filter Redesign (Phase 2.1)

---
## [2026-01-06] Session 93: Filter Redesign Plan Refinement + Review

**Completed:** Filter Redesign Plan Discussion; Expanded All 8 Tasks with Reference Implementations; Parallel Agent Review
**Decisions:** FilterPill component: Custom (not Badge); Stacks fetching: Client-side hook; Task 2.1.3: Skipped
**Next:** Execute Filter Redesign (Phase 2.1)

---
## [2026-01-06] Session 94: Filter Redesign Phase 2.1 (Tasks 2.1.1, 2.1.2, 2.1.4)

**Completed:** Task 2.1.1; Task 2.1.2; Task 2.1.4
**Decisions:** Checkbox vs check mark: Checkbox on left; "All time" option: Removed; Subbar architecture: Keep client component
**Next:** Continue Filter Redesign (Phase 2.1)

---
## [2026-01-06] Session 95: Filter Redesign Phase 2.1 Complete

**Completed:** Task 2.1.5; Task 2.1.6; Task 2.1.7
**Decisions:** Subbar layout: Search → Filter → Pills; Filter button with filters: Icon-only (no text/count); Empty state buttons: ActionButton components
**Next:** Continue Documents Sub-bar - Phase 3+

---
## [2026-01-06] Session 96: Phase 3 Stack Dropdown + Phase 2.2 Plan

**Completed:** Task 1: Thread documentId prop through subbar chain; Task 2: Wire up StacksDropdown with DB operations; UI Polish: StacksDropdown Linear-style
**Decisions:** Stack fetching: Client-side `useStacks()`; StacksDropdown search: Local state (not context); Phase 2.2 scope: Move search into filter + add to detail
**Next:** Execute Phase 2.2 - Search in Filter dropdown

---
## [2026-01-06] Session 97: Phase 2.2 Search in Filter + DRY Refactor

**Completed:** Task 9: Add search input to FilterButton dropdown; Task 10: Add search pill to FilterBar; Task 11: Remove ExpandableSearch from documents SubBar
**Decisions:** SearchFilterButton vs composing FilterButton: Separate components; Filter position in stacks: Left side; ExpandableSearch: Deleted
**Next:** Phase 4 - Export functionality

---
## [2026-01-06] Session 98: Phase 4 Export + Phase 5 Delete

**Completed:** Phase 4: Export Dropdown; Phase 5: Delete Dialog; Linear-style UI polish
**Decisions:** Export toast timing: Keep "CSV exported"; Alert dialog position: top-1/3; Overlay opacity: bg-black/30
**Next:** Phase 6 - Selection Actions (Bulk Delete)

---
## [2026-01-06] Session 99: Phase 6 Bulk Delete + Phase 7 Planning

**Completed:** Phase 6: Selection Actions / Bulk Delete; Performance Optimization; Bug Fix
**Decisions:** Selection state: Context (not props); Extraction fetch: On-demand (not in list query); Loading state: Add isLoadingExtraction boolean
**Next:** Phase 7 - Selection & Preview Actions

---
## [2026-01-06] Session 100: Phase 7 Tasks 17-19 Complete

**Completed:** Task 17: Field Deletion on Document Detail; Task 18: FieldSelectionActions; Task 19: Add to Stack for Documents List
**Decisions:** Stack picker pattern: Submenu (not dialog); Shared component approach: Extract `StackPickerContent`; Stacks caching: Simple module-level cache
**Next:** Complete Phase 7 - Tasks 20-21

---
## [2026-01-06] Session 101: Phase 7 Complete, Documents Subbar Feature Done

**Completed:** Task 20: Document actions in subbar when previewed; Task 21: Remove Upload button from documents subbar; Consistency fixes
**Decisions:** Document actions location: In subbar (not preview panel); Both selection + preview: Show both with separator; Divider component: shadcn Separator
**Next:** Resume Stacks UI or start new feature

---
## [2026-01-07] Session 102: Preview Panel Redesign Brainstorm

**Completed:** Brainstormed preview panel redesign with superpowers:brainstorming skill; Created design document; Frontend agent research on shadcn components
**Decisions:** PDF page navigation: Custom prev/next (not Carousel); Tab naming: PDF \; Controls location: Inside preview container
**Next:** Finalize implementation plan with superpowers:write-plan skill

---
## [2026-01-07] Session 103: Preview Panel Plan Finalized

**Completed:** Rewrote implementation plan using superpowers:write-plan skill; Dispatched parallel review agents (orchestrate skill); Applied fixes identified by review agents
**Decisions:** Plan structure: 3 sharded files; DialogTitle accessibility: Radix VisuallyHidden; Download button: Hide on Text tab
**Next:** Execute implementation plan phase-by-phase

---
## [2026-01-07] Session 104: Preview Panel Phase 1 Complete

**Completed:** Task 1: Add ArrowsMaximize icon to barrel export; Task 2: Create preview-panel folder structure; Task 3: Rename 'visual' tab to 'text'
**Decisions:** preview-panel location: `/components/preview-panel/`; preview-panel-context location: Inside preview-panel folder; selected-document-context: Stays in `/documents/`
**Next:** Execute Phase 2 - Create all preview panel components

---
## [2026-01-07] Session 105: Preview Panel Phase 2 Complete

**Completed:** Task 5: PreviewMetadata; Task 6: PageNavigation; Task 7: PreviewControls
**Decisions:** Empty string handling in TextContent: Changed `!text` to `!text?.trim()`; Keyboard handler duplication: Deferred to Phase 3
**Next:** Execute Phase 3 - Integration, cleanup, polish (Tasks 13-18)

---
## [2026-01-07] Session 106: Preview Panel Phase 3 Complete + Styling Polish

**Completed:** Phase 3 Tasks 13-18; Comprehensive code review; Styling polish
**Decisions:** Preview panel background: `bg-sidebar border`; PDF width approach: Direct width instead of CSS transform; Outer padding: `p-8` (doubled from `p-4`)
**Next:** Continue preview panel visual polish

---
## [2026-01-07] Session 107: Preview Panel Loading Bug Fixes

**Completed:** Fixed double loading spinner issue; Fixed loading state coordination; Fixed scrolling for tall PDFs
**Decisions:** Loading state source: Derive from `renderedUrl !== url`; PDF container during loading: `position: absolute` + `opacity: 0`; Scroll container: TabsContent with `flex-1 min-h-0`
**Next:** Fix remaining preview panel bugs

---
## [2026-01-08] Session 108: Preview Panel Hydration Flash Fix

**Completed:** Fixed hydration flash for preview panel; Synchronous localStorage initialization; Mounted guard for ResizablePanelGroup
**Decisions:** Mounted guard approach: Use `if (!mounted)` to delay ResizablePanelGroup; Empty state logic: Check selectedDocId not just filename; Performance trade-off: Accept ~1 frame delay
**Next:** Finalize preview panel code review + cleanup

---
## [2026-01-08] Session 109: Preview Panel Code Review Complete

**Completed:** Phase 3 Code Review Tasks; SSR Flash Fixes; Code Cleanup
**Decisions:** Module-level localStorage: Removed; Mounted guards: Keep; Skip optional cleanup items: Yes
**Next:** Focus on Stacks UI or other MVP priorities.

---
## [2026-01-13] Session 110: Documents Redesign Design Complete

**Completed:** Brainstormed Documents Section Redesign; Created Design Document; Frontend Design Review
**Decisions:** Per-document extraction: Remove; AI metadata on upload: Yes; Existing extractions table: Keep read-only
**Next:** Create implementation plan for Documents Redesign

---
## [2026-01-13] Session 111: Documents Redesign Plans Reviewed

**Completed:** Loaded context from previous session; Context7 Library Verification; Full Code Review of All 4 Phases
**Decisions:** useCallback pattern: Match existing context pattern; Breadcrumb display: Show display_name, fallback to filename; Realtime subscription: Will become unused after Phase 4
**Next:** Execute Documents Redesign implementation starting with Phase 1

---
[2026-01-25 10:05:00] RALPH: Task blocked: stackdocs-830.1
[2026-01-25 10:05:02] RALPH: Starting task: stackdocs-830.2 - Migrate Issues to Beads
[2026-01-25 10:15:11] RALPH: Task blocked: stackdocs-830.2
[2026-01-25 10:15:13] RALPH: Starting task: stackdocs-830.3 - Update CLAUDE.md Files
[2026-01-25 10:25:22] RALPH: Task blocked: stackdocs-830.3
[2026-01-25 10:25:24] RALPH: Starting task: stackdocs-830.4 - Migrate Features to Beads
[2026-01-25 10:35:32] RALPH: Task blocked: stackdocs-830.4
[2026-01-25 10:35:35] RALPH: Ralph stopped: no ready tasks, some may be blocked

## [2026-01-25 11:15] Session 112

**Branch:** main | **Git:** uncommitted changes

### What Happened
- Installed Space-Agents in Stackdocs project (`.space-agents/`, `.beads/`)
- Brainstormed migration from superpowers workflow to Space-Agents via `/exploration-brainstorm`
- Created exploration report at `.space-agents/exploration/ideas/2026-01-25-superpowers-to-space-agents-migration/exploration.md`
- Validated exploration report with Explore agent - found gaps (issue count, dual CLAUDE.md files, todo/ features)
- Created implementation plan via `/exploration-plan` with 7 tasks
- Created Beads feature `stackdocs-830` with tasks and dependencies
- Launched Ralph in visible mode (`--visible`) for automatic execution
- Ralph completed 5 tasks:
  - `.1` Transform DEV-NOTES to CAPCOM (Python script, 111 sessions migrated)
  - `.2` Migrate Issues to Beads (31 issues imported)
  - `.3` Update CLAUDE.md Files (root + docs/)
  - `.4` Migrate Features to Beads (4 epics: e7z, drg, 4z3, 7vb with 48 tasks)
  - `.11` Orphan blocker cleanup
- Ralph stalled due to race condition bug (bd sync timing)

### Decisions Made
- Archive old plans structure, keep as read-only reference
- Replace `/continue`, `/wrap-up` with `/launch`, `/land`
- Migrate 31 issues to Beads (not 41 - actual count was lower)
- Use Python script for DEV-NOTES transformation (edge cases: Session 15, duplicate 50, date typos)

### Gotchas
- Ralph race condition: `bd ready` called too fast after `bd sync`, dependency resolution not propagated
- Fix: Add sleep after sync in `mark_task_complete()` in ralph.sh
- Handover provided to space-agents session for fix

### In Progress
- Feature `stackdocs-830` at 5/7 tasks complete
- Remaining: `.5` Restructure Folders, `.6` Cleanup Commands, `.7` Cleanup Superpowers Refs
- Bug `.10` is stale blocker - can be closed

### Next Action
- Restart Ralph or manually complete remaining 3 tasks (.5, .6, .7)
- Close stale blocker bug `.10`
- Move exploration folder from `staged/` to `complete/` when feature closes

---

## [2026-01-25 18:58] Session 113

**Branch:** main | **Git:** uncommitted changes

### What Happened
- Completed feature `stackdocs-830` (Superpowers to Space-Agents Migration) via orchestrated mode
- Used Worker/Inspector/Analyst cycle for each of the 3 remaining tasks:
  - `.5` Restructure Folders: Archived `docs/plans/` and `docs/sessions/` to `docs/archive/`, updated CLAUDE.md references
  - `.6` Cleanup Commands: Archived 6 replaced commands (continue, wrap-up, handover-prompt, execute, orchestrate, issue) to `.claude/commands/archive/`, kept code-review.md and debug.md
  - `.7` Cleanup Superpowers References: Updated `code-review.md` to remove superpowers prefix, verified no active CLAUDE.md references
- Closed stale blocker bug `.10`
- Additional cleanup requested by user:
  - Moved `.claude/commands/archive/` → `docs/archive/commands/` for consolidated archive location
  - Deleted `backend/scripts/migrate_devnotes_to_capcom.py` (one-time migration script, no longer needed)
  - Deleted `backend/scripts/__pycache__/` (Python cache)
  - Deleted `.space-agents/tmp/stackdocs-830/` (temporary mission prompts)
  - Moved exploration folder from `staged/` → `complete/`

### Decisions Made
- Archived files left as historical records (no superpowers reference cleanup in docs/archive/)
- Kept code-review.md and debug.md as they invoke superpowers skills that still exist and complement Space-Agents
- Consolidated all archives under `docs/archive/` (plans, sessions, commands)

### Gotchas
- Worktree `.worktrees/documents-redesign/` still has old superpowers references - will resolve on merge/rebase
- Analyst found terminology inconsistency in code-review.md (functional but could be cleaner)

### Next Action
- Pick next feature from Beads (`bd ready`) - Backend Production Hardening (e7z) has P1 tasks ready

---
## [2026-01-25 19:05] Session 114

**Branch:** main | **Git:** clean

### What Happened
- Brainstormed major product pivot: Stackdocs evolving from document extraction SaaS to "Living Workspace" (HAL-OS for the web)
- Explored Fraser's HAL-OS repo (`~/Library/CloudStorage/OneDrive-Personal/HAL-OS/`) - understood OS metaphor (kernel=CLAUDE.md, storage=subsystems, apps=skills)
- Explored Space-Agents repo (`~/Documents/space-agents/`) - understood Ralph loop, skill system, CAPCOM patterns
- Reviewed AI Co-Founder competitive analysis (`/Users/fraserbrown/shiploop/.space-agents/exploration/ideas/2026-01-25-aicofounder-competitive-analysis/analysis.md`) - validated chat+canvas pattern (30k users, $100k revenue)
- Created comprehensive exploration document: `.space-agents/exploration/ideas/2026-01-25-stackdocs-pivot-living-workspace/exploration.md`

### Decisions Made
- **Documents = File Explorer**: Keep existing Documents section as table-based file management (already built, still useful)
- **Stacks = Canvas Workspaces**: Transform Stacks from tab-based views to draggable window canvases
- **Keep existing nav**: Header + SubBar parallel routes stay, Agent Bar stays at bottom
- **Canvas tech**: CSS Grid + Framer Motion drag (already using Framer, full control)
- **MVP window types**: DocumentWindow, TableWindow, NotesWindow
- **New component structure**: `components/canvas/` folder with StackCanvas, CanvasWindow, window types

### Architecture Captured
```
Documents page → File browser (keep as-is)
Stacks page → Canvas workspaces (transform)
  └── StackDetailClient content replaced with StackCanvas
      └── Draggable windows (Document, Table, Notes)
```

### In Progress
- Exploration complete, document in `ideas/` folder
- Ready for `/exploration-plan` to break Phase 1 into Beads tasks
- No code changes this session (brainstorm only)

### Next Action
- Run `/exploration-plan` to create Phase 1 tasks in Beads
- Build canvas foundation: StackCanvas, CanvasWindow, DocumentWindow
- Replace StackDetailClient tab content with canvas

---

## [2026-01-26 14:30] Session 115

**Branch:** main | **Git:** clean

### What Happened
- Reviewed Beads structure: 4 epics with subtasks (e7z, 7vb, drg, 4z3) + 31 orphan items migrated from ACTIVE.md
- Discussed organizing orphans into type-based epics (bugs, features, tasks) - decided against it since Beads already tracks type via `--type` filter
- Discovered documents-redesign worktree at `.worktrees/documents-redesign` with 34 commits of Phase 1-3 work
- Merged worktree back to main:
  1. `git merge main` (in worktree) - brought Space-Agents setup into worktree
  2. Resolved 2 doc conflicts (file location + IN-PROGRESS.md content)
  3. `git merge feature/documents-redesign` (from main) - fast-forward merge
  4. Cleaned up: `git worktree remove`, `git branch -d`
- Started frontend (localhost:3000) and backend (localhost:8000) to verify merge
- Tested upload flow - found bug: stuck on "Uploading document..." screen

### Decisions Made
- **Keep orphan items flat**: Type filtering (`bd list --type=bug`) already provides categorization; epics should group related work, not categories
- **Merge strategy**: Merge main INTO worktree first (resolve conflicts there), then merge back to main (fast-forward)

### Gotchas
- Worktree venvs are gitignored - after deleting worktree, backend venv needed recreation in main
- Can't `git checkout main` from worktree if main is already checked out elsewhere

### In Progress
- Documents Redesign feature merged but has upload flow bug
- Upload stuck at "Uploading document..." step - doesn't progress to OCR/metadata steps

### Next Action
- Debug upload flow: check `use-upload-flow.ts`, `use-document-realtime.ts`, and backend `/api/document/upload` endpoint
- Verify Realtime subscription is receiving status updates from backend

---

## [2026-01-26 14:55] Session 116

**Branch:** main | **Git:** uncommitted (beads only)

### What Happened
- Reviewed Documents Redesign epic (stackdocs-7vb) to crosscheck implementation vs Beads tasks
- Spawned 3 parallel review agents to verify Phase 1-3 completion using context7 for docs
- Phase 1 (Database): Migration `010_document_metadata.sql` and SCHEMA.md updates verified
- Phase 2 (Backend): document_processor_agent, shared read_ocr tool, save_metadata tool, prompts, endpoint all verified
- Phase 3 (Upload Flow): New step types, useDocumentRealtime hook, upload-processing/metadata components, use-upload-flow rewrite verified
- Closed 15 tasks (stackdocs-7vb.1 through 7vb.15) after review confirmation
- Phase 4 (Frontend Cleanup) has 8 remaining open tasks

### Decisions Made
- Review-only session, no coding changes
- Used parallel subagents for efficient verification across 3 phases

### Gotchas
- Orphaned file `backend/app/agents/extraction_agent/tools/read_ocr.py` still exists after DRY refactor (both agents now use shared version)

### Next Action
- Debug upload flow bug (stuck at "Uploading document..." screen)
- Or continue with Phase 4 frontend cleanup tasks

---
## [2026-02-06 08:51] Session 115

**Branch:** main | **Git:** uncommitted (exploration artifacts)

### What Happened
- Brainstormed Stackdocs v2 pivot from multi-tenant SaaS to sovereign agent platform
- Expored architectural overhaul: Vercel/Supabase/FastAPI → Fly.io-only platform
- Validated Sprite-local storage architecture (docs + SQLite on each Sprite)
- Researched v1 codebase with 4 parallel agents to identify patterns to preserve
- Discovered WebSocket timeout issue in current architecture (likely Vercel 10s limit)
- Confirmed cost model: 100GB Sprite storage = $1.97/month cold, $49.85/month hot
- Decided target pricing $100-500/month makes Sprite architecture viable

### Decisions Made
- **Full Fly.io migration**: No Vercel, no Supabase PostgreSQL/Storage, no FastAPI backend
- **Sprite-local storage**: Documents, OCR cache, SQLite all on Sprite filesystem (true isolation)
- **Remove all shared infrastructure**: Only Clerk (auth), Stripe (billing), Anthropic/Mistral (via Gateway proxy)
- **Dual-Pane Canvas UI**: Left pane (chat/missions) + Right pane (real-time agent workspace)
- **Commander + specialist agents**: Orchestrator pattern with Researcher/Analyst/Coder specialists
- **WebSocket bridge**: Gateway proxies browser connections to private Sprites over Fly 6PN network
- **Security proxy**: Gateway injects API keys (ANTHROPIC_API_KEY, Mistral), Sprites never touch keys
- **1-month MVP timeline**: Demo to consulting company, essential features only

### Architecture (v1 → v2)
**Preserve from v1:**
- Tool factory pattern (scoped closures for Sprite security)
- Claude Agent SDK patterns (MCP server, session resume, streaming)
- Frontend patterns (Zustand stores, resizable panels, TanStack Table, agent flow system)
- Session persistence (VARCHAR(50) for Agent SDK)

**New components:**
- Gateway (Next.js 15 + Socket.io): WebSocket server, OCR proxy, security proxy, Clerk auth
- Sprite (Fly.io microVM): Node.js + Agent SDK, SQLite DB, 100GB filesystem, bash/Python access
- Canvas UI: Dual-pane workspace with real-time artifact rendering (tables, markdown, charts)
- WebSocket bridge: Browser ↔ Gateway ↔ Sprite (6PN private network)

**Remove entirely:**
- FastAPI backend (functionality moves to Gateway/Sprites)
- Supabase PostgreSQL (user data moves to Sprite-local SQLite)
- Supabase Storage (documents move to Sprite filesystems)
- Vercel hosting (everything moves to Fly.io for WebSocket support)

### Research Findings
- **Extraction agent**: Already uses Claude Agent SDK, ~1,009 lines, can copy directly to Sprite runtime
- **Database**: Clerk JWT + RLS pattern concept applies to Sprite isolation; `stacks` table → `sprites` with agent_config JSONB
- **Frontend**: Agent flow system extends to Canvas; Supabase Realtime pattern adapts to Sprite WebSocket
- **OCR/Storage**: Mistral OCR integration with signed URLs; move caching from Supabase to Sprite-local
- **WebSocket timeout**: Current architecture has 10s limit (Vercel or Supabase Realtime), Fly.io solves this

### Documents Created
- `.space-agents/exploration/ideas/2026-02-06-stackdocs-v2-sovereign-agents/original-prompt.md`: Initial vision document
- `.space-agents/exploration/ideas/2026-02-06-stackdocs-v2-sovereign-agents/spec.md`: Comprehensive exploration spec with architecture, requirements, constraints, cost model, research summary

### MVP Scope (1-month demo)
**Essential:**
- Single Sprite deployment (manual fly launch)
- Document extraction working (reuse current agents)
- Canvas UI showing results (table/markdown renderer)
- WebSocket bridge streaming live updates
- Bash access demonstration
- Commander + specialist agent architecture

**Stretch:**
- Time travel/checkpoints
- Rich Canvas visualizations (Plotly)
- Multi-agent crews (parallel specialists)
- Terminal view component

**Explicitly out of scope:**
- Multi-user support (demo has 1 hardcoded Sprite)
- Auto-provisioning (manual Sprite deploy)
- Billing integration (architecture demo only)
- Document sharing between Sprites (isolation by design)

### Gotchas
- Vercel WebSocket timeout is real issue (validates Fly.io migration)
- Cost model works: 100GB Sprite = $1.97/month cold storage, viable at $100-500 pricing
- No code changes this session (exploration only)
- Existing v1 codebase patterns largely reusable with adaptation

### Next Action
- Run `/plan` to create implementation tasks from spec.md
- Phase 1: Monorepo setup + Gateway scaffold
- Phase 2: Sprite runtime + Commander agent
- Phase 3: WebSocket bridge + Canvas UI foundation
- Phase 4: OCR proxy + document extraction flow
- Phase 5: Multi-agent crews + bash demonstration
- Phase 6: Stretch goals

---

## [2026-02-06 09:30] Session 116

**Branch:** main | **Git:** uncommitted (spec artifact)

### What Happened
- Deep brainstorm session to revise Stackdocs v2 architecture from previous session's spec
- Dispatched 4 parallel research agents to comprehensively analyze the current codebase:
  - Frontend: App Router structure, agent flow system, Zustand stores, Supabase Realtime hooks, SSE consumption patterns
  - Backend: Agent SDK usage, tool factory pattern, MCP server registration, SSE streaming, session resume
  - Database: Full schema (8 tables, 10 migrations, RPC functions, RLS policies, storage bucket)
  - Integrations: Clerk auth flow, Mistral OCR, Anthropic API, real-time communication channels
- Worked through 6 major architecture decisions with Fraser (see Decisions Made)
- Researched Sprites.dev (Fly.io's new product, launched Jan 2026) — significantly different from Fly Machines
- Created comprehensive revised spec at `.space-agents/exploration/ideas/2026-02-06-stackdocs-v2-revised-architecture/spec.md`

### Decisions Made
1. **Python on Sprites** (not Node.js) — Preserve existing agent code (~1000 lines), avoid rewrite
2. **Keep Supabase (trimmed)** — Strip to just `users` table with sprite mapping, billing, usage
3. **Keep Vercel for frontend** — SSR, CDN, zero-config stays. Browser connects to Fly.io Bridge for WebSocket
4. **Raw `ws` library** (not Socket.io) — 1:1 user-to-Sprite mapping, standard protocol
5. **Sprites.dev for per-user VMs** — No Docker images; auto-sleep, checkpoints, 100GB persistent storage
6. **One repo** — Add `bridge/` and `sprite/` alongside `frontend/` and `backend/`

### Key Architecture
- Vercel (www.stackdocs.io) — Next.js frontend, Clerk auth
- Fly.io Bridge (ws.stackdocs.io) — ~300 line Node.js WS proxy, API key injection
- Sprites.dev (per-user) — Python runtime, Claude Agent SDK, SQLite, 100GB filesystem

### Gotchas
- Sprites.dev does NOT use Docker images — standardized base Linux, code deployed via API
- Sprites auto-sleep after 30s inactivity — need reconnection handling
- Clerk JWT expires every 60s — 50s refresh pattern must carry to WebSocket connections
- PostgreSQL TEXT[] arrays have no SQLite equivalent — must use JSON arrays

### Documents Created
- `.space-agents/exploration/ideas/2026-02-06-stackdocs-v2-revised-architecture/spec.md`

### Next Action
- `/brainstorm` Canvas UI design and MVP scope refinement
- Then `/plan` to create implementation tasks from revised spec
- Test Sprites.dev API: create sprite, exec commands, filesystem writes

---

## [2026-02-06 12:30] Session 117

**Branch:** main | **Git:** uncommitted (spec update)

### What Happened
- Finalized the Stackdocs v2 architecture spec — resolved ALL open questions from Session 116
- Deep research via 4 subagents: Sprites.dev checkpoint behavior, OpenClaw memory architecture, Claude PDF capabilities, Openclaw gateway patterns
- Worked through every architecture decision interactively with Fraser
- Crystallized the core vision: "The agent IS the operating system" — Stackdocs v2 is a personal AI computer, not a SaaS
- Updated spec at `.space-agents/exploration/ideas/2026-02-06-stackdocs-v2-revised-architecture/spec.md` — now comprehensive with all decisions captured
- Updated MEMORY.md with "THE VISION" section at top so future sessions understand immediately

### Decisions Made
1. **Bridge-to-Sprite: TCP Proxy + Services API** (Option B) — WS server on Sprite defined as a Service, auto-restarts on wake, Bridge reconnects via TCP Proxy
2. **One Sprite per STACK** (not per user) — each stack is its own isolated VM. Free tier: 1 stack. Stacks fully isolated for MVP.
3. **Canvas UI merged from Jan 25 exploration** — React Flow, 3 window types (document, table, notes), nested canvas_update messages, subbar as taskbar
4. **Full OpenClaw memory adoption** — soul.md (stack config), user.md (user prefs), MEMORY.md (global), daily journals, JSONL audit, heartbeat, pre-compaction flush, hybrid BM25+vector search via SQLite FTS5
5. **API keys on Sprite** (env vars at Service start) — NOT proxied through Bridge. Simplifies pipeline from 17 steps to ~6.
6. **Both Claude PDF + Mistral OCR** — agent decides which to use per document. Claude is simpler (one API), Mistral is cheaper ($2 vs $6.50 per 1K pages) and better for tables (96.6%). "Computer not SaaS" model.
7. **JWT validated on WS connect only** — trust the connection, Clerk webhook for revocation. No 50s refresh timer.
8. **Simple async lock** for MVP gateway (not full lane queue)
9. **Base64 JSON** for file uploads over WebSocket (25MB limit)
10. **Git pull + Service restart** for code deployment to Sprites
11. **Full Claude Agent SDK on Sprite** — Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, subagents, MCP, hooks. Same capabilities as Claude Code.
12. **Two-way gateway vision** — inbound (chat, files, webhooks, cron, heartbeat) + outbound (Canvas, API calls, exports, notifications)

### Gotchas
- Sprites.dev processes are KILLED on sleep, not frozen (no CRIU). Filesystem-only persistence.
- Services auto-restart on wake has MEDIUM confidence — test during Phase 1
- TCP connections die on every sleep/wake — Bridge MUST handle reconnection
- 30s auto-sleep is aggressive — need keepalive pings from Bridge during active sessions
- Cold wake time is 1-12 seconds — UI needs to handle this gracefully ("Sprite waking...")
- Early reliability issues in Sprites.dev community (Jan/Feb 2026)
- sftp-server mount to Openclaw was disconnected — couldn't read files directly, used web search instead

### Documents Created
- Updated: `.space-agents/exploration/ideas/2026-02-06-stackdocs-v2-revised-architecture/spec.md` (comprehensive, all sections finalized)
- Updated: `.claude/projects/-Users-fraserbrown-stackdocs/memory/MEMORY.md` (added THE VISION section)

### Next Action
- `/plan` to create implementation tasks from the finalized spec
- Phase 1: Bridge + Sprite scaffold (Fly.io Machine, Sprites API, TCP Proxy)
- Need Fly.io account and Sprites.dev API token before implementation

---

## [2026-02-06 14:30] Session 118

**Branch:** main | **Git:** uncommitted (spec update)

### What Happened
- Full architecture review of the v2 spec before committing to `/plan`
- Walked through every major system boundary: Bridge scaling, file uploads, Sprite lifecycle, API keys, Canvas awareness, pre-compaction, message protocol, SQLite concurrency, Sprite provisioning, frontend routing, v1 migration
- Sent research agent to investigate Claude Agent SDK compaction support — found server-side compaction beta (`compact-2026-01-12`) with `pause_after_compaction` hook, but `claude-agent-sdk` doesn't expose it
- Updated spec at `.space-agents/exploration/ideas/2026-02-06-stackdocs-v2-revised-architecture/spec.md` with all findings

### Decisions Made
1. **Bridge scaling**: Single Fly.io Machine for MVP, horizontally scalable by design (connection state only)
2. **File uploads**: Base64 over WS is fine — per-user connections, most files 1-5MB, no cross-user blocking
3. **API keys**: Platform keys for MVP, BYOK post-MVP
4. **Sprite provisioning**: Lazy — created on first stack open, not at signup
5. **Message IDs**: Mandatory UUIDs on all WS messages, `request_id` for response correlation
6. **Canvas**: Two-way awareness — agent receives Canvas state at session start + user interactions
7. **Pre-compaction flush**: Deferred to post-MVP (requires raw Anthropic SDK, claude-agent-sdk doesn't expose compaction controls)
8. **SQLite**: WAL mode, serialize subagent writes through main agent or write queue
9. **Frontend**: Build v2 into existing repo as spike, reuse shadcn/Clerk/chat bar components
10. **v1 migration**: Clean slate — no existing users, no migration needed

### Gotchas
- `claude-agent-sdk` wraps Claude Code and does NOT expose compaction/token management APIs — for pre-compaction flush, need raw `anthropic` SDK with custom agentic loop (post-MVP)
- Server-side compaction beta (`compact-2026-01-12`) only supports Opus 4.6 currently
- Minimum compaction threshold is 50,000 tokens

### Next Action
- `/plan` to create implementation tasks from the finalized + reviewed spec
- Phase 1 should be Sprites.dev proof-of-concept (validate Service auto-restart on wake)

---

## [2026-02-06 15:45] Session 119

**Branch:** main | **Git:** uncommitted (plan.md + folder move)

### What Happened
- Ran `/exploration-plan` (Mode 1: Plan from Brainstorm) against the finalized v2 architecture spec
- Read full 900-line spec at `.space-agents/exploration/planned/2026-02-06-stackdocs-v2-revised-architecture/spec.md`
- Convened planning council: 3 parallel agents analyzed the spec
  - **Task Planner**: Broke spec into 37 tasks across 5 phases with file-level specificity and risk flags
  - **Sequencer**: Full dependency graph, critical path (17 sequential tasks), parallel opportunities, risk register, solo developer scheduling advice
  - **Implementer**: Detailed TDD breakdowns with actual test code for Phases 1-2 (Bridge + Sprite runtime), including package lists, file trees, testing strategy
- Synthesized council reports into consolidated plan: 28 tasks across 5 phases
- Wrote `plan.md` at `.space-agents/exploration/planned/2026-02-06-stackdocs-v2-revised-architecture/plan.md`
- Moved exploration folder from `ideas/` to `planned/`

### Decisions Made
1. **28 tasks (not 37)**: Consolidated small tasks into meaningful session-sized chunks
2. **File upload moved to Phase 4**: Upload without extraction is meaningless — keep them together
3. **Memory split into basic (Phase 2) + search (Phase 5)**: Basic = load files into prompt. Search = FTS5 index.
4. **Real Sprites from day one**: Fraser prefers developing against real Sprites.dev rather than mock servers. Phase 0 pre-flight is critical.
5. **Accepted sequencer's 3 reordering recommendations**: Start Canvas earlier (parallel with Phase 2), pull Status UI into Phase 3, defer Clerk webhook to Phase 5
6. **Export in Phase 4 (not Phase 5)**: Trivial client-side code that completes the demo flow

### Gotchas
- Implementer suggested mock Sprite server for local dev — Fraser explicitly declined, wants real Sprites. This means Phase 0 pre-flight (account setup, API validation, auto-restart test) is a hard gate.
- Council agents take 3-6 minutes each on Opus — budget for this when convening council

### Next Action
- Create Beads from plan.md (28 tasks as tracked issues with dependencies)
- Then Phase 0: Fly.io + Sprites.dev account setup and API validation

---

## [2026-02-06 17:30] Session 120

**Branch:** main | **Git:** uncommitted (CLAUDE.md + plan folder moves)

### What Happened
- Reviewed the v2 implementation plan (`plan.md`) against the architecture spec (`spec.md`)
- Identified 5 issues with the plan and applied all 5 fixes:
  1. Phase 0 pre-flight promoted from manual checklist to a tracked Bead task with steps and output file
  2. Basic memory system dependency fixed: now depends on Agent runtime (not just Sprite WS server) since memory tools need agent runtime to register
  3. Post-MVP compaction note added to Agent runtime task to prevent scope creep
  4. Code deployment strategy added as step 9 in golden checkpoint task (how does sprite/ code reach running Sprites?)
  5. Window types split: table-window (critical path for extraction results) separated from document/notes-window (can follow independently)
- Added TDD `**Tests:**` sections to all 29 tasks — each task now has verifiable acceptance criteria for the builder agent
- Created full Beads structure: 1 epic + 6 features + 29 tasks = 36 issues with 24 dependency links
- Moved plan folder from `exploration/planned/` to `mission/staged/m7b-stackdocs-v2-sovereign-agent-platform/`
- Updated root `CLAUDE.md` from v1 to v2: new architecture diagram, three-codebase structure (frontend/bridge/sprite), Sprite/Bridge/Canvas patterns, trimmed Supabase to platform-only

### Decisions Made
1. **29 tasks (not 28)**: Phase 0 pre-flight added as tracked task, window types split added one more
2. **Phase 2 reduced to 5 tasks**: Memory system dependency moved to after Agent runtime
3. **Phase 3 grew to 8 tasks**: Table window split from document/notes for critical path de-risking
4. **TDD on every task**: Builder agent can verify each task against its Tests checklist

### Next Action
- Phase 0: Pre-flight validation — Fly.io account + Sprites.dev account + API testing
- Can also start in parallel: Define WebSocket message protocol + React Flow canvas (both unblocked)

---
