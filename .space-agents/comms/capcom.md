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

## [2026-02-06 18:15] Session 121

**Branch:** main | **Git:** uncommitted (spec.md + plan.md + beads)

### What Happened
- **Brainstorm: Composable Card System (A2UI-inspired)** — Fraser found Google's A2UI project (agent-driven declarative UI) and asked if it could be the missing link for the Canvas
- Evaluated A2UI against Stackdocs v2 spec. Conclusion: right concept (declarative agent-driven UI), wrong dependency (v0.8, multi-agent mesh focus, solves problems we don't have)
- Decided on **Option C: A2UI-inspired, custom protocol** — composable cards with a block catalog
- Designed MVP block catalog (8 data-focused types): `heading`, `stat`, `key-value`, `table`, `badge`, `progress`, `text`, `separator`
- Each block maps to a shadcn component, agent composes cards from blocks, frontend renders via `card-renderer.tsx`
- **Updated spec.md** — Replaced fixed window types (table/document/notes) with composable card system throughout: Canvas UI requirements, WebSocket protocol (`CanvasUpdate` now uses `create_card`/`update_card`/`close_card` with `Block[]` array), Canvas UI Architecture section (complete rewrite with block catalog table), data flow, success criteria
- **Updated plan.md** — Revised all affected tasks: protocol task adds Block types, canvas tools use card commands, Phase 3 tasks renamed (React Flow → base card component, Table window → MVP block components), doc/notes task deferred (notes covered by text-block, PDF viewer post-MVP), all Phase 4 tasks updated window→card refs. Total: 29→28 active tasks.
- **Updated 13 beads** — m7b.2.1 (protocol), m7b.3.4 (canvas tools), m7b.4-m7b.4.8 (all Phase 3), m7b.5.1-m7b.5.3 (all Phase 4). Closed m7b.4.4 as deferred. Verified all beads match plan.md via subagent audit.
- **Researched AG-UI protocol** (CopilotKit) — event-based agent↔frontend protocol with 16+ event types, state sync via JSON Patch. Concluded: our custom protocol maps 1:1 to AG-UI concepts, keep custom for MVP, migrate later if needed.
- **Researched CopilotKit Generative UI** — three types: static, declarative, open-ended. Our block catalog = declarative. Open-ended (agent generates arbitrary UI) is additive post-MVP extension, not a rewrite.

### Decisions Made
1. **Composable card system over fixed window types** — agent composes cards from block catalog instead of selecting from 3 hardcoded window types (table/document/notes)
2. **Custom protocol over A2UI** — take the declarative catalog concept but no external dependency on v0.8 spec
3. **Custom protocol over AG-UI** — simpler for MVP (6 message types vs 16+ events), concepts map 1:1 for future migration
4. **Doc/notes window task deferred** — notes covered by text-block, PDF viewer post-MVP
5. **Open-ended generative UI is post-MVP** — architecture supports adding it (html/react block type) without protocol changes

### Next Action
- Phase 0: Pre-flight validation (Fly.io + Sprites.dev) — the mandatory gate
- In parallel: Define WebSocket message protocol (now includes Block types) + React Flow canvas and base card component (both unblocked)

---

## [2026-02-06 19:00] Session 122

**Branch:** main | **Git:** uncommitted (spec, plan, CLAUDE.md, beads, new docs/ops/)

### What Happened
- **Phase 0: Pre-flight Validation — COMPLETE (PASS)**
- Installed Sprites CLI v0.0.1-rc31, configured auth with Fraser's API token
- Created test sprite `preflight-test`, tested all core APIs: create (201, 1.06s), exec cold (200, 1.12s), exec warm (200, 466ms), get status (200, 165-230ms), TCP Proxy (101, 972ms connect)
- **TCP Proxy end-to-end test**: Python asyncio TCP server on port 8765, connected via `WSS /v1/sprites/{name}/proxy` + `ProxyInitMessage`, bidirectional JSON messaging confirmed (greeting + echo)
- **Critical finding: process persistence through sleep/wake** — ran 4 iterations of sleep/wake test. v4 (clean test) proved it: sprite status changed to `warm` (was sleeping), server alive with same PID 28. Sprites.dev uses checkpoint/CRIU, NOT filesystem-only persistence.
- **Services API bug found**: `PUT /v1/sprites/{name}/services/{name}` returns 400 "service name required" regardless of body format. Tried 10+ variations. Non-blocking — process persistence eliminates the need.
- Measured AU latency: avg 180ms API, ~200ms message RTT (within <200ms target)
- Created `docs/ops/preflight-results.md` — full test results, findings, gate decision
- Created `docs/ops/sprites-api-reference.md` — comprehensive API reference from research + testing (exec WS protocol, TCP Proxy flow, CLI commands, Stackdocs usage pattern)
- Updated `spec.md` (6 edits): corrected Sprites behavior (frozen not killed), resolved 2 open questions (latency + auto-restart), updated research section with tested findings
- Updated `plan.md` (2 edits): marked Task 0.1 complete, updated risk register (2 risks resolved)
- Updated `CLAUDE.md` (3 edits): corrected architecture diagram, key patterns, reminders
- Updated `MEMORY.md` (5 edits): updated Sprites facts, architecture, plan status, beads counts
- Updated 4 beads (m7b.2.3, m7b.2.4, m7b.2.5, m7b.2.7): removed Services API dependency, added exec startup strategy with `max_run_after_disconnect=0`
- Closed 2 beads: m7b.1.1 (pre-flight task), m7b.1 (Phase 0 feature)
- Deleted test sprite `preflight-test` (cleanup)

### Decisions Made
1. **Server lifecycle via exec, not Services API** — `exec` WS with `max_run_after_disconnect=0` starts server that persists indefinitely through sleep/wake. Services API is buggy and unnecessary.
2. **Process persistence changes architecture** — Bridge only needs to reconnect TCP Proxy after wake, NOT restart server. Exec restart is crash-only fallback.
3. **Services API bug is non-blocking** — filed as known issue, not a blocker for any phase.

### Gotchas
- **Active exec sessions keep sprite awake** — the 30s auto-sleep timer won't fire while an exec session with `is_active: true` exists. The `sprite exec` CLI creates persistent sessions. Must disconnect or kill sessions for sprite to sleep.
- **Exec API is WebSocket, not REST** — returns `application/octet-stream` with binary multiplexing (stream ID byte prefix). CLI decodes it; raw curl shows garbage.
- **List sprites endpoint resets sleep timer** — even `GET /v1/sprites` (not targeting specific sprite) may keep sprites alive. Don't poll status during sleep tests.
- **Services API `cmd` not `command`** — docs say `cmd` field, not `command`. But it doesn't matter since the API is broken regardless.

### Next Action
- Phase 1: Infrastructure Scaffold (9 tasks, 10 ready to work)
- Start with: Define WebSocket message protocol (m7b.2.1) + React Flow canvas and base card (m7b.4.2) — both unblocked, can run in parallel

---

## [2026-02-06 23:10] Session 123

**Branch:** main | **Git:** uncommitted (protocol.py fix, beads)

### What Happened
- **Phase 1: Infrastructure Scaffold (m7b.2) — ACTIVATED, 2/9 tasks complete**
- Ran orchestrated mission mode: Scout → Worker → Inspector cycle for each task

**Task m7b.2.1: Define WebSocket message protocol — COMPLETE**
- Created `bridge/src/protocol.ts` (449 lines) — TypeScript source of truth
- Created `frontend/types/ws-protocol.ts` — frontend copy, imports `DocumentStatus` from `./documents` to avoid barrel collision
- Created `sprite/src/protocol.py` (582 lines) — Python dataclasses matching TS exactly
- All 8 message types (4 browser→sprite, 4 sprite→browser), 8 block types (composable card system)
- Mandatory `id` (UUID) + `timestamp` on every message, type guard functions, `parseMessage()` utility
- Fixed Pyright issue: replaced `hasattr()` union narrowing with `message.type == "canvas_update"` check
- Inspector: PASS (7/7 requirements, quality clean)

**Task m7b.2.2: Create Bridge project scaffold and WS server — COMPLETE**
- Created `bridge/src/index.ts` (292 lines) — HTTP server, WS upgrade on `/ws/{stack_id}`, connection tracking
- Created `bridge/src/auth.ts` (170 lines) — Clerk JWT validation via `@clerk/backend` `verifyToken()`, Supabase stack ownership lookup
- Created `bridge/Dockerfile` (multi-stage Node 22), `bridge/fly.toml` (256MB, syd region)
- Created `bridge/tests/auth.test.ts` (13 tests) + `bridge/tests/server.test.ts` (13 tests) — 26/26 pass
- Auth flow: first message must be `type: 'auth'` with JWT, 10s timeout, 4001 (invalid JWT), 4003 (unauthorized stack)
- Connection map: `Map<connectionId, { userId, stackId, spriteName, spriteStatus }>`
- Inspector: PASS (6/6 requirements; info-level note about line count — protocol.ts inflates count, actual Bridge logic is ~462 lines)

### Decisions Made
1. **Barrel export strategy for DocumentStatus** — `ws-protocol.ts` uses `import type` from `./documents` rather than redefining. `export *` in index.ts works because `import type` doesn't re-export.
2. **Protocol types stay as copies (not shared package)** — Inspector suggested `@stackdocs/protocol` package. Deferred as YAGNI for MVP. Current copy approach documented in each file.
3. **Pyright narrowing via type check** — `message.type == "canvas_update"` instead of `hasattr(message.payload, "blocks")` for proper union type narrowing.

### In Progress
- **m7b.2.4 (golden checkpoint)** was next but requires live Sprites.dev interaction — paused for user decision on approach (manual vs automated via CLI)
- **m7b.2.3 (Sprites API client)** is now unblocked (depends on m7b.2.2 which is done)

### Next Action
- Continue Phase 1: m7b.2.3 (Sprites API client + provisioning) is unblocked
- Decide approach for m7b.2.4 (golden checkpoint) — manual procedure vs Sprites CLI automation
- m7b.2.9 (Supabase migration) also unblocked and independent

---

## [2026-02-07 12:30] Session 124

**Branch:** main | **Git:** uncommitted (sprite/ new files, bridge commits)

### What Happened
- **Phase 1: Infrastructure Scaffold (m7b.2) — 5/9 tasks complete** (was 2/9 at start)
- Orchestrated mission mode: Scout → Worker → Inspector cycle for each task

**Task m7b.2.3: Sprites API client and provisioning — COMPLETE**
- Created `bridge/src/sprites-client.ts` (150 lines) — REST API client wrapping Sprites.dev (create, get, delete, checkpoints, exec URL builder, proxy URL builder). Native fetch, singleton config pattern.
- Created `bridge/src/provisioning.ts` (143 lines) — Lazy provisioning flow: `pending` → `provisioning` → `active` in Supabase. Failure → `failed`, retry on next connect. API keys injected as env vars via exec URL.
- 29 new tests (14 + 15), all passing. Inspector PASS 6/6.

**Task m7b.2.5: Sprite Python WebSocket server — COMPLETE**
- Created `sprite/src/server.py` (60 lines) — asyncio WebSocket server on port 8765 using `websockets` library. Graceful shutdown on SIGTERM/SIGINT.
- Created `sprite/src/gateway.py` (113 lines) — `SpriteGateway` with match/case routing. Mission + heartbeat share async lock (serial). File upload, canvas, auth, system run concurrently. Stub handlers: log + echo ack.
- Created `sprite/requirements.txt`, `sprite/pyproject.toml` (pytest-asyncio auto mode)
- Python venv at `sprite/.venv/` — user caught a bare `pip install` and stopped the agent. Fixed.
- 11 tests passing. Inspector PASS 5/5.

**Task m7b.2.6: Bridge TCP Proxy and message forwarding — COMPLETE**
- Created `bridge/src/sprite-connection.ts` (123 lines) — `SpriteConnection` class managing TCP Proxy WebSocket to Sprite. Handles ProxyInitMessage handshake, state machine (connecting→connected→closed), send/close/callbacks.
- Created `bridge/src/proxy.ts` (85 lines) — Connection tracking per stack_id, `forwardToSprite()`, `broadcastToBrowsers()`, `disconnectSprite()`.
- Modified `bridge/src/index.ts` — Wired up Sprite connection after auth, message forwarding, disconnect on last browser close.
- Created `bridge/src/connection-store.ts` (79 lines) — Extracted browser connection store to break circular dependency between index.ts ↔ proxy.ts (Inspector recommendation, fixed same session).
- 10 new proxy tests, 65 total bridge tests passing. Inspector PASS 4/5 (request_id pass-through works implicitly).

### Decisions Made
1. **Venv for sprite/ development** — Never bare `pip install`. Always `python3 -m venv .venv` first.
2. **m7b.2.5 closed before m7b.2.4** — Golden checkpoint blocks deployment but not code writing. Closed with `--force`.
3. **Circular dep fix** — Extracted `connection-store.ts` from `index.ts` so `proxy.ts` doesn't import from `index.ts`.
4. **request_id handling** — Raw messages forwarded as-is, preserving any existing `request_id`. No active injection needed.

### Gotchas
- Worker agents will try bare `pip install` on macOS. Must explicitly instruct them to use venv.
- `pytest-asyncio` 1.3.0 defaults to strict mode — needs `asyncio_mode = "auto"` in pyproject.toml.
- Pyright can't resolve `websockets` imports when package is only in venv — expected, not a real error.

### Next Action
- Continue Phase 1: **m7b.2.7** (sleep/wake reconnection + keepalive) is now unblocked
- **m7b.2.4** (golden checkpoint) needs live Sprites.dev interaction
- **m7b.2.9** (Supabase migration) is independent
- **ag6** (protocol/Bridge bloat review) still open

---

## [2026-02-07 18:30] Session 125

**Branch:** main | **Git:** clean (pushed)

### What Happened
- **Task m7b.2.4 (golden checkpoint) — IN PROGRESS, ~80% done**
- Created `stackdocs-golden` sprite on Sprites.dev via REST API
- Installed packages into `/workspace/.venv/` (websockets, aiosqlite, anthropic, mistralai, httpx, claude-code-sdk)
- Deployed `sprite/src/` code (server.py, gateway.py, protocol.py) via tar pipe
- Initialized SQLite database at `/workspace/agent.db` with full schema (documents, ocr_results, extractions, memory_fts)
- Created memory templates (soul.md, user.md, MEMORY.md) in `/workspace/memory/`
- Added `/workspace/VERSION` file (value: 1), saved checkpoint v2
- **Discovered cross-sprite checkpoint cloning NOT possible** — checkpoints scoped per-sprite
- Pivoted from "clone golden checkpoint" to "bootstrap + lazy update on wake" strategy
- Created `bridge/src/bootstrap.ts` (~140 lines) — bootstraps fresh sprites with full env
- Created `bridge/src/updater.ts` (~90 lines) — reads VERSION via FS API, deploys updates if outdated
- Created `bridge/src/sprite-exec.ts` (~35 lines) — shared CLI exec helper (DRY extraction)
- Added `readFile()` / `writeFile()` to `bridge/src/sprites-client.ts` (FS API wrappers)
- Updated `bridge/src/provisioning.ts` — removed checkpoint TODO, calls `bootstrapSprite()`, removed dead `ProvisionConfig.goldenCheckpointId`, updated `DEFAULT_SERVER_CMD` to venv path
- Fixed `bridge/src/reconnect.ts:113` — Python path was `['python', '-m', 'src.server']`, now uses venv path
- Sent review subagent — caught 5 issues, all resolved same session
- **75/75 bridge tests passing**

### Decisions Made
1. **Global install OK on Sprite VMs** — isolated single-purpose VMs, but we use venv anyway for clean update management
2. **Bootstrap over checkpoint cloning** — Sprites.dev doesn't support cross-sprite restore. Bootstrap takes ~30-60s per new sprite.
3. **Lazy update on wake** — Bridge reads `/workspace/VERSION` when connecting. If behind `CURRENT_VERSION`, deploys new code + deps. Only active sprites get updated.
4. **Separate code from data** — `/workspace/src/` and `.venv/` are deployable, user data never touched by updates.
5. **Keep checkpoint functions in sprites-client** — still useful for per-sprite state management.

### Gotchas
- `sprite exec` CLI commands kept getting interrupted in Cursor — unclear cause. FS write API works as alternative.
- `SPRITES_TOKEN` not in shell env — must inline token each session.
- `python3 -m venv` needs `sudo apt-get install python3.13-venv` on Sprite Ubuntu 25.04.
- macOS tar creates `._` metadata files — clean up after extract.
- Sprites.dev checkpoint POST API returns 405 — use CLI `sprite checkpoint create` instead.

### In Progress
- `test-clone` sprite exists on Sprites.dev (blank) — ready for bootstrap test
- Tasks 3 (test bootstrap) and 4 (document procedure) remain for m7b.2.4
- `updater.ts` built but not wired into connection flow yet

### Next Action
- Continue redundant code review (Fraser requested)
- Test bootstrap on `test-clone` sprite
- Document provisioning procedure in `docs/ops/golden-checkpoint.md`
- Close m7b.2.4, then tackle m7b.2.8 (E2E smoke test)

---

## [2026-02-07 23:45] Session 126

**Branch:** main | **Git:** clean (pushed)

### What Happened
- **m7b.3.1 (SQLite database layer) — COMPLETE**
  - Pathfinder explored codebase, confirmed `bridge/src/bootstrap.ts` lines 47-94 as schema DDL source of truth
  - Builder created `sprite/src/database.py` (97 lines) — async Database class wrapping aiosqlite
  - WAL mode, foreign keys, dict row factory, async context manager
  - Schema DDL copied verbatim from bootstrap.ts — Inspector verified character-for-character match
  - Builder created `sprite/tests/test_database.py` (225 lines) — 18 tests, all passing
  - Inspector pass: 6/6 requirements met, quality pass, no bloat
  - Fixed minor cosmetic issue (duplicate value in SQL IN clause)
  - Created `sprite/.venv/` for local test execution

- **m7b.3.2 (Port tool factories) — CLOSED AS OBSOLETE**
  - Brainstorming session with Fraser fundamentally rethought the approach
  - v1 tool factories existed because agent was sandboxed (no Bash, no filesystem)
  - v2 agent runs on a VM with full Bash/Read/Write — just like Claude Code
  - No need for `create_tools()`, `save_extraction`, `set_field`, etc.
  - Agent will query SQLite via `sqlite3` CLI, read/write files directly
  - Custom tools only where they add real value: OCR (external API), Canvas (WS messages)
  - Extraction logic absorbed by: m7b.3.3 (runtime), m7b.3.4 (canvas tools), m7b.3.5 (soul.md)
  - OCR tool deferred to Phase 4 (upload + extraction)

- **m7b.3.6 (API key proxy) — SKIPPED** for this session, still in_progress

### Decisions Made
1. **Agent = Claude Code on a VM.** The Sprite agent uses Bash, Read, Write as primary tools — no tool factories. Custom tools only for OCR (external API) and Canvas (WS messages to browser). This is the "personal AI computer" vision realized.
2. **One agent, not two.** v1 had extraction_agent + stack_agent. v2 has one persistent agent per stack that handles everything: chat, extraction, corrections, memory.
3. **soul.md = CLAUDE.md equivalent.** The agent's system prompt tells it about the schema, file locations, how to do extractions. Replaces v1's `prompts.py`.
4. **OCR as a hook, not a tool (maybe).** Fraser suggested OCR could auto-run on upload as a hook, storing text on the VM for the agent. To be explored in Phase 4.
5. **No background agents.** Previous session had issues with CC spawning two background agents. All orchestrated mode work done in foreground only.

### Next Action
- Start m7b.3.3 (Agent runtime with WebSocket output) — the core of the Sprite agent. Wire Claude Agent SDK with Bash/Read/Write tools, connect to WebSocket for I/O.

---

## [2026-02-08 00:30] Session 128

**Branch:** main | **Git:** uncommitted changes

### What Happened
- **m7b.3.6 (API key proxy) — COMPLETE**
  - Pathfinder: deep security analysis of v1 vs v2 threat model (prompt injection with full Bash access)
  - Design decisions confirmed with Fraser: (A) shared SPRITES_PROXY_TOKEN, proxy both Anthropic + Mistral, defer rate limiting
  - Builder created `bridge/src/api-proxy.ts` (130 lines) — HTTP reverse proxy with streaming SSE support
  - Modified `bridge/src/index.ts` (+7 lines route), `bridge/src/provisioning.ts` (env vars for Sprites)
  - 10 tests in `bridge/tests/api-proxy.test.ts`, all passing
  - Inspector: 10/10 requirements pass, quality pass
  - Key insight: Sprites set `ANTHROPIC_BASE_URL` to Bridge proxy, `ANTHROPIC_API_KEY` to proxy token. Real keys only on Bridge.

- **m7b.3.3 (Agent runtime with WebSocket output) — CODE COMPLETE, TESTING BLOCKED**
  - Pathfinder: explored Claude Agent SDK, v1 reference code, existing Sprite code
  - Builder created `sprite/src/runtime.py` (141 lines) — AgentRuntime wrapping ClaudeSDKClient
  - Event mapping: TextBlock→text, ToolUseBlock→tool, ResultMessage→complete, Exception→error
  - Session resume via `ClaudeAgentOptions(resume=session_id)`
  - 12 tests in `sprite/tests/test_runtime.py`, all passing
  - Inspector: 9/9 pass, quality pass. Fixed double-locking (gateway+runtime), removed dead test code
  - Modified gateway.py (wired runtime), server.py (Database lifecycle), bootstrap.ts (deploy list, VERSION bump)
  - **Key discovery**: claude-agent-sdk bundles the claude CLI binary — no npm/Node.js needed on Sprites!

- **Bridge redeployed** to Fly.io with api-proxy + bootstrap changes
  - Set Fly.io secrets: SPRITES_PROXY_TOKEN, ANTHROPIC_API_KEY, MISTRAL_API_KEY
  - Proxy endpoint verified: `curl https://ws.stackdocs.io/v1/proxy/anthropic/v1/messages` → 401 (correct)

- **E2E testing — partially working, blocked on comms**
  - Created `sd-e2e-test` Sprite, fully bootstrapped (VERSION=2, all packages)
  - Server starts, listens on port 8765, Database connects
  - TCP proxy connects: `{"status":"connected","target":"10.0.0.1:8765"}`
  - From INSIDE Sprite: gateway receives mission, SDK launches bundled claude binary
  - **BUT**: no agent_event messages stream back within 60s timeout
  - Created P0 bug `stackdocs-kfn` blocking m7b.3.3, m7b.3.4, m7b.3.5

### Decisions Made
1. **Shared SPRITES_PROXY_TOKEN** for MVP. Per-sprite tokens deferred.
2. **Proxy both Anthropic + Mistral** in one pass — 90% shared code.
3. **Rate limiting deferred** to post-MVP. Abuse vector (agent curling proxy) acceptable.
4. **No MCP servers for extraction tools** — confirmed m7b.3.2 close decision. Agent uses built-in Bash/Read/Write.
5. **Server command changed** to `bash -c 'cd /workspace && python3 -m src.server'` — relative imports require module-style execution.

### Gotchas
1. **Timestamp must be numeric**: `is_websocket_message()` validates `timestamp` as `int|float` (Unix epoch ms). ISO strings fail silently → "Invalid message structure" warning.
2. **Port 8765 survives Sprite sleep/wake**: Old server processes persist via CRIU checkpoint. Must `kill` before restart.
3. **TCP proxy init has two responses**: `{type:"port_opened"}` then `{status:"connected"}`. Bridge sprite-connection.ts only checks the second.
4. **claude-agent-sdk bundles the CLI**: No npm install needed. Binary at `_bundled/claude` in the pip package.
5. **Sprites.dev exec messages**: stdout comes as plain text lines, not JSON-wrapped `{type:"stdout",data:"..."}` — exec WS message parsing must handle both.

### In Progress
- **stackdocs-kfn** (P0): Sprite↔Bridge WebSocket communication through TCP proxy not working end-to-end. Two issues: (1) TCP proxy WS frame forwarding unclear, (2) Agent SDK launches but no events stream back even from inside Sprite.

### Next Action
- Debug the two comms issues in stackdocs-kfn. Start from inside the Sprite: verify SDK can call Anthropic via proxy (test ANTHROPIC_BASE_URL + proxy token auth chain). Then fix TCP proxy message forwarding.

---

## [2026-02-08 08:30] Session 129

**Branch:** main | **Git:** uncommitted changes

### What Happened
- **stackdocs-kfn (P0 bug) — THREE root causes found and fixed:**

  1. **Bridge proxy auth mismatch (FIXED, DEPLOYED)**: `api-proxy.ts:64-75` only checked `Authorization: Bearer` header for proxy token, but Anthropic SDK sends `x-api-key`. Added dual-header check. Also `x-api-key` was in `STRIPPED_HEADERS` — validation now runs before stripping. 2 new tests added to `api-proxy.test.ts`.

  2. **Server protocol mismatch (FIXED)**: Local `sprite/src/server.py` used `websockets.asyncio.server.serve` (WebSocket protocol), but the Sprite had a TCP server using `asyncio.start_server`. The TCP server is correct because the Sprites.dev TCP proxy creates raw TCP connections. Updated local code to match Sprite's TCP server.

  3. **TCP proxy binary frames (FIXED, DEPLOYED)**: Sprites.dev TCP proxy only forwards **binary** WebSocket frames, not text frames. Our `sprite-connection.ts` sent text frames via `ws.send(string)` — proxy silently dropped them. Fixed to `ws.send(Buffer.from(data + '\n', 'utf-8'))`. Confirmed via official `@fly/sprites` SDK source which does the same. Also handles incoming binary frames with newline splitting.

- **Agent runtime VERIFIED WORKING from inside Sprite**: Raw TCP test sent mission "What is 2+2?", received `[agent_event:text] 4` and `[agent_event:complete]` with session_id and cost. Full chain: mission → gateway → AgentRuntime → ClaudeSDKClient → Bridge proxy → Anthropic API → response back.

- **TCP proxy forwarding VERIFIED**: After binary frame fix, e2e test showed `[event] ECHO: {...mission...}` coming back through the proxy. Data flows both directions. Clean e2e run still needed (echo server was on port 8765 instead of real server).

- **SPRITES_PROXY_TOKEN regenerated** as UUID `590e3170-...`, saved to `bridge/.env` (gitignored) and Fly.io secrets. Old token lost (was only in Fly.io secrets with no local copy).

- **Bridge redeployed** twice to Fly.io with auth fix and binary frame fix.

### Decisions Made
1. **Keep TCP server, not WebSocket** — TCP proxy creates raw TCP connections, so TCP server is the correct match. Local `server.py` updated to match.
2. **Keep Bridge architecture, not public URL** — Researched Sprites.dev public URLs. `"public"` auth exposes Bash-enabled agent to internet. `"sprite"` auth requires org-level master token in requests. Bridge remains the security boundary.
3. **Binary frames for TCP proxy** — Per Sprites.dev docs: "After the JSON handshake completes, the connection becomes a raw TCP relay. Binary data is forwarded directly."

### Gotchas
1. **Sprites.dev TCP proxy only forwards binary WS frames** — text frames silently dropped after init handshake. The official `@fly/sprites` SDK sets `ws.binaryType = 'arraybuffer'` and sends Buffer data.
2. **Port 8765 stale processes** — Old server/echo processes survive Sprite sleep/wake via CRIU. Must `fuser -k 8765/tcp` before starting fresh.
3. **`source .env` doesn't export** — Use `export $(cat .env | xargs)` instead.
4. **Exec sessions keep Sprite awake** — Background exec from local machine keeps sprite from sleeping.
5. **IPv6 on Sprite** — `websockets.connect("ws://localhost:8765")` tries IPv6 first, fails. Use `127.0.0.1` or TCP directly.

### In Progress
- **stackdocs-kfn**: All three root causes fixed and deployed. Needs one clean e2e test run (kill echo server, start real server, send mission through TCP proxy, verify agent_event responses). Mechanically ready — just needs the clean run.

### Next Action
- Run clean e2e test: kill processes on Sprite, start real server with env vars, send mission through TCP proxy, verify full agent response. Then close stackdocs-kfn and unblock m7b.3.4/m7b.3.5.

---

## [2026-02-08 09:00] Session 130

**Branch:** main | **Git:** clean

### What Happened
- **stackdocs-kfn (P0 bug) VERIFIED AND CLOSED**: Ran clean e2e test — killed stale echo server on Sprite, started real server, sent mission "What is 2+2?" through TCP proxy. Agent returned "4" with session_id and cost ($0.02). Full chain confirmed: Browser → Bridge → TCP Proxy → Sprite TCP server → Gateway → AgentRuntime → Claude SDK → Bridge API Proxy → Anthropic API → response back.

- **Warm performance tested**: Second query ("Capital of Australia?") returned "Canberra" in ~4.5s, cost $0.01. Faster than cold (~6s) — SDK CLI was warmed.

- **Tool use tested — discovered two more issues**:
  1. `/workspace/` owned by `ubuntu` (Sprites.dev default) but server runs as `sprite` — agent couldn't create files. Fixed: `bootstrap.ts` now runs `sudo chown sprite:sprite /workspace` at start and `sudo chown -R sprite:sprite /workspace` at end.
  2. Claude Agent SDK's Bash tool requires interactive approval by default — headless agent was looping, burning ~$0.08-0.30 per failed attempt. Fixed: `runtime.py` now sets `permission_mode="bypassPermissions"` and `cwd="/workspace"`.

- **Tool use verified**: After fixes, agent successfully created `/workspace/stacks/` folder in ~11s, cost $0.025. Two-turn mission (think → Bash mkdir+ls → confirm).

- **Performance benchmarks established**:
  - Simple Q&A: ~4.5s, $0.01
  - Tool use (2-turn): ~11s, $0.025
  - Multi-turn failure (6 tool calls): ~60s, $0.08

- **Utility scripts added**: `bridge/scripts/warm-test.ts` (timing test), `bridge/scripts/deploy-code.ts` (quick code deploy to Sprite).

### Decisions Made
1. **`bypassPermissions` for headless agent** — no interactive user on Sprite to approve tool use. This is secure because Sprites are isolated VMs, one per stack, not shared.
2. **`chown -R` in bootstrap** — FS API writes as `ubuntu`, exec runs as `sprite`. Fix ownership after all writes.

### Gotchas
1. **Permission loop is expensive** — agent without `bypassPermissions` loops trying `sudo` variants, burning $0.08+ per failed mission. Always set this for headless agents.
2. **`test-sprite-e2e.ts` has two bugs**: uses ISO timestamp (should be numeric `Date.now()`), sends text WS frames (should be binary `Buffer.from`). Use `test-e2e-v2.ts` instead.
3. **`Decompression error: ZlibError`** in SDK stderr is non-fatal, can ignore.
4. **Stale processes on Sprite** survive sleep/wake. Always kill before starting fresh: `pkill -f "src.server"`.

### Next Action
- **Brainstorm m7b.3.4 (Canvas tools) and m7b.3.5 (Memory system)** — design decisions needed:
  - m7b.3.4: How to register canvas tools with Claude Agent SDK? Custom tools via `tools` param? MCP server? Need to figure out how tools send WS messages through the send_fn.
  - m7b.3.5: Bootstrap already creates memory templates (overlap with step 1). `runtime.py` already loads soul.md (overlap with loader). Transcript logger may be over-engineering for MVP. Needs scoping.
  - soul.md is currently a placeholder template — agent should fill it in as it learns.

---

## [2026-02-08 10:00] Session 131

**Branch:** main | **Git:** uncommitted (spec + bead updates)

### What Happened
- **Brainstormed Canvas tools (m7b.3.4) + Memory system (m7b.3.5)** — full design session covering both Sprite-side tool sets and the Canvas UI interaction model.

- **A2UI reference adopted**: User shared A2UI (a2ui.org) as interaction model inspiration. Cards as composable, draggable units on a free-form canvas. Led to refined Canvas UX: free-form drag (not grid-locked), snap-to-grid alignment, cards pop in complete (no streaming MVP).

- **Library research (3 background agents)**:
  1. Canvas library comparison: React Flow confirmed — only lib providing free-form + resize + snap + pan/zoom + grid out of the box. react-grid-layout (grid-only), @dnd-kit (no resize), react-rnd (unmaintained) all rejected.
  2. Codebase audit: Confirmed runtime.py has zero custom tools, bootstrap.ts deploys only 6 flat files, protocol.py already has complete CanvasUpdate types.
  3. SDK research: `@tool` + `create_sdk_mcp_server()` is the ONLY way to register custom tools. Proven v1 pattern.

- **Spec written**: `.space-agents/exploration/ideas/2026-02-08-canvas-tools-and-memory-system/spec.md`

- **Beads updated (5 issues)**: m7b.3.4, m7b.3.5, m7b.4, m7b.4.2, m7b.4.5 — all refined with SDK integration details, spec references, and brainstorm decisions.

### Decisions Made
1. **Closure injection** — `create_canvas_tools(send_fn)` factory. Same v1 pattern.
2. **Single MCP server "sprite"** — canvas + memory tools bundled. Tools: `mcp__sprite__create_card`, etc.
3. **Omit `allowed_tools` for MVP** — agent gets all built-in + custom tools.
4. **React Flow stays** — only lib with all 6 requirements (free-form, resize, snap, pan/zoom, grid, infinite canvas).
5. **Free-form canvas** — arbitrary pixel positions, snap-to-grid alignment.
6. **Fixed bottom chat bar** — not card-on-canvas or side panel.
7. **Cards pop in complete** — no streaming MVP.
8. **Browser-only layout persistence** — Zustand + localStorage.
9. **Both user and agent manage cards** — close, resize, drag, create.
10. **8 MVP block types** — heading, stat, key-value, table, badge, progress, text, separator.
11. **3 card types** — table, document, notes.

### Next Action
- `/plan` or `/mission` to start building m7b.3.4 + m7b.3.5. Both Beads are task-level and well-scoped.
- Phase 2 (Sprite tools) and Phase 3 (Canvas UI) can run in parallel.

---

## [2026-02-08 11:30] Session 132

**Branch:** main | **Git:** uncommitted (HOUSTON fixes after Builder commits)

### What Happened
- **Executed m7b.3.4 (Canvas tools) + m7b.3.5 (Memory system) via orchestrated mode** — Pathfinder/Builder/Inspector cycle for each task. Phase 2: Sprite Runtime is now **CLOSED** (6/6 tasks).

- **m7b.3.4 Canvas tools**: Builder created `sprite/src/agents/shared/canvas_tools.py` (3 tools: create_card, update_card, close_card) with 14 tests. Inspector flagged DRY violation (block validation duplicated in create/update). HOUSTON extracted `_validate_and_build_blocks()` helper, reducing 405→390 lines.

- **m7b.3.5 Memory system**: Builder created `sprite/src/memory/` (loader.py, journal.py, transcript.py, __init__.py) + `memory_tools.py` (3 tools: write_memory, update_soul, update_user_prefs). Inspector flagged: tests in wrong directory (`sprite/` root instead of `sprite/tests/`), DRY violation (update_soul/update_user_prefs duplicated write logic), and missing tests. HOUSTON fixes:
  1. Moved test files to `sprite/tests/`
  2. Extracted `_write_file()` shared helper (172→101 lines, 41% reduction)
  3. Rewrote `test_memory_tools.py` to use proper pytest fixtures instead of `sys.modules` mock that poisoned canvas_tools tests
  4. Fixed `runtime.py:142` transcript null bug (`self._transcript.session_id` crash when transcript is None during resume)
  5. Updated `test_runtime.py` to patch `load_memory()` instead of removed `SOUL_MD_PATH`

- **Live E2E verification on Sprite VM (sd-e2e-test)**:
  - Deployed 13 source files via `deployCode()`, killed old server, restarted
  - Agent confirmed all 6 MCP tools visible: `mcp__sprite__create_card`, `update_card`, `close_card`, `write_memory`, `update_soul`, `update_user_prefs`
  - Full invoice extraction scenario: agent created table card with 4 block types, updated stat, wrote all 3 memory files, closed card — all 6 tools succeeded
  - Verified memory files persisted on Sprite filesystem via `sprite exec cat`

- **56/56 sprite tests pass** (excluding 9 pre-existing test_server.py failures from handle_connection signature mismatch)

### Decisions Made
1. **DRY over brevity** — extracted shared helpers in both canvas_tools and memory_tools rather than shipping duplicated code
2. **No sys.modules mocking** — rewrote memory tools tests to use pytest fixtures + real SDK (was poisoning other test modules in same process)
3. **Transcript null safety** — added `if self._transcript:` guard before accessing session_id on resume path

### Gotchas
- Builder placed test files in `sprite/` root instead of `sprite/tests/` — caught by Inspector
- `sys.modules['claude_agent_sdk'] = MagicMock()` at module level in test_memory_tools.py permanently replaced the SDK for ALL tests in the pytest session, breaking canvas_tools tests that depend on `SdkMcpTool.handler` attribute
- Old server process survived Sprite sleep/wake (checkpoint persistence) — had to `pkill` before restart to pick up new code
- Agent passes blocks as stringified JSON (not list) — the `_parse_json_param()` guard is essential

### Next Action
- Phase 3 (Canvas UI — m7b.4, 7 tasks) and Phase 4 (Upload + Extraction — m7b.5, 3 tasks) are both unblocked
- Canvas UI is the visual half of what we just built — users will see the cards the agent creates
- Start with m7b.4.1 (WebSocket connection manager) as it's the foundation for all Canvas work

---

## [2026-02-08 13:00] Session 133

**Branch:** main | **Git:** uncommitted

### What Happened
- **Created `frontend/lib/websocket.ts`** — WebSocket connection manager class with Clerk JWT auth, exponential backoff reconnection (1s→2s→4s→max 30s), typed message dispatch by type, `send()` with auto-generated id/timestamp. Uses `crypto.randomUUID()` (no uuid dependency needed).

- **Created `frontend/app/(app)/test-chat/page.tsx`** — Quick test page at `/test-chat` for E2E verification. Chat box with Stack ID input, connection status indicator, message display (user/agent/system), auto-scroll. Uses shadcn/ui components.

- **Applied Supabase migration** — Added `sprite_name` (TEXT) and `sprite_status` (TEXT DEFAULT 'pending') columns to `stacks` table via MCP. Task m7b.2.9 was marked closed previously but migration was never actually run. Set `sd-e2e-test` sprite on "Invoice Processing" stack.

- **Fixed Clerk JWT mismatch** — Bridge on Fly.io had different CLERK_SECRET_KEY than frontend `.env.local`. Re-set via `flyctl secrets set`.

- **Fixed keepalive ping error** — Bridge sends `{type: 'ping', timestamp}` every 15s to Sprite, but Sprite's `gateway.py` rejected it (missing `id` field) → sent error back → frontend bricked. Two fixes:
  1. `sprite/src/gateway.py:50-52` — silently ignore `type: ping` messages before validation
  2. `frontend/lib/websocket.ts:183-187` — non-fatal system errors don't brick status when already connected

- **Fixed Sprite server restart** — Killed old server, restarted with venv + ANTHROPIC_API_KEY. Key not persisted in .env on Sprite (security — m7b.3.6).

- **Researched OpenClaw memory architecture** — Created `docs/research/openclaw-memory-architecture.md` with full analysis of two-tier memory (curated markdown + raw JSONL), pre-compaction flush, context window guard, flush triggers, session lifecycle. Key insight: "context window = RAM, disk = source of truth, compaction = GC."

- **Created bead m7b.6.4** — Multi-turn conversation via SDK session resume + local transcript. Full architecture spec with hybrid approach: SDK resume for within-session continuity, pre-compaction flush for between-session memory, layered memory files for cold starts (~2,200 tokens).

- **Created bead stackdocs-2d5** — Bug: canvas tool descriptions too vague, agent wastes 8-9 retries guessing block types. Traced full 10-attempt sequence showing agent trying header→heading, divider→separator, text.text→text.content.

### Decisions Made
1. **Hybrid memory architecture** — SDK session resume for live multi-turn + pre-compaction flush + curated markdown files for cold starts. Not session-scoped (agent needs to always understand user). Research in `docs/research/openclaw-memory-architecture.md`.
2. **websocket.ts location** — `frontend/lib/websocket.ts` (infrastructure) not `frontend/components/agent/stores/` (component-specific). Task spec said `lib/` and it makes sense — this is system-level.
3. **No uuid dependency** — Used `crypto.randomUUID()` instead of adding `uuid` package.
4. **Frontend error resilience** — Non-fatal system errors (like Sprite rejecting keepalive pings) don't transition to error state when already connected.

### Gotchas
- m7b.2.9 (Supabase schema migration) was closed but never actually run — columns didn't exist on live DB
- Sprite server restart loses ANTHROPIC_API_KEY (not in .env file, was in process env only). "Not logged in" error until re-set.
- Bridge CLERK_SECRET_KEY didn't match frontend — caused "Invalid or expired JWT" on first connect
- Bridge keepalive pings have no `id` field → Sprite gateway rejects them as invalid → sends error back to browser every 15s
- Canvas tool descriptions too vague → agent guesses block types from training data (Slack/Notion blocks) → 8-9 failed retries per card creation (~$0.20 wasted)

### Next Action
- Fix canvas tool descriptions (stackdocs-2d5) — quick P1 win
- Implement SDK session resume for multi-turn (m7b.6.4) — critical for user experience
- Continue Phase 3 Canvas UI (m7b.4.1 websocket.ts done, m7b.4.2 React Flow next)

---

## [2026-02-08 15:00] Session 134

**Branch:** main | **Git:** uncommitted

### What Happened
- **Implemented persistent SDK client for multi-turn conversation** — Core issue: runtime.py was creating a new ClaudeSDKClient per message and using resume=session_id for follow-up turns. SDK resume returns only a ResultMessage with no text (confirmed in logs). Correct pattern: keep ONE ClaudeSDKClient alive and call query()+receive_response() per turn on the same instance.

- **Refactored sprite/src/runtime.py** — New handle_message() is single entry point. First message creates client via _start_session(), subsequent messages reuse it via _continue_session(). Client cleanup on disconnect via cleanup(). Legacy run_mission()/resume_mission() preserved for test compat. Key: self._client persists across turns.

- **Updated sprite/src/gateway.py** — Simplified: _handle_mission() calls runtime.handle_message() for all missions. No more resume/new-session branching.

- **Updated tests** — 18 tests pass. Added test_resume_registers_mcp_tools, test_resume_fallback_on_error, fixed ensure_templates mock, added _apply_common_patches() helper.

- **Deployed and verified on sd-e2e-test sprite** — Multi-turn confirmed working across multiple test chat windows.

### Decisions Made
1. **Persistent client over resume** — SDK resume=session_id doesn't work with ClaudeSDKClient (returns empty ResultMessage). Persistent client per SDK docs works.
2. **Legacy methods preserved** — run_mission()/resume_mission() kept for tests. Production uses handle_message().

### Gotchas
- SDK resume parameter returns only ResultMessage with no agent text — broken or very short TTL
- ensure_templates() and TranscriptLogger try to mkdir /workspace — must mock in local tests
- sprite exec CLI doesn't support max_run_after_disconnect — use WS exec API for persistent processes

### Next Action
- Wire runtime.cleanup() to server disconnect handler
- Close bead m7b.6.4
- Continue Phase 3 Canvas UI (m7b.4.2)

---

## [2026-02-08 17:45] Session 136

**Branch:** main | **Git:** uncommitted

### What Happened
- **Brainstormed Canvas UI redesign** — Identified React Flow (whiteboard metaphor) as wrong approach. User wants homescreen widget model: grid-based cards, drag to rearrange, predefined sizes, no zoom/pan. Decided on `react-grid-layout` as replacement library.

- **Defined agent prompt for proactive card creation** — Agent should act as a PA placing documents on a desk (Canvas). Cards are primary output, text is short narration ("I've pulled up the invoice"). Drafted full Canvas section for soul.md with rules for when to create cards, sizes, block composition, and update behavior.

- **Created soul.md as a real file** (`sprite/memory/soul.md`) — Previously was a Python string template in `__init__.py`. Now a proper markdown file in the repo, deployed to `/workspace/memory/soul.md` on each deploy. Developer-controlled (not agent-writable).

- **Removed `update_soul` tool** from memory_tools.py — soul.md is our firmware, agent can't modify it. Agent still has `write_memory` (user.md, MEMORY.md) and `update_user_prefs`.

- **Removed `DEFAULT_SYSTEM_PROMPT`** from runtime.py — soul.md IS the system prompt now. Memory loader reads soul.md first, then user.md, journals. No fallback prompt.

- **Updated deploy pipeline** (`bridge/src/bootstrap.ts`) — `deployCode()` now deploys soul.md → `/workspace/memory/soul.md` alongside source files. Ownership fix includes `/workspace/memory`.

- **Updated sprite-deploy skill** with Sprites.dev server restart gotchas — exit codes 137/143 are expected, processes are stubborn (need kill+verify loop), proxy timeout on first run is normal race condition.

- **Deployed to sd-e2e-test Sprite** — Server running, e2e test passes. Soul.md confirmed deployed.

- **Updated Phase 3 beads** — Feature title changed to "Grid Layout + Agent Prompt". m7b.4.2 rewritten for react-grid-layout. m7b.4.5/4.6/4.7 updated. Created m7b.4.9 (agent prompt + tool API + protocol), m7b.4.10 (React 19 compat spike), m7b.4.11 (Bridge path testing + canvas_update bug).

- **Architecture review** identified: React 19 compat risk, auto-height not native in react-grid-layout (needs ResizeObserver), protocol file coupling between tasks, 9 canvas_tools tests will break with card_type→size change.

- **Discovered canvas_update bug** — Agent tries to create cards through Bridge but send_fn fails with WebSocket error. Inbound missions work, outbound canvas_updates don't reach browser. This is the critical bug blocking Canvas from working in production.

### Decisions Made
1. **react-grid-layout replaces React Flow** — Homescreen widget metaphor, not whiteboard. 4 predefined sizes: small(1col)/medium(2col)/large(2col+)/full(3col).
2. **soul.md is developer-controlled** — Deployed from repo, overwritten on deploy. Agent cannot modify it. `update_soul` tool removed.
3. **soul.md IS the system prompt** — No DEFAULT_SYSTEM_PROMPT fallback. Memory loader chain: soul.md → user.md → MEMORY.md → journals.
4. **`card_type` replaced by `size`** in tool API — Cards defined by blocks, not type labels. Size is a layout hint for the frontend grid.
5. **Test through Bridge, not direct TCP Proxy** — Production path must be tested. Direct scripts useful for debugging only.

### Gotchas
- Sprite server processes are stubborn to kill — checkpoint/CRIU delays termination, need kill+verify loop
- test-e2e-v2 first run often times out (race condition) — run again and it works
- react-grid-layout doesn't support auto-height natively — needs ResizeObserver workaround
- React 19 compat with react-grid-layout is untested — spike needed before committing

### Next Action
- **m7b.4.11**: Debug and fix canvas_update messages through Bridge — this blocks Canvas from working in production. Then run React 19 spike (m7b.4.10).

---

## [2026-02-08 19:20] Session 137

**Branch:** main | **Git:** clean

### What Happened
- **Completed m7b.4.10: React 19 + react-grid-layout compatibility spike** — Builder agent installed react-grid-layout v2.2.2, created `frontend/components/canvas/grid-layout-spike.tsx` (245 lines) with 4 mock cards, verified build passes with React 19.2.3. Inspector confirmed 6/6 success criteria pass.

- **v2 API differences documented** — react-grid-layout v2 uses `Responsive` + `useContainerWidth()` hook (NOT `ResponsiveGridLayout`/`WidthProvider` from v1). `dragConfig={{ handle: '.drag-handle' }}` replaces `draggableHandle` prop. `rowHeight` goes directly on `<Responsive>` (not in `gridConfig`). Ships own TS types — do NOT install `@types/react-grid-layout`.

- **UX refinements through interactive testing:**
  - Drag/resize: cards fade to 40% opacity during interaction, dashed border placeholder shows snap target
  - `user-select: none` during resize to prevent text highlighting
  - `noOverlapCompactor` (via `getCompactor(null, false, true)`) for free card placement without overlapping — cards can be placed anywhere on grid with gaps, not anchored to top
  - `ROW_HEIGHT=150` for iPhone-widget-style height increments (1x=150px, 2x=320px, 3x=490px)
  - `MARGIN=[20,20]` for spacing between cards

- **Confirmed architecture understanding** — no local Sprite server involved. Full chain: browser (localhost:3000) → Bridge (wss://ws.stackdocs.io on Fly.io) → TCP Proxy → Sprite (sd-e2e-test on Sprites.dev). `/sprite-deploy` uploads code and starts server on remote Sprite only.

### Decisions Made
1. **`getCompactor(null, false, true)`** for free placement without overlap — `noCompactor` allows overlap, `verticalCompactor` forces cards to top. This combo gives iPhone homescreen feel.
2. **ROW_HEIGHT=150** with 20px margin — gives clear 1x/2x/3x height tiers like iOS widgets.
3. **Drag/resize visual feedback** — semi-transparent card + dashed placeholder. Better than invisible (loses content) or default (free follow feels imprecise).

### Gotchas
- `compactType` is v1 API — v2 uses `compactor` prop with Compactor objects
- `noOverlapCompactor` not exported from main package — use `getCompactor(null, false, true)` instead
- CSS `!important` on `transform` doesn't beat inline styles set by react-grid-layout — use `visibility: hidden` or `opacity` instead
- react-grid-layout applies position via inline `style` attribute during drag/resize — class-based CSS overrides don't work for transform

### Next Action
- **m7b.4.11**: Debug and fix canvas_update messages through Bridge — outbound messages (Sprite → Bridge → browser) are broken. Likely issue in send_fn chain or Bridge TCP Proxy forwarding. This blocks Canvas from working end-to-end.

---

## [2026-02-08 21:00] Session 138

**Branch:** main | **Git:** uncommitted (fix applied)

### What Happened
- **Fixed stale closure bug in canvas_update send chain** — Root cause found and fixed for m7b.4.11. Canvas tools (`sprite/src/agents/shared/canvas_tools.py:267`) captured `send_fn` by value at tool creation time via `create_canvas_tools(self._send)`. After TCP reconnect (Sprite sleep/wake), `update_send_fn()` updated `self._send` on the runtime but canvas tools still held the OLD function pointing to a dead StreamWriter. Text responses worked because `_send_event()` (runtime.py:291) calls `self._send` directly (always current).

- **Fix:** Added `_indirect_send()` method on `AgentRuntime` (`sprite/src/runtime.py:56-59`) that delegates to `self._send` at call time. Changed all 3 `create_canvas_tools()` call sites to use `self._indirect_send` instead of `self._send`. Bound method reference survives reconnections because `self` is stable — only `self._send` changes.

- **Test added:** `test_indirect_send_survives_send_fn_swap` in `sprite/tests/test_runtime.py` — verifies that after `update_send_fn()`, `_indirect_send` routes to the new function, not the old one.

- **Fixed stale test imports** — `test_runtime.py` referenced removed `DEFAULT_SYSTEM_PROMPT` constant (replaced by memory system). Updated 2 tests to match current `load_memory()` behavior.

- **End-to-end verified:** Deployed fix to `sd-e2e-test` Sprite, ran `test-canvas.ts` — canvas_update message received successfully: `command: create_card`, `card_id`, `title: "Test Card"`, 2 blocks. Full chain working: Agent → canvas_tools → _indirect_send → TCP writer → Bridge → browser.

- **Frontend tested by user** — Cards now flow through to the browser. However they render on the old React Flow canvas, not the new react-grid-layout from session 137. The grid spike is static (hardcoded mock cards, not wired to WebSocket messages).

- **Created stackdocs-m7b.4.2.1** — "Wire grid layout to canvas_update messages (replace React Flow)". Detailed bead with gap analysis: grid-layout-spike needs to accept `cards` prop, use `CardRenderer` for blocks, replace React Flow in test-chat page.

### Decisions Made
1. **`_indirect_send` over lambda wrapper** — Used a bound method (`self._indirect_send`) rather than a lambda (`lambda data: self._send(data)`) because bound methods are cleaner, testable, and the method signature matches `SendFn` type.
2. **Fix all 3 call sites** — `_start_session`, `run_mission`, and `resume_mission` all updated to use `_indirect_send` even though `run_mission`/`resume_mission` create fresh clients (defense in depth).

### Gotchas
- Python closure captures the function OBJECT, not the attribute reference. `create_canvas_tools(self._send)` freezes the function — reassigning `self._send` later has no effect on the closure. This is a subtle Python scoping trap.
- `sprite exec` kill commands return exit code 137 (SIGKILL) — expected, not an error.
- `pgrep -f "python.*src.server"` can match the grep command itself — always verify with `ps aux` if pgrep shows unexpected PIDs.
- `test-e2e-v2.ts` always tries to start the server — if already running, second run fails with "address in use". Need a proxy-only test script (created `test-canvas.ts`).
- `test_memory_tools.py` has 6 pre-existing errors (references removed `SOUL_MD` constant) — unrelated to this fix.

### Next Action
- **m7b.4.2.1**: Wire grid layout to canvas_update messages — replace static spike with production component that renders real cards from WebSocket. Key files: grid-layout-spike.tsx, test-chat/page.tsx, card-renderer.tsx.

---

## [2026-02-08 23:15] Session 139

**Branch:** main | **Git:** uncommitted

### What Happened
- **Completed m7b.4.2.1** — Wired grid-layout-spike to real canvas_update WebSocket messages.

- **grid-layout-spike.tsx** (168 lines): Added `GridCard` interface (`id`, `title`, `blocks`) and `GridLayoutSpikeProps` (`cards`, `onCardClose`). New `autoPlaceGrid()` finds next available grid slot. `useEffect` syncs cards to layout items — preserves drag/resize positions for existing cards via `layoutRef`, auto-places new ones. Renders card content through `CardRenderer`. Empty state when no cards.

- **test-chat/page.tsx** (316 lines): Replaced React Flow `CanvasCardNode` with flat `GridCard`. New `canvasUpdateToCard()` replaces `canvasUpdateToNode()`. Removed all React Flow imports (`applyNodeChanges`, `OnNodesChange`, `StackCanvas`, `autoPlace`). Removed view toggle — grid is the only canvas. `GridLayoutSpike` receives `cards` and `onCardClose` directly.

- **Fixed infinite render loop** — `handleLayoutChange` was calling `setLayouts()`, creating a ping-pong with the `useEffect` that also sets layouts. Root cause: two competing state setters. Fix: `handleLayoutChange` now only updates `layoutRef` (tracks user drag/resize positions), while `useEffect` is the sole owner of `setLayouts`. Also removed `breakpoint` from useEffect deps.

### Decisions Made
1. **Evolved spike in place** rather than new production component — user preference to iterate on spike file.
2. **Flat `GridCard` type** instead of React Flow's `Node<CanvasCardData>` — no position/style/type overhead.
3. **`layoutRef` + single `setLayouts` owner** — ref tracks user drag positions, useEffect is sole state setter, handleLayoutChange only updates ref. Prevents render loops.

### Gotchas
- **react-grid-layout v2 `onLayoutChange` fires on every render** when `layouts` prop changes. If `handleLayoutChange` also sets `layouts`, you get an infinite loop. Only ONE thing should call `setLayouts`.
- **`Layout` type is readonly** in react-grid-layout v2 — need `[...current]` spread to assign to mutable `LayoutItem[]`.

### Next Action
- Pick up next Phase 3 task (m7b.4.5 Canvas Zustand store, m7b.4.6 Subbar, m7b.4.3 MVP blocks, m7b.4.9 Agent prompt).

---

## [2026-02-09 18:30] Session 140

**Branch:** main | **Git:** uncommitted (spec file only)

### What Happened
- **Full rethink of the memory system spec** (`exploration/ideas/2026-02-08-memory-system-redesign/spec.md`). Brainstorm session exploring three memory approaches: our custom tools (v1 spec), Anthropic's native memory tool, and claude-mem's hook-driven capture.

- **Research findings:** Anthropic's native `memory_20250818` tool is NOT available in the Claude Agent SDK (only in base `anthropic` SDK). GitHub Issue #552 open, no response. Using it would mean losing the full Agent SDK toolset (Bash, Read, Write, subagents, etc.). Ruled out.

- **claude-mem analysis:** Studied architecture of github.com/thedotmack/claude-mem (25k+ stars). Key patterns: PostToolUse hooks capture every tool call automatically, background worker processes via AI, SQLite + FTS5 for storage, progressive disclosure for retrieval. System captures — agent doesn't need to cooperate.

- **New architecture decided:** Two-process model per Sprite VM:
  1. **Main Agent** (Haiku/Sonnet) — talks to user, uses tools, creates canvas cards. Has ZERO memory tools. Doesn't manage memory at all.
  2. **Workspace Daemon** (TypeScript/Bun, forked from claude-mem) — background process that watches all observations via PostToolUse + UserPromptSubmit hooks, processes each in real-time via Haiku API calls, extracts learnings to SQLite, updates user.md, syncs canvas→files, queues complex decisions for agent.

- **Key insight from Fraser:** "I don't trust the agent to follow memory rules, especially dropping to Haiku 4.5." This drove the entire redesign — remove ALL memory responsibility from the agent, offload to system-level capture + background daemon.

- **Daemon stays in TypeScript/Bun** (not Python). claude-mem is already TypeScript — fork and adapt instead of rewriting. The boundary is clean: Python hooks write observations to SQLite, TypeScript daemon reads from SQLite. No shared code.

### Decisions Made
1. **Agent has zero memory tools** — all memory offloaded to daemon. Agent is a pure worker.
2. **Hook-driven capture** — PostToolUse + UserPromptSubmit hooks capture everything automatically. No agent cooperation needed.
3. **Real-time processing** — daemon processes each observation immediately via Haiku (~$0.0001/observation, ~$0.002/session).
4. **Process everything** — all tool calls sent to Haiku, let it decide what's notable. No pre-filtering.
5. **Daemon is a full workspace daemon** — not just memory. Also handles file sync (canvas→workspace), folder organization, and proactive maintenance.
6. **Silent vs queued split** — daemon does factual work silently (learnings, user.md, file sync), queues judgment calls for agent (rule changes, duplicate detection).
7. **Agent knows about daemon** — soul.md describes the daemon's existence and role. They're collaborators.
8. **MEMORY.md and journals replaced by SQLite** — learnings table replaces MEMORY.md sections, sessions table replaces journal files.
9. **Session injection** — soul.md + user.md + last 48h learnings + pending actions loaded at session start.
10. **TypeScript daemon** — fork claude-mem instead of rewriting in Python. Bun installed during bootstrap.

### Gotchas
- Anthropic native memory tool only works with base SDK, NOT Agent SDK. Don't go down this path until Issue #552 is resolved.
- claude-mem uses `bun:sqlite` natively — fast and no extra deps. Good match for daemon.
- The daemon needs an Anthropic API key for Haiku calls. Current architecture avoids injecting keys into Sprites (m7b.3.6). This is Open Question 2 in the spec — needs resolving before implementation.

### Next Action
- Resolve API key question for daemon (affects Bridge architecture).
- When ready: `/plan` to create implementation tasks from the updated spec.
- Fork claude-mem repo and study the worker processing code in detail before planning.

---

## [2026-02-09 20:45] Session 141

**Branch:** main | **Git:** uncommitted (spec update only)

### What Happened
- **Finalized memory system spec** (`exploration/ideas/2026-02-08-memory-system-redesign/spec.md`). Brainstorm continuation from session 140. Walked through all 6 open questions and resolved each with Fraser.

- **Resolved all open questions:**
  1. **Inter-agent comms** → One-way `pending_actions` table only (daemon→agent). Keep simple.
  2. **API key for daemon** → Already solved. Bridge API proxy (m7b.3.6) already deployed at `ws.stackdocs.io/v1/proxy/anthropic`. Daemon inherits `ANTHROPIC_BASE_URL` env var. No new infrastructure needed. Explore agent confirmed implementation details in `bridge/src/api-proxy.ts` (130 lines, 10 tests).
  3. **Observation context window** → Sliding window of 10 recent observations per Haiku call (~5k tokens, ~$0.0003/call).
  4. **Canvas-file sync** → Deferred to post-MVP. Daemon focuses purely on memory capture. Agent can write files on user request.
  5. **Proactive maintenance** → No extra code. Haiku processing prompt naturally detects operational patterns (unprocessed documents, etc.) and queues as pending_actions.
  6. **Failure handling** → Exponential backoff + 6h staleness cutoff. Implementation detail, not architectural.

- **Scope trimmed significantly.** Removed canvas-file sync, workspace maintenance, folder organization from daemon MVP. Daemon now has exactly 4 responsibilities: capture observations, extract learnings, update user.md, queue pending actions.

- **Spec status changed** from "Needs discussion" → "Ready for planning". Added Resolved Decisions table, cleaned up architecture diagrams, removed deferred items from requirements.

### Decisions Made
1. **Daemon scope is memory-only for MVP.** No canvas sync, no workspace maintenance, no file organization. Pure memory capture + intelligence extraction.
2. **Bridge API proxy resolves the API key question.** No new infrastructure. Daemon uses `@anthropic-ai/sdk` which respects `ANTHROPIC_BASE_URL` env var pointing at Bridge proxy.
3. **Haiku detects operational patterns naturally.** No rule-based alerting code. Processing prompt includes ACTIONS category — Haiku flags things like "document uploaded but never processed" organically.

### Next Action
- `/plan` to create implementation tasks from the finalized spec.
- Fork claude-mem repo and study worker processing code before planning.

---

## [2026-02-11 20:50] Sessions 142-143

**Branch:** main | **Git:** uncommitted (spec + exploration files)

### What Happened
- **Major brainstorm: Liquid Glass UI evolved into full OS concept.** Two sessions (142 on Feb 10, 143 on Feb 11) iterated heavily on the Stackdocs v2 frontend design using Google AI Studio Build mode as a rapid prototyping tool.

- **Session 142 — Glass Desktop prototype:**
  - Researched Google AI Studio Build mode (how it works, best prompting strategies, React output format)
  - Crafted and iterated ~8 prompts to build an interactive glass desktop prototype
  - Evolved sidebar from vertical left rail → floating dock → horizontal top dock (three separate glass pills)
  - Evolved wallpaper from dark/muted → bright/vibrant (aqua blue, Apple Liquid Glass style)
  - Evolved chat bar from stacked elements → unified single-line pill with chips/input toggle
  - Decided: chat output as separate floating canvas card, not attached to chat bar
  - Decided: generative apps in sandboxed iframes — agent builds custom tools on demand
  - Decided: users can save generated apps to dock
  - Wrote comprehensive spec: `.space-agents/exploration/ideas/2026-02-09-liquid-glass-ui-reskin/spec.md`

- **Session 143 — OS concept refinement:**
  - Fraser iterated further in AI Studio between sessions — screenshots show significant evolution
  - Top left pill → app drawer (documents, apps, settings icons opening left-anchored panels)
  - Top center pill → workspace tabs (browser tab model, not dock icons)
  - Top right pill → system tray (zoom %, search, notifications, user avatar)
  - Canvas → infinite canvas with pan (click-drag), zoom (scroll wheel), right-click context menu
  - Chat → dual mode: bottom bar (default, clean) OR right panel (full chat history with timestamps)
  - Documents → fixed left-anchored panel with file tree, search, storage indicator
  - Card "..." menu: "Ask AI to edit...", "Lock Window", "Pin to View"
  - Right-click canvas: Environment (wallpaper picker), View (zoom controls, Clean Up By Name)

### Decisions Made
1. **One Sprite VM per USER, not per workspace.** Workspaces are virtual canvases within the same agent/VM. Agent has full context across all workspaces. Changes Bridge routing (user_id → sprite, not stack_id → sprite) and Supabase schema.
2. **Generative apps via sandboxed iframes.** Agent generates HTML/CSS/JS, rendered in `sandbox="allow-scripts"` iframes. Users save favorites to dock/app drawer.
3. **Browser tab model for workspaces.** Not dock icons. Tabs with status dots, reorderable, agent can create/manage.
4. **Infinite canvas.** Pan/zoom/right-click context menu. POS + ZM indicators in corner. Not fixed viewport.
5. **Dual-mode chat.** Bottom bar (default) OR right assistant panel. User switches between them.
6. **"The user talks, the agent renders."** Canvas is the agent's display. User interaction is chat-first. Canvas interactions feed back to agent. Interface sophistication doesn't raise barrier to entry.
7. **Document extraction is the wedge, generative desktop is the platform.** Phasing: glass feel → extraction → generative apps → notifications/automations.

### Gotchas
- Google AI Studio glass rendering tends toward opaque — need to explicitly push for more transparency in every prompt
- `backdrop-filter` with many glass surfaces + infinite canvas pan/zoom = potential GPU performance concern
- The spec is comprehensive but the implementation gap between AI Studio prototype and production is significant

### Next Action
- `/plan` to create implementation tasks from the updated spec (supersedes current Phase 3 m7b.4.x beads)
- Note: `exploration/ideas/2026-02-08-memory-system-redesign/` has a plan.md — should reconcile to `planned/`

---

## [2026-02-11 22:30] Session 140

**Branch:** main | **Git:** uncommitted (.gitignore, spec.md)

### What Happened
Pre-build prep session for the v2 glass desktop UI rebuild.

1. **Archived v1 frontend** — created `archive/v1-frontend` branch at `1d303f8`, set up git worktree at `.worktrees/v1-frontend/` with deps installed. Frozen reference for the rebuild.

2. **Organized reference materials** — created `docs/reference/` (gitignored) containing:
   - `spatial-glass-prototype/` — Google AI Studio React/TS spatial desktop prototype (sessions 142-143)
   - `nanobot/` — HKUDS/nanobot Python agent framework (3.5k lines, MIT, 16.6k stars). Memory, skills, cron/heartbeat. Potential Sprite runtime patterns.
   - `claude-mem/` — thedotmack/claude-mem Claude memory system with OpenClaw patterns.

3. **Brainstormed glass desktop shell** — explored prototype code and current frontend via research agent. Key decisions:
   - **Ein UI** (`ui.eindev.ir`) as glass component library — shadcn-compatible, Tailwind v4, pre-built liquid glass components
   - **Custom CSS canvas** (port prototype's 170-line approach) over React Flow — desktop OS doesn't need graph editor features, full visual control for glass
   - **Agent spatial awareness** — card positions sent via `canvas_interaction` WebSocket messages so agent places cards intelligently
   - **Glass desktop shell** as first build target tomorrow (wallpaper, topbar, canvas, chat bar)

4. **Updated spec** at `.space-agents/exploration/ideas/2026-02-09-liquid-glass-ui-reskin/spec.md`:
   - Added Animation System section (full inventory from prototype: card mount/close/drag, generative terminal, chat bar swap, etc.)
   - Added Ein UI, custom canvas, agent spatial awareness to Technology Choices and Decisions
   - Added Reference Materials section pointing to `docs/reference/`
   - Updated Next Steps for "build and play" approach

5. **Product/startup discussion** — confirmed Stackdocs as a product, not a portfolio piece. Key insight: "it's a PC" is the moat. Agent can `pip install`, connect to Xero, run cron jobs. Haiku for MVP main agent (unit economics). Wedge = extraction for SMBs, platform = generative desktop.

### Decisions Made
- Ein UI for glass components (not hand-rolling GlassSurface)
- Custom CSS transform canvas (drop React Flow)
- `motion` AnimatePresence for exit animations (replaces prototype's setTimeout hack)
- Reference repos gitignored (not committed — 131k lines of external code)
- Haiku as main agent model for MVP (cost: ~$0.005-0.01/session vs ~$0.08 with Sonnet)

### Next Action
- Tomorrow: build glass desktop shell with Ein UI. Install Ein UI → port Wallpaper + TopBar → port DesktopCanvas → port ChatBar → wire to WebSocket.
- `/plan` to create Phase A implementation tasks from the updated spec.

---

## [2026-02-11 23:15] Session 141

**Branch:** main | **Git:** uncommitted (spec.md update)

### What Happened
Continuation of session 140. Focused on integration architecture for the glass desktop rebuild.

1. **Sent architecture exploration agent** to analyze the full frontend codebase against the glass desktop spec. Agent read every route, layout, component, store, WebSocket file, and `components.json` to determine the best integration approach.

2. **Key architectural decision: parallel `(desktop)/` route group.** The existing `(app)/layout.tsx` is deeply coupled to v1 (SidebarProvider, 6 context providers, parallel route slots `@header`/`@subbar`). Rather than conditionally rendering two shells, create a new `app/(desktop)/` route group with its own minimal layout. Both share the root `app/layout.tsx` (Clerk, ThemeProvider). Old `(app)/` stays untouched until a cleanup PR after desktop is verified.

3. **WebSocket state management decided:** Lift the working `test-chat/page.tsx` pattern into a `WebSocketProvider` context wrapping the desktop page. Dispatches `canvas_update` → desktop-store (Zustand), `agent_event` → chat-store (Zustand). Components consume via `useWebSocket()` hook.

4. **Panel behaviour decided:** Fixed-position CSS transitions (not shadcn Sheet). No overlay — canvas stays interactive. A `usePanel` hook handles Escape-to-close and click-outside-to-dismiss. Desktop OS pattern.

5. **Updated spec** at `.space-agents/exploration/ideas/2026-02-09-liquid-glass-ui-reskin/spec.md`:
   - Added Integration Strategy section (parallel route group, WebSocket provider, component reuse table, cleanup PR plan)
   - Updated File Structure to reflect `(desktop)/` route group, `ws-provider.tsx`, store data models
   - Marked file structure as draft (may evolve during build)
   - Added Build Order (15 steps for Phase A)
   - Added SSR Gotchas (window.innerWidth, backdrop-filter stacking, pointer events)
   - Added route structure, WebSocket state, panel behaviour to Decisions table
   - Added parallel route groups + no new npm deps to Constraints

6. **Reviewed prototype animations in detail** — documented panel slide transitions (Documents left, ChatSidebar right), chat bar ↔ sidebar handoff coordination, and `usePanel` hook pattern. All added to Animation System section.

### Decisions Made
- `(desktop)/` route group alongside `(app)/` — clean separation, v1 untouched during dev
- `WebSocketProvider` context pattern — lifted from working test-chat, dispatches to Zustand stores
- Fixed-position panels + `usePanel` hook — no overlay, desktop OS behavior
- File structure marked as draft — "build and play" approach, structure may evolve

### Gotchas
- `lib/stores/` directory is EMPTY — the only existing Zustand store is `components/agent/stores/agent-store.ts` (v1 agent flows)
- `components.json` has empty `registries: {}` — Ein UI registry needs to be added before install
- Prototype uses `window.innerWidth` for card placement — won't work with Next.js SSR

### Next Action
- Tomorrow: `/plan` to create Phase A implementation tasks, then build glass desktop shell starting with step 1 (glass tokens + Ein UI install).

---

## [2026-02-12 10:00] Session 145

**Branch:** main | **Git:** uncommitted (Ein UI spike + desktop chrome)

### What Happened
Pre-planning session: reviewed all open beads, evaluated UI architecture decisions for glass desktop rebuild.

1. **Reviewed all 19 open beads** — produced summary table showing which beads are obsolete vs still valid after the glass desktop spec pivot. Key finding: m7b.4.x beads assume react-grid-layout + `(app)/` route group, which the new spec replaces with custom CSS canvas + `(desktop)/` route group.

2. **Canvas engine decision** — discussed react-grid-layout vs React Flow vs custom CSS transforms. Concluded:
   - react-grid-layout: no overlap, no zoom, fixed viewport — doesn't match desktop OS vision
   - React Flow: supports overlap/zoom but overkill for window management (graph editor baggage)
   - Custom CSS transforms (prototype): ~170 lines, proven, full glass control, no dependencies
   - Searched for alternatives (canvas-react, tldraw, infinite-canvas) — nothing fits better
   - **Decision: keep custom CSS canvas from prototype**

3. **Ein UI spike** — installed and tested Ein UI glass component library:
   - Configured shadcn registry: `@einui` → `https://ui.eindev.ir/r/{name}.json` in `frontend/components.json`
   - Installed 5 components: `glass-card`, `glass-button`, `glass-tabs`, `glass-input`, `glass-dock`
   - All build clean with React 19 + Next.js 16 + Tailwind v4
   - Created reference doc at `docs/reference/ein-ui.md` (48 components, theming, CSS vars, Stackdocs mapping)

4. **Built desktop chrome spike** in `frontend/app/(app)/test-chat/page.tsx`:
   - Full-screen wallpaper background with 8 gradient presets + switcher
   - Top bar: three floating glass pills — app drawer, workspace tabs (GlassTabs), system tray
   - Chat bar: floating bottom pill with suggestion chips / text input toggle
   - Assistant Panel: right-side glass panel with full WS connection UI — toggled by message icon
   - Demo glass cards: stat, table, processing cards
   - All components use Ein UI glass styling over wallpaper backgrounds

5. **Component mapping identified** for desktop build:
   - Top bar pills: custom GlassPill + GlassButton ghost icons + GlassTabs
   - Chat bar: GlassButton for chips + GlassInput for text mode
   - GlassDock installed but too opinionated for top bar pills

6. **Added icons** to `frontend/components/icons/index.ts`: Paperclip, Keyboard, Microphone, Message, Bell, User, Apps, LayoutGrid

### Decisions Made
- Custom CSS canvas over react-grid-layout and React Flow
- Ein UI as glass component library (confirmed working)
- GlassPill (custom wrapper) for top bar pills instead of GlassDock
- Top bar pills use `rounded-full` capsule shape
- Assistant Panel as right-side glass panel for WS chat
- Registry URL: `https://ui.eindev.ir/r/{name}.json`

### Next Action
- Continue pre-planning tasks: Sprite-per-user Bridge changes, auto-placement algorithm, card dimensions, obsolete bead cleanup
- Then `/plan` to create Phase A implementation tasks from the glass desktop spec

---

## [2026-02-12 10:30] Session 146

**Branch:** main | **Git:** uncommitted (UI iteration on test-chat page)

### What Happened
Iterative UI refinement session on the desktop chrome prototype at `frontend/app/(app)/test-chat/page.tsx`.

1. **Positioning fix** — Changed all overlay components (TopBar, ChatBar, Assistant Panel, WallpaperPicker, position indicator) from `fixed` to `absolute` positioning so they're scoped to the canvas container rather than the viewport.

2. **Icon sizing fix** — Discovered `[&_svg]:size-4` in `frontend/components/ui/glass-button.tsx` was forcing all child SVGs to 16px regardless of class overrides. Removed the forced `size-4` so icon size classes actually work. Icons settled at `size-5` (20px) after iteration.

3. **Top bar height tuning** — Reduced GlassPill padding from `py-2` to `py-1`, icon buttons to `size-8` (32px). Adjusted `GlassTabsTrigger` padding from `py-2` to `py-1.5` in `frontend/components/ui/glass-tabs.tsx`.

4. **Center tabs redesign** — Separated the `+` (add tab) and `<` (back) buttons from the center tabs pill into standalone round glass buttons flanking the pill. Both `size-10` to match pill height.

5. **Left pill → separate app circles** — Discussed whether app icons should be grouped in a pill or separate circles. Decided separate circles are better for user-created apps (scalability, individual identity, dock metaphor). Converted left pill to three individual `size-10` round glass buttons.

### Decisions Made
- Removed `[&_svg]:size-4` forced override from GlassButton — icons now respect their own size classes
- App icons as separate circles (not grouped pill) — better for user-created apps
- `<` back and `+` add as standalone round buttons flanking tabs pill
- Tab trigger padding `py-1.5` for compact height

### Next Action
- Continue desktop chrome iteration — refine spacing, consider app circle hover states and badges
- Begin planning Phase A implementation tasks from glass desktop spec

---

## [2026-02-12 17:00] Session 144

**Branch:** main | **Git:** uncommitted (spec + plan updates)

### What Happened
Deep brainstorming session on Sprite VM file structure and memory system redesign. Revisited the session 142 memory plan with significant architectural changes.

1. **Introduced `.os/` directory concept.** Separates system infrastructure from user space on the Sprite VM. `.os/` contains runtime code (`src/`), memory system (`memory/`), venv, and VERSION. Top-level `/workspace/` has user space: `documents/`, `ocr/`, `extractions/`, `artifacts/`. Mirrors "agent IS the operating system" vision.

2. **Eliminated documents database.** Agent has full filesystem access (Bash, Glob, Grep, Read) — doesn't need SQL to find files. Filesystem IS the source of truth for user data. `files.md` memory file maintains a daemon-curated index.

3. **Split into two databases.** `transcript.db` (append-only, immutable black box recorder) + `memory.db` (searchable learnings, FTS5). Clean separation: transcript is raw input, memory is processed output. Can rebuild memory.db from transcript.db.

4. **Expanded to 6 memory files.** Added `soul.md` (personality) separate from `os.md` (system rules), plus `files.md` (filesystem index) and `context.md` (active working state). All loaded on boot as the "launch briefing."

5. **Switched to batch processing.** Instead of per-turn daemon (2s loop), accumulate observations and process every ~25 turns. Gives Haiku much better context over conversation arcs. Three triggers: batch threshold (Stop hook), emergency flush (PreCompact hook), session end.

6. **Discovered PreCompact hook exists.** Previous plan said SDK didn't expose compaction controls — it does. `PreCompact` hook fires before auto-compaction with `trigger: "auto"`. Solves the edge case of context loss during compaction.

7. **All memory daemon-managed, including context.md.** Initially considered agent-writable context.md, but user correctly identified this breaks the "agent is a pure worker" principle. Agent will forget to write. Daemon observes and curates all 6 files.

8. **Updated spec and plan.** Spec at `.space-agents/exploration/planned/2026-02-08-memory-system-redesign/spec.md` — comprehensive rewrite. Plan expanded from 7 to 9 tasks to cover `.os/` restructure and new file layout.

### Decisions Made
- `.os/` for system, top-level for user space — clean filesystem separation
- No documents database — filesystem + files.md is enough
- Two databases: transcript.db (immutable source of truth) + memory.db (searchable learnings)
- 6 memory files: soul.md, os.md, tools.md, files.md, user.md, context.md
- soul.md (personality) separate from os.md (system rules)
- Batch processing every ~25 turns, not per-turn
- PreCompact hook for emergency flush (SDK supports it)
- All memory daemon-managed — agent has zero write responsibility
- context.md daemon-curated (not agent-writable)
- No timer loop needed — hooks cover all trigger cases
- Daemon is stateless (single Haiku call per batch, no inception problem)

### Next Action
- `/plan` to create Beads tasks from the updated 9-task plan, then begin implementation starting with Task 1 (`.os/` restructure)

---

## [2026-02-12 15:00] Session 145

**Branch:** main | **Git:** uncommitted (large changeset — v1 cleanup + 4 tasks)

### What Happened
Started orchestrated mission on m7b.4.12 (Glass Desktop UI). Created 12 child Beads tasks with dependency graph. Completed tasks 1-4 directly (HOUSTON executed instead of Builder agents after user preferred that approach).

**v1 Frontend Cleanup** (by parallel agent): Deleted ~85 v1 files (app/(app)/ routes, components/agent/, documents/, stacks/, layout/, preview-panel/, shared/, canvas/, hooks/, lib/queries/). Removed 5 npm packages (motion, react-resizable-panels, cmdk, @radix-ui/react-collapsible, @radix-ui/react-alert-dialog). Also removed 10 unused shadcn/ui components + utilities (sidebar, resizable, breadcrumb, command, input-group, collapsible, alert-dialog, dock, lib/date.ts, lib/format.ts). Kept framer-motion (used by glass-tabs) and lucide-react (used by sonner toast icons). Frontend CLAUDE.md fully rewritten.

**Task 1 — Desktop route group + glass tokens**: Created `app/(desktop)/layout.tsx` (bare layout) and `app/(desktop)/stacks/[id]/page.tsx` (placeholder). Added Ein UI CSS variables to globals.css (--glass-bg, --glass-border, --glass-blur, --glow-cyan/purple/pink, --text-primary/secondary/muted). Added --ease-apple and @keyframes animate-scan.

**Task 2 — Zustand stores**: Created `lib/stores/desktop-store.ts` (cards Record, view state, persist to localStorage) and `lib/stores/chat-store.ts` (messages, chips, mode, streaming — NOT persisted). Inspector passed 8/8 tests.

**Task 3 — Wallpaper layer + store**: Renamed wallpaper files (purple-waves.jpg, aurora.jpg, coral.jpg). Created `lib/stores/wallpaper-store.ts` (image presets, persist), `components/wallpaper/wallpaper-layer.tsx` (full-bleed fixed div), `components/wallpaper/wallpaper-picker.tsx` (thumbnail circles). Wired into desktop page.

**Task 4 — Infinite canvas viewport**: Created `components/desktop/desktop-viewport.tsx` (96 lines). CSS transform pan/zoom, pointer capture, zoom-under-cursor math, transformOrigin: '0 0'. Inspector found stale closure bug in handlePointerMove — fixed by using useDesktopStore.getState() for synchronous reads in hot-path handlers.

**Fixed /desktop 404**: Updated Clerk redirect and landing page CTA from /desktop to /stacks/default.

### Decisions Made
- Used Ein UI's official CSS variables (not custom oklch tokens) — Pathfinder incorrectly reported Ein UI doesn't use CSS vars.
- Images-only wallpapers (no CSS gradients) for prototype simplicity.
- `useDesktopStore.getState()` pattern for event handlers to avoid stale closures — better than functional updater since Zustand supports direct synchronous reads.
- Kept framer-motion (not switching to motion package) — less churn.

### Gotchas
- Pathfinder agent incorrectly reported Ein UI components use hardcoded Tailwind only. Ein UI docs clearly define CSS variables (--glass-bg etc). Always verify against official docs.
- Builder agent tried to use made-up oklch glass tokens instead of Ein UI's rgba vars. User caught it.
- JSX comments `{/* ... */}` compile to nothing — causes "children missing" TS error if children prop is required. Make children optional.
- `(desktop)/` route group doesn't add a URL segment — route is /stacks/[id] not /desktop/stacks/[id]. Landing page was pointing to /desktop which 404'd.

### Next Action
Task 5: Desktop card component (draggable glass card with title bar, zoom-aware drag, mount/close animations). Context already added to Beads. Then tasks 6-12 to complete the glass desktop.

---

## [2026-02-12 22:00] Session 146

**Branch:** main | **Git:** clean

### What Happened
Orchestrated mission on m7b.4.12 (Glass Desktop UI), completed task 5 (Desktop card component) and heavily polished the viewport zoom/pan system.

**Task 5 — Desktop card component** (`components/desktop/desktop-card.tsx`, 139 lines):
- Draggable glass card with pointer capture + zoom-aware movement (`movementX / view.scale`)
- Ref-based drag: position tracked in `localPos` ref during drag, direct DOM updates via `positionRef.current.style.left/top`. Zero React re-renders during drag. Single `moveCard()` sync on drop.
- framer-motion mount/exit animations (scale 0.95→1, apple easing `[0.2, 0.8, 0.2, 1]`)
- Drag visual: `scale(1.02)` + heavy shadow, `userSelect: none` to prevent text highlight
- Title bar (h-11) + close button, content area with `stopPropagation` for future interactive content
- Outer `motion.div` (position/animation) → wrapper div (pointer capture) → `GlassCard` (visual)

**Viewport zoom overhaul** (`components/desktop/desktop-viewport.tsx`, 273 lines):
- Iterated through 5 zoom approaches before finding the sweet spot
- Final: fast lerp (0.5) + Excalidraw-style adaptive sensitivity (`delta/500` base + `log10` boost past 100%)
- Ref-based rendering: `applyAnimationMode()` writes directly to DOM, no React re-renders during zoom/pan
- Sharp text mode: CSS `zoom` property swaps in 200ms after scrolling stops, re-renders text at native resolution
- Pan momentum: exponential decay (0.92/frame), velocity tracked via exponential moving average, 60ms pause detection cancels momentum on intentional stop
- `translate3d` for GPU compositing layer promotion

**Page update** (`app/(desktop)/stacks/[id]/page.tsx`): 5 demo cards seeded, `AnimatePresence` wrapping card iteration.

### Decisions Made
- **Fast lerp (0.5) over instant zoom**: Excalidraw applies zoom instantly (works for canvas rendering), but DOM transforms need smoothing for mouse wheel discrete notches. Lerp at 0.5 closes half the gap per frame (~66ms to settle) — feels instant on trackpad, smooth on mouse.
- **CSS zoom swap for sharp text**: `transform: scale()` stretches bitmaps. CSS `zoom` property re-renders at target resolution. Swap between the two: animation mode during interaction, sharp mode on settle.
- **No lerp on pan**: Pan lerp felt laggy. Pan is instant (direct DOM write) + momentum on release.
- **Ref-based rendering everywhere**: Both viewport and card drag bypass React entirely during hot-path events. Zustand only synced on settle/drop.

### Gotchas
- `style.zoom` doesn't exist in TypeScript's `CSSStyleDeclaration` type — needs cast: `(el.style as unknown as Record<string, string>).zoom`
- Zustand persist means demo cards only seed for missing IDs, not when store is empty (old single card persisted from previous session)
- Excalidraw's `delta/100` sensitivity is calibrated for canvas rendering, way too aggressive for DOM transforms — `delta/500` is the right ballpark
- Momentum needs pause detection: exponential moving average retains residual velocity even after user stops — check `performance.now() - lastMoveTime > 60ms` to zero it out

### Next Action
Task 6: WebSocket provider + canvas_update wiring. Then tasks 7-12 to complete the glass desktop UI.

---

## [2026-02-12 17:40] Session 149

**Branch:** main | **Git:** uncommitted

### What Happened
Completed task m7b.4.12.7 (Top bar — three floating pills) in solo mode.

**DesktopTopBar** (`components/desktop/desktop-top-bar.tsx`, ~100 lines):
- Three-section layout: left app launchers, center workspace tabs, right system tray
- Left: 3 loose GlassButton circles (FileText, LayoutGrid, SlidersHorizontal)
- Center: ChevronLeft + GlassTabSwitcher + Plus button
- Right: GlassPill with zoom %, Search, Bell, User icons
- `pointer-events-none` container, `pointer-events-auto` on interactive elements
- Wired to desktop store: `view.scale` for zoom display, `activeWorkspace` for tab state

**GlassTabSwitcher** (`components/desktop/glass-tab-switcher.tsx`, ~145 lines):
- Custom component inspired by Ein UI glass-tabs styling
- Glass container (bg-white/10, backdrop-blur-xl, border-white/20) with pulsing cyan/blue/purple glow animation
- **Sliding glass indicator**: measures active tab via DOM refs (offsetLeft/offsetWidth), animates with Apple easing (cubic-bezier 0.2,0.8,0.2,1)
- Active tab: bg-white/20 + gradient shimmer (before: pseudo). Inactive: transparent + group-hover highlight
- **Hover actions**: `...` button (left, absolute) opens glass Popover with Rename/Duplicate/Delete placeholder. `X` button (right, absolute) fires onClose. Both fade in via group-hover:opacity-100
- Used `group-hover` instead of `hover` on tab button so hovering dots/X keeps tab highlighted

**Glass Popover**: Glass-styled PopoverContent (bg-white/10, backdrop-blur-2xl, rounded-2xl) with sectioned menu items. Placeholder for workspace CRUD — will become shared context menu.

Also installed Ein UI glass-switch component (`components/ui/glass-switch.tsx`) for reference.

### Decisions Made
- **Ditched GlassTabs for tab switcher**: Ein UI GlassTabs has a hard-coded glow motion.div and its own glass container — creates triple-layer glass when nested inside a pill. Impossible to strip via className. Built custom GlassTabSwitcher with plain buttons instead.
- **DOM ref measurement for sliding indicator**: Percentage-based positioning (50/50 split) doesn't work with variable-width tab labels. Used `querySelector + offsetLeft/offsetWidth` to measure actual positions.
- **`data-value` on wrapper div, not button**: Wrapper div is `position: relative` (for absolutely positioned dots/X), which makes it the offsetParent. Button's offsetLeft would be 0 relative to wrapper. Moving data-value to wrapper fixes measurement.
- **`group-hover` over `hover`**: Dots and X buttons are siblings of the tab button, not children. Regular `hover:bg-white/5` on button disappears when mouse moves to dots/X. `group-hover` on the wrapper keeps all children highlighted.
- **Even padding with absolute close/dots**: `px-6` symmetric padding, dots at `absolute left-0.5`, X at `absolute right-0.5` — sit inside the padding without affecting tab width.
- **Right pill height**: Added explicit `h-10` to GlassPill for right system tray to match center tab switcher height.

### Gotchas
- Ein UI GlassTabsList renders a `<div class="relative">` wrapper with a `<motion.div>` glow sibling — can't be removed or hidden via className props on the List
- `cn()` (tailwind-merge) needed instead of string concatenation for proper class overriding in GlassPill
- Active tab border caused size jump — fixed with `border border-transparent` on inactive tabs (same box model, invisible border)
- `inline-flex` containers don't always respect `h-10` the same way `flex` does — explicit `h-[40px]` was tried but `h-10` works fine

### Next Action
Continue Glass Desktop UI: tasks 6 (WebSocket provider), 8 (Chat bar), 9 (Card restyle), 10-12.

---

## [2026-02-12 17:30] Session 150

**Branch:** main | **Git:** uncommitted (processor.py type fix)

### What Happened
Orchestrated mission on m7b.7 (Sprite VM Structure + Memory System Redesign). Completed 7 of 9 tasks using Pathfinder/Builder/Inspector cycle per task. Created m7b.7.10 for live Sprite hook testing.

1. **T1 (.os/ layout):** Moved all system paths from `/workspace/` to `/workspace/.os/`. 11 files updated across bridge + sprite. Added `/workspace/.os/apps/` for future custom apps feature. Server startup uses `PYTHONPATH=/workspace/.os python3 -m src.server`. 97 bridge + 60 sprite tests.

2. **T3 (6 memory templates):** Created soul.md (25 lines), os.md (57), tools.md (43), files.md (17), user.md (17), context.md (17) in `sprite/memory/`. Deploy-managed (soul, os) vs daemon-managed (tools, files, user, context) split. Removed stale inline constants from bootstrap. 104 bridge tests.

3. **T2 (two databases):** Replaced single `Database` class with `TranscriptDB` + `MemoryDB`. `_BaseDB` extracts shared pattern (WAL, busy_timeout, foreign_keys). FTS5 virtual table with auto-sync triggers on memory.db. 23 database tests.

4. **T5 (hook capture):** `TurnBuffer` + `create_hook_callbacks()` factory in `sprite/src/memory/hooks.py`. 4 hooks: UserPromptSubmit, PostToolUse, Stop, PreCompact. `append_agent_response()` accumulates across TextBlocks. `_build_options()` helper DRYs up 3 ClaudeAgentOptions construction sites. `HookMatcher(matcher=None)` for non-tool hooks — unverified, deferred to m7b.7.10. 17 hook tests.

5. **T7 (search_memory):** Single read-only FTS5 tool in `sprite/src/tools/memory.py`. Moved from `agents/shared/memory_tools.py`. Old write tools deleted. 7 tests (Sprite-only, needs SDK).

6. **T4 (memory loader):** Rewrote `loader.py` — async, loads 6 files via `ALL_MEMORY_FILES` + pending_actions from MemoryDB. Data-driven `_SECTION_HEADERS` dict. Omits empty sections. 56 local tests.

7. **T6 (batch processor):** `ObservationProcessor` in `sprite/src/memory/processor.py`. Reads unprocessed observations, calls Haiku, parses FACT/PATTERN/CORRECTION/PREFERENCE/ACTION/TOOL_INSTALL + *_MD_UPDATE blocks. File rewrites via Path.write_text(). Error handling: API failures don't mark processed. 10 tests (Sprite-only, needs anthropic).

### Decisions Made
- Skip SDK hook spike — build pragmatically, test on live Sprite (m7b.7.10)
- PreCompact always flushes (no auto/manual distinction) — simpler and safer
- `append_agent_response()` instead of `set_agent_response()` — handles multiple TextBlocks per turn
- `/workspace/.os/apps/` added for future user-created lightweight apps feature
- Semver versioning (0.0.0 format) folded into T9 — treat Sprite OS as production
- VERSION bumped to 3 (by T3 Builder, earlier than planned but harmless)

### Gotchas
- `python3 -m src.server` breaks when src moves to `.os/src/` — needs `PYTHONPATH=/workspace/.os`
- `test_search_memory.py` and `test_processor.py` can't run locally (need `claude_agent_sdk` / `anthropic`)
- Pyright diagnostics for SDK types are noise locally — all real on Sprite
- `source_observation_id` in processor points all learnings to first observation in batch — imprecise but unavoidable

### Next Action
- T8: Wire hooks, processor, loader, search_memory into AgentRuntime. Integration task — start fresh session.
- T9: Bootstrap cleanup + semver versioning + full test suite
- T10: E2E hook verification on live Sprite

---

## [2026-02-12 18:30] Session 151

**Branch:** main | **Git:** uncommitted (T8+T9 changes)

### What Happened
Solo mission on m7b.7 (Memory System Redesign), completing T8 and T9 with inspector verification after each.

1. **T8 (Wire memory into AgentRuntime):** Connected all memory subsystems. Key changes:
   - `runtime.py`: Rewrote to accept `transcript_db`, `memory_db`, `processor` params. Removed journal.py/transcript.py imports. `load_memory()` now called with `await` (was sync). `create_memory_tools(memory_db)` passes db instance. TurnBuffer receives agent text via `append_agent_response()`. Session record inserted to transcript.db on start. Removed all TranscriptLogger and append_journal calls.
   - `server.py`: Creates TranscriptDB + MemoryDB connections, ObservationProcessor with `anthropic.AsyncAnthropic()` client, passes all to AgentRuntime. Closes DBs on shutdown.
   - Moved `agents/shared/canvas_tools.py` → `tools/canvas.py` (fixed `...protocol` → `..protocol` import).
   - Deleted `memory/journal.py`, `memory/transcript.py`, entire `agents/` directory.
   - Updated `test_runtime.py`: removed `db=mock_db` fixture, patched `load_memory` as async, added tests for hooks registration, TurnBuffer, memory_tools conditional creation.
   - Updated `test_memory_system.py`: replaced journal/transcript tests with runtime integration checks (no stale imports, correct canvas path).
   - Updated `test_canvas_tools.py` and `manual_canvas_test.py` imports.
   - **Inspector pass**: 12/12 requirements, quality pass.

2. **T9 (Bootstrap cleanup + semver):** Updated Bridge deployment to match new structure.
   - `bootstrap.ts`: srcFiles updated — removed `agents/shared/*`, `journal.py`, `transcript.py`; added `memory/hooks.py`, `memory/processor.py`, `tools/__init__.py`, `tools/canvas.py`, `tools/memory.py`. Directory creation: `tools/` instead of `agents/shared/`. VERSION changed from integer `3` to semver `'0.3.0'`.
   - `updater.ts`: Added `compareSemver()` with legacy integer fallback (treats "3" as 0.0.3). Added stale file cleanup step (rm agents/, journal.py, transcript.py). Creates `tools/` dir on update. Fixes ownership after deploy.
   - `bootstrap.test.ts`: Added test for new tools/ structure vs old agents/shared/. Added semver VERSION format test.
   - `updater.test.ts` (new): 6 tests for compareSemver (equal, older, newer, legacy integers, whitespace).
   - Fixed `test_fallback_prompt_when_no_memory` assertion (empty string is falsy, SDK gets None not "").
   - **Inspector pass**: All requirements met, 168 tests passing (112 bridge + 56 sprite).

3. **T10 (E2E hooks on Sprite):** Claimed, started scouting but ran out of credits. Left in_progress.

### Decisions Made
- `load_memory()` is now fully async — `await load_memory(memory_db)` in all call sites
- `memory_tools` only created when `memory_db` is provided (graceful degradation without DB)
- Semver format `0.3.0` chosen — major 0 = pre-release, minor 3 = third schema revision
- Legacy integer VERSION "3" maps to 0.0.3 via compareSemver (backwards compatible)
- Updater cleans stale files (agents/, journal.py, transcript.py) when upgrading old sprites

### In Progress
- **T10 (m7b.7.10)**: E2E hook test on live Sprite. Status: in_progress, no code written yet. Need to: deploy updated code to sprite, write E2E test script, run with real SDK to verify hook signatures. Sprite CLI is available locally. ANTHROPIC_BASE_URL must point to Bridge API proxy for SDK to work on sprite.

### Next Action
- Deploy code to test sprite, write and run E2E hook verification test (T10). Then m7b.7 feature is complete.

---

## [2026-02-12 21:10] Session 152

**Branch:** main | **Git:** uncommitted

### What Happened
Completed two Glass Desktop UI tasks via orchestrated and solo modes.

**Task m7b.4.12.6 — WebSocket provider + canvas_update wiring** (orchestrated: Pathfinder → Builder → Inspector):
- Created `frontend/components/desktop/ws-provider.tsx` (~131 lines): React context provider wrapping `WebSocketManager` in `useRef`, auto-connects on mount, dispatches messages to Zustand stores.
- `canvas_update` → desktop-store (`addCard` with auto-placed position, `updateCard`, `removeCard`)
- `agent_event` → chat-store (`appendToLastAgent` for streaming, `addMessage` for tool/error/complete)
- Created `frontend/components/desktop/auto-placer.ts` (~42 lines): pure function placing new cards in grid pattern from viewport center, SSR-safe.
- Modified `frontend/app/(desktop)/stacks/[id]/page.tsx`: wrapped in `<WebSocketProvider>`, removed demo card seeding.
- Inspector verified 7/7 test criteria pass. Fixed minor type issue (`Record<string, unknown>` → `Partial<Omit<DesktopCard, 'id'>>`).

**Task m7b.4.12.8 — Chat bar (bottom pill)** (solo with design brainstorm):
- Created `frontend/components/desktop/chat-bar.tsx` (~175 lines): voice-forward chat bar inspired by ChatGPT/Gemini/Claude input patterns but adapted for glass desktop OS.
- Layout: glass rounded-3xl rectangle (500px), two states — idle (action bar with "Ask anything..." hover zone) and active (textarea + send button).
- Idle state: `[+]` attach left, center clickable hover zone with placeholder, mic + chat-toggle right.
- Active state: textarea appears above action bar, send button in top-right aligned with chat icon below.
- Suggestion chips float above bar when agent sends them, disappear when typing.
- Agent streaming glow: subtle pulsing cyan/blue/purple gradient on bar border.
- All buttons use `GlassButton` component for consistent icon centering.
- Installed `@einui/glass-tooltip` — glass-styled tooltips on all buttons (chat bar + top bar), 800ms delay, shared provider at page level.

**Top bar tweaks:**
- System tray icons: `rounded-xl` → `rounded-full` for proper circles.
- Back button chevron: `-ml-0.5` nudge for visual centering.
- Added glass tooltips to all top bar buttons (Documents, Apps, Settings, Back, New workspace, Search, Notifications, Account).

### Decisions Made
- **Two-row glass bar over single-line pill**: Brainstormed extensively with user. Reference prototype's single-line pill with chips was too crowded. Industry standard (ChatGPT, Gemini, Claude) is two-row with textarea + action bar. User wanted voice-forward but settled on "clean glass bar with text input always available."
- **Chips float above, not inside**: User wanted bar to be lightweight. Chips are contextual (agent-sent only), not permanent UI.
- **No placeholder text initially, then added "Ask anything..."**: Started with empty bar for Her/Jarvis aesthetic, but user agreed discoverability matters for a business tool.
- **Send button in textarea area, not action bar**: Prevents mic/chat icons from shifting when text is entered.
- **GlassTooltipProvider at page level**: Shared 800ms delay for both top bar and chat bar tooltips.

### Gotchas
- Empty `<button>` with `flex-1` collapses to zero height — needs explicit `h-9`.
- Action bar padding changing between idle/active states (`py-2.5` vs `pb-3 pt-1`) caused icons to nudge up — fixed with consistent `py-2.5`.
- Plain `<button>` with `flex items-center justify-center` didn't center icons as reliably as `GlassButton` component — switched all chat bar buttons to `GlassButton`.
- `GlassButton` wraps in `<div className="relative inline-block">` then inner `<span>` — this structure centers icons correctly but is worth knowing about.
- Protocol message type is `'mission'` not `'chat'` — Builder initially used wrong type.

### Next Action
Continue Glass Desktop UI: tasks 9 (restyle card-renderer for glass), 10 (chat panel), 11 (documents panel), 12 (wallpaper images). Tasks 10+11 are now unblocked by WS provider completion.

---

## [2026-02-13 11:10] Session 155

**Branch:** main | **Git:** uncommitted (bridge changes)

### What Happened
Debugged and fixed the broken Bridge-to-Sprite connection pipe (m7b.4.11). Full E2E loop now working: user types in browser -> Bridge -> Sprite agent -> agent creates cards -> canvas_update flows back through Bridge -> card renders in browser.

**Debugging (exploration-debug mode):**
- User saw `TCP Proxy closed during init: 1011` when connecting from test-chat page
- Traced the full message path: sprite-connection.ts -> proxy.ts -> index.ts
- Found root cause: Bridge had NO logic to start the Sprite's Python server on initial connect
- Three bugs identified: (1) provisioning never started server after bootstrap, (2) proxy gave up on 1011 instead of retrying, (3) reconnect.ts didn't pass env vars when starting server via exec

**Implementation (mission-orchestrated: Pathfinder -> Builder -> Inspector):**
- `bridge/src/provisioning.ts`: Added `startSpriteServer()` exported function with env vars. Called after `bootstrapSprite()` in `provisionSprite()`. Removed dead `buildServerExecUrl`.
- `bridge/src/proxy.ts`: Added try/catch in `ensureSpriteConnection` — detects `TCP Proxy closed during init` error, starts server via exec, retries connect once.
- `bridge/src/reconnect.ts`: Replaced inline exec logic in `defaultRestartServer` with shared `startSpriteServer` call. Fixes missing env vars bug (ANTHROPIC_BASE_URL etc).
- `bridge/tests/provisioning.test.ts`: Fixed stale test description referencing deleted `buildServerExecUrl`.
- Inspector review: PASS on requirements (4/4) and quality. Two info-level findings (non-blocking).

**Deployment and testing:**
- Deployed to Fly.io (`flyctl deploy`). Retry logic fired but still failed.
- Found `spriteExec` uses `sprite` CLI binary not available on Fly.io Docker container (ENOENT). Created bug bead stackdocs-sm2.
- Found `/workspace/.os/.venv/` didn't exist on Sprite `sd-e2e-test` (old venv at `/workspace/.venv/`).
- Created symlink `/workspace/.os/.venv -> /workspace/.venv` and wrote VERSION file via Sprites.dev API.
- Reconnected successfully. Agent created Tool discography card — full E2E confirmed working.

### Decisions Made
- **Shared `startSpriteServer` in provisioning.ts**: Both proxy.ts and reconnect.ts import it. Single source of truth for exec command + env vars. No circular imports.
- **Retry once, not loop**: proxy.ts catches 1011, starts server, retries createAndRegister once. If that fails too, error propagates. Simple and predictable.

### Gotchas
- `spriteExec` (`bridge/src/sprite-exec.ts`) uses `execFile('sprite', ...)` — the CLI binary. This works locally but NOT on Fly.io. All updater/bootstrap operations broken in production. Tracked as stackdocs-sm2 (P1).
- Sprite `sd-e2e-test` had code at `/workspace/.os/src/` but venv at old path `/workspace/.venv/`. Symlink fixed it. Future Sprites need proper bootstrap.
- 3s wait in `startSpriteServer` (1s post-open + 2s bind) may be too short for cold Sprite wake (up to 12s). Worked for warm Sprite. May need tuning.
- Agent sends `blocks` as JSON string not parsed array — block renderer (m7b.4.12.9) needs to handle this.

### Next Action
m7b.4.12.9 — Block renderer (frontend). Pure frontend task. Build `<BlockRenderer blocks={Block[]}/>` for all 8 block types with glass styling. Replace raw JSON dump with actual rendered heading/table/key-value/etc.

---

## [2026-02-13 11:00] Session 154

**Branch:** main | **Git:** uncommitted

### What Happened

**Fixed panel rendering bug**: ChatPanel and DocumentsPanel were extracted into separate components (session 152) but never imported/rendered in `app/(desktop)/stacks/[id]/page.tsx`. Added imports and JSX mounts.

**ChatBar DRY refactor** — added `embedded` prop to `chat-bar.tsx`:
- `embedded={false}` (default): fixed bottom bar with visibility toggle, w-[500px], chat-toggle button
- `embedded={true}`: renders inline, w-full, no positioning, hides chat-toggle (shows dock-to-bottom instead)
- ChatPanel now renders `<ChatBar embedded />` instead of its own duplicate input area (~80 lines removed)
- Replaced X close button in ChatPanel header with Message icon toggle in embedded ChatBar

**ChatBar height jump bug** — systematic debugging traced root cause:
- `GlassButton` wraps every button in `<div className="relative inline-block">` (glass-button.tsx:73)
- Send button's `absolute` class went on inner `<button>`, NOT the outer wrapper div
- Wrapper stayed in flow, creating ~24px phantom line box when send button appeared on first keystroke
- Fix: wrapped entire send button block in `<div className="absolute right-3 top-3">`, moved positioning there

**ChatBar textarea animation** — replaced instant conditional render with CSS grid-rows transition:
- `grid-rows-[0fr]` → `grid-rows-[1fr]` (300ms, Apple easing) for smooth expand/collapse
- Content fades in with 200ms delay (prevents cursor showing during expansion)
- Focus delayed to 250ms to match animation
- Removed JS auto-resize effect, replaced with CSS `field-sizing: content`

**BlockRenderer** (orchestrated: Pathfinder → Builder → Inspector):
- Created `frontend/components/desktop/block-renderer.tsx` (146 lines)
- 8 block types: heading, stat, key-value, table, badge, progress, text, separator
- Glass styling throughout (white/alpha classes only)
- Wired into page.tsx replacing placeholder. Inspector 10/10 pass.

**Code review + cleanup** (7 fixes):
1. Tooltip refocus bug — `GlassTooltipTrigger` was raw Radix passthrough missing `onFocus`/`onFocusCapture` prevention (fix from Jan applied to tooltip.tsx but never to glass-tooltip.tsx)
2. Dead state — removed `isTyping`/`setTyping` from chat-store (`isAgentStreaming` serves same purpose)
3. Removed `console.log` from desktop-top-bar.tsx
4. `onPointerDown` → `onClick` on card close button (keyboard accessibility)
5. Extracted `sendMessage` helper in chat-bar (DRY chip click vs handleSend)
6. Inline `style={{ maxHeight }}` → Tailwind `max-h-[120px]`
7. Removed border-b/border-t lines from glass-side-panel.tsx and chat-panel.tsx

**Tasks closed**: m7b.4.12.9, m7b.4.12.10, m7b.4.12.11 (3 tasks)
**Tasks created**: m7b.4.12.13 (restyle desktop right-click context menu)

### Decisions Made
- **`embedded` prop over component extraction**: User wanted maximum DRY — one ChatBar component, modify once changes everywhere. Props approach simpler than extracting a separate ChatInput component.
- **CSS grid-rows for height animation**: Standard Tailwind pattern for animating height 0→auto without JS measurement. Combined with delayed opacity + focus for polish.
- **Kept "dead" WebSocket code**: `handlers`/`on()`, `clearMessages`, `setChips` look unused but will be needed when Sprite agent is wired up. Only removed genuinely dead `isTyping`/`setTyping`.

### Gotchas
- `GlassButton` wraps in `<div className="relative inline-block">` — any GlassButton meant to be absolutely positioned needs its own absolute wrapper div, because the `absolute` class goes on the inner button, not the outer wrapper.
- `field-sizing: content` on textarea replaces JS auto-resize but needs explicit `max-h-[120px]` cap.
- Glass tooltip refocus bug: when adding new tooltip variants (like GlassTooltip), must copy the focus prevention pattern from the base tooltip component.

### Next Action
- Add wallpaper images (user has them ready) and update wallpaper-store.ts entries
- Restyle desktop right-click context menu (m7b.4.12.13) — use **frontend-design skill** for creative quality
- Phase A: 11/12 tasks done. Only wallpaper sourcing (P2) + new context menu task remain.

---

## [2026-02-13 12:00] Session 155

**Branch:** main | **Git:** uncommitted

### What Happened

**Desktop right-click context menu (m7b.4.12.13)** — brainstormed approach, then implemented:
- Installed shadcn `context-menu` (Radix ContextMenu primitive)
- Created `frontend/components/ui/glass-context-menu.tsx` — glass wrapper (GlassContextMenuContent, GlassContextMenuItem, GlassContextMenuLabel, GlassContextMenuSeparator) following the glass-tooltip pattern
- Created `frontend/components/desktop/desktop-context-menu.tsx` — 3-section menu: Environment (wallpaper thumbnails with active checkmark), View (3-col zoom grid + disabled "Clean Up By Name"), Stack (disabled Rename/Settings placeholders)
- Added zoom icons to `components/icons/index.ts`: ZoomIn, ZoomOut, ZoomReset
- Updated `desktop-viewport.tsx`: accepts rest props via `ViewportProps extends HTMLAttributes<HTMLDivElement>` (needed for Radix asChild to forward onContextMenu), added `desktop-zoom` custom event listener that zooms toward viewport center using the existing lerp animation system
- Wired into `page.tsx`: `<DesktopContextMenu>` wraps `<DesktopViewport>`
- Right-click context menu works correctly with glass styling and animated zoom controls

**Tab popover restyle attempt (FAILED — stackdocs-qj2)**:
- Replaced shadcn Popover import with raw `@radix-ui/react-popover` PopoverPrimitive in `glass-tab-switcher.tsx`
- Applied identical glass classes as the working context menu
- Cleared `.next` cache, restarted dev server — popover still renders with old styling
- Code verified correct in file but UI doesn't reflect changes
- Created bug bead `stackdocs-qj2` — needs DevTools investigation to trace CSS specificity issue

### Decisions Made
- **shadcn context-menu over einui glass-popover**: Radix ContextMenu is the correct primitive for right-click menus. Glass popover would need manual positioning.
- **Custom event for zoom sync**: `desktop-zoom` CustomEvent dispatched from context menu, listened by viewport. Avoids polluting Zustand store, keeps zoom animation system intact.
- **Disabled placeholders**: "Clean Up By Name", "Rename Stack", "Stack Settings" rendered as disabled menu items — no backing store actions exist yet.

### Gotchas
- `DesktopViewport` only accepted `{ children }` — Radix `asChild` needs the child component to forward props. Had to add `...rest` spread to the root div.
- `startZoomAnimation` must be declared before the `useEffect` that references it — declaration order matters with `useCallback`.
- Tab popover uses raw `PopoverPrimitive` with correct glass classes but still renders old styling. Context menu with identical classes works fine. Root cause unknown — suspected CSS specificity from globals.css base layer (`* { @apply border-border }`) or Radix data-attribute selectors.

### In Progress
- **stackdocs-qj2**: Tab "..." popover styling bug. Code is correct, UI doesn't reflect it. Needs browser DevTools to inspect computed styles on the popover element and trace what's winning the CSS fight.

### Next Action
- Debug stackdocs-qj2 with DevTools (inspect `[data-radix-popper-content-wrapper]` styles, check for `bg-popover` CSS var leaking)
- Close m7b.4.12.13 once tab popover is also fixed
- Source wallpaper images (m7b.4.12.12) to wrap up Phase A

---

## [2026-02-13 14:20] Session 156

**Branch:** main | **Git:** uncommitted

### What Happened

**m7b.4.9 — Agent system prompt + canvas tool API update (CLOSED):**

Protocol sync across 3 codebases — added `CardSize` type (`small`|`medium`|`large`|`full`) and `size` field to `CanvasUpdate` payload:
- `bridge/src/protocol.ts` — `CardSize` type + `size?: CardSize` in CanvasUpdate payload
- `frontend/types/ws-protocol.ts` — mirror of bridge
- `sprite/src/protocol.py` — `CardSize` Literal + `size` field on `CanvasUpdatePayload`

Canvas tools (`sprite/src/tools/canvas.py`):
- Replaced `card_type` param with `size` in `create_card` (default `"medium"`)
- Added optional `size` to `update_card` for resizing
- `VALID_CARD_TYPES` → `VALID_SIZES`, validation updated
- Added `size` to tool schema dict: `{"title": str, "size": str, "blocks": list}`

Frontend integration:
- `frontend/lib/stores/desktop-store.ts` — `size: CardSize` on `DesktopCard` interface
- `frontend/components/desktop/ws-provider.tsx` — passes `size` through on create/update

System prompt (`sprite/memory/os.md`):
- Added named block composition patterns (overview, data, status, extraction)
- Added close_card guidance to "Managing cards" section
- Canvas section already had `size` terminology — os.md was ahead of the tool API

**conftest.py for local Sprite testing (NEW):**
- `sprite/tests/conftest.py` — mocks `claude_agent_sdk` when not installed locally
- `_ToolWrapper` class mimics SDK's `@tool` decorator (returns objects with `.handler`)
- Stubs for `ClaudeSDKClient`, `ClaudeAgentOptions`, etc. (MagicMock)
- All 69 locally-runnable Sprite tests pass (17 canvas, 7 search, 22 db, 16 hooks, 7 memory)

**Tests updated** (`sprite/tests/test_canvas_tools.py`):
- All `card_type` references → `size` (or removed)
- 3 new tests: default size, update_card with size, update_card invalid size
- 17/17 pass

**Deployed + E2E tested** on `sd-e2e-test` Sprite:
- Full deploy cycle: code upload, ownership fix, server restart
- E2E pipe working: browser → Bridge → Sprite agent → canvas_update → browser
- Discovered model still passes `card_type` instead of `size` (tracked as m7b.4.13)

### Decisions Made
- **`size` replaces `card_type`**: `card_type` was validated but never sent to frontend — phantom param. `size` actually affects rendering (card width on grid).
- **os.md over loader.py for Canvas prompt**: User correctly pointed out Canvas instructions belong in memory files (deploy-managed), not hardcoded in the loader. os.md already had the content.
- **conftest.py mock over SDK install**: Lightweight stub unblocks local testing. Real SDK stays Sprite-only. Integration tests still require Sprite.

### Gotchas
- **SDK client persists across connections**: `AgentRuntime._client` survives reconnections. Deploying new code doesn't update tool definitions until server restarts AND the old `claude` CLI subprocess is killed.
- **`pgrep` false positives on Sprites**: `pgrep -f "python"` catches the ephemeral bash/grep processes from exec commands. Use `ps aux | grep -vE "grep|bash" | grep python` instead.
- **Proxy timeout on first server start**: Normal race condition. Server binds but proxy can't connect in time. Run test-e2e-v2 twice.
- **Model ignores `size` param**: Even with `size` in tool schema and description, Sonnet still passes `card_type`. Tracked as m7b.4.13 (P2). Functionally non-blocking — defaults to "medium".

### Next Action
- Fix m7b.4.13 (model ignoring size) — try stronger tool description or investigate SDK tool registration
- m7b.4.8 (CSV/JSON export, P2) is the last task in Phase 3
- m7b.4.12 has 2 remaining sub-tasks (context menu restyle, wallpaper sourcing)

---

## [2026-02-13 17:30] Session 157

**Branch:** main | **Git:** uncommitted

### What Happened

**Architecture brainstorm: One Sprite VM per user (spec written):**

Major architectural pivot explored and documented. Changed from one Sprite VM per stack to one Sprite VM per user. Key decisions made through interactive brainstorm:

- **VM model**: One Sprite per user (cost savings, cross-workspace intelligence)
- **WS model**: One connection per user (`/ws/`, user from JWT, no stackId in URL)
- **"Stacks" become "Desktops"**: Lightweight virtual desktop layouts, like macOS Spaces. Not isolated workspaces. Tab switching, not URL routing.
- **Agent is user-level**: Works across all desktops. Gets compact canvas context (card IDs, titles, block types) with every message.
- **Card state**: Sprite DB is source of truth, localStorage cache for instant render on page load (avoids 1-12s Sprite wake delay)
- **Chat history**: Persisted on Sprite, loaded on WS connect
- **Desktop metadata**: Supabase for tab bar (instant load) + billing limits. Card content on Sprite only.
- **Supabase schema**: `sprite_name`/`sprite_status` move from `stacks` to `users`. `stacks` table renamed to `desktops` (id, user_id, name, position, created_at).

Research agent explored all 3 codebases (bridge, sprite, frontend) — found 19 coupling points where stackId-as-routing-key is baked in. Bridge has the deepest coupling (proxy Map, reconnect, keepalive, connection store all keyed by stackId). Sprite runtime is cleanest — completely single-tenant with no stack concept, favorable for the change.

**Protocol changes designed:**
- `mission` payload gains `context?: { desktop_id, cards: [{id, title, size, block_types}] }`
- `canvas_update` gains `desktop_id` field
- New `state_sync` message (Sprite -> browser on connect): all cards, desktops, recent chat
- No `switch_desktop` message — context comes with user messages

**Spec written to:** `.space-agents/exploration/ideas/2026-02-13-one-sprite-per-user/spec.md`

### Decisions Made
- **One VM per user, not per stack**: Stacks are too lightweight (like tabs) to justify their own VMs. Agent needs cross-workspace intelligence.
- **Desktops are canvas layouts, not data containers**: No per-desktop filesystem isolation, no per-desktop DB. Agent manages one shared filesystem.
- **Supabase for metadata, Sprite for content**: Desktop list in Supabase (instant page load, billing). Card content on Sprite only. localStorage as cache layer.
- **No desktop-switch notifications**: Agent only learns about active desktop when user sends a message. Simpler protocol, no wasted context.
- **Compact context over full content**: Send card IDs + titles + block types (not full block data). Agent can fetch full content via tools if needed.

### Next Action
- `/plan` on the spec to break into ordered implementation tasks
- This is a significant refactor touching Bridge (re-key by userId), Supabase (schema migration), Frontend (single-page + tab switcher), and Protocol (context enrichment + state_sync)

---

## [2026-02-13 19:00] Session 158

**Branch:** main | **Git:** uncommitted

### What Happened

**Tab popover fix (stackdocs-qj2 — CLOSED):** The "..." button on tabs was showing an old Workspace/Rename/Duplicate/Delete popover. Root cause wasn't CSS — it was showing the WRONG content. Replaced popover body with the same Environment/View/Stack menu used by the right-click context menu. Extracted shared `DesktopMenuBody` component in `desktop-context-menu.tsx` to avoid duplication. `glass-tab-switcher.tsx` now imports `DesktopMenuBody` instead of inline content.

**Context menu restyle (m7b.4.12.13 — CLOSED):** Already done in session 155. Confirmed working, closed the bead.

**Unused UI component cleanup:** Ran audit via subagent — found 19 unused component files in `components/ui/` (18 shadcn primitives + 2 glass components: `glass-dock`, `glass-switch`). Deleted all 19. `components/ui/` now has 8 files that are actually used.

**Wallpaper update (m7b.4.12.12):** Replaced old wallpapers (aurora, coral) with 9 new grainy gradient wallpapers. Resized from 5K (~4MB each) to 2560px (~250KB each) via `sips`. Named: Neon Silk, Amethyst Tide, Electric Dusk, Ocean Breeze, Cosmic Spiral, Neon Ribbon, Crimson Wave, Scarlet Bloom, Coral Tide. Kept Purple Waves. Updated `wallpaper-store.ts`. Wallpaper thumbnails now circular (`rounded-full`).

**Menu section reorder:** Changed from Environment/View/Stack to Stack/View/Environment (top to bottom). Wallpaper names left-aligned.

**Removed wallpaper picker overlay:** Deleted `<WallpaperPicker>` from desktop page — wallpaper switching now only via context menu / tab popover.

**Top bar centering:** Tab bar was centered between left/right icon groups (flexbox `justify-between`), not page-centered. Fixed with `absolute left-1/2 -translate-x-1/2` positioning.

**Zoom % moved to menu:** Removed zoom percentage from top-right pill bar. Added it as the middle button in the View section zoom controls (between zoom out/in). Clicking it resets to 100%. Fixed slow update — added immediate `setView({ scale })` call in viewport's desktop-zoom handler instead of waiting for 150ms `SYNC_DELAY`.

**CSS variable wiring attempt (REVERTED):** Sent subagent to wire `--glass-bg`, `--glass-border` etc. to all components. Variables had WRONG values — `--glass-bg: 0.05` but components use `bg-white/10` (0.10), `--glass-border: 0.1` but components use `border-white/20` (0.20). Agent changes made borders/backgrounds half as visible. Reverted `glass-card.tsx` and `glass-button.tsx`. Other files weren't touched by agent.

**One Sprite per user architecture:** User decided to change from one Sprite per stack to one Sprite per user. Created detailed brainstorm prompt for a separate session covering Bridge routing, Supabase schema, filesystem layout, WebSocket protocol, and memory system changes.

### Decisions Made
- **One Sprite per user** (not per stack) — decided, brainstorm prompt created for separate session
- **Shared `DesktopMenuBody`** — single source of truth for menu content, rendered in both ContextMenu (right-click) and Popover (tab dots)
- **CSS variables need value update before wiring** — `--glass-bg` should be 0.10, `--glass-border` should be 0.20 to match what components actually use

### Gotchas
- **Tab popover "styling bug" was actually a content bug** — the CSS was fine, it was just showing the wrong popover entirely
- **Ein UI CSS vars are set to LOWER opacity than what looks good** — must update values before wiring to components
- **Zoom % lag** — `SYNC_DELAY = 150ms` debounce in viewport delays store updates; fixed by writing scale immediately on external zoom events

### Next Action
- Fix CSS variable values (`--glass-bg: 0.10`, `--glass-border: 0.20`) then re-wire to all glass components
- Close m7b.4.12.12 (wallpaper images done)
- Brainstorm one-Sprite-per-user architecture in separate session

---

## [2026-02-13 17:00] Session 160

**Branch:** main | **Git:** uncommitted

### What Happened

**Card drag momentum:** Added physics-based momentum to card dragging in `desktop-card.tsx`. Velocity tracked via exponential moving average (same 0.6/0.4 blend as viewport), RAF momentum loop with 0.92 decay on flick release. Constants (`MOMENTUM_DECAY`, `MOMENTUM_MIN`, `FLICK_WINDOW`) match `desktop-viewport.tsx` for consistent feel.

**Card lift animation:** Added smooth scale(1.02) + shadow transition on grab/release using Apple easing (0.25s). Fixed rectangular shadow artifact by adding `rounded-2xl` to the cardRef wrapper div.

**Icon stroke weight:** Global Tabler icon stroke-width set to 1.25 (from default 2) in `globals.css`.

**Chat toggle rework:** Removed "Assistant" label, status dot, and "Connecting to agent..." from chat panel. Added `LayoutBottombar` icon to panel header for dock-to-bottom. Bottom bar uses `PanelRight` icon to open panel. Panel height adjusted (`top-20`).

**Documents panel overhaul:** Removed folder icon from header. Replaced custom `TreeItem` with Vercel AI Elements `FileTree` component, restyled for glass. All icons neutralized to `text-white/50`. Upload button moved to header icon row. Header buttons bumped to `size-10`.

**GlassIconButton extraction:** Created `components/ui/glass-icon-button.tsx` — reusable tooltip+button wrapper replacing 16 instances across 5 files. Defaults: `size-10`, `text-white/70`, `[&_svg]:size-[22px]`. Callers now pass bare `<Icons.Search />`.

**Code review:** Full review of desktop components. 0 critical, 8 medium, 22 low. Four medium findings stored in stackdocs-m7b.4.12.14.

### Decisions Made
- **Icon stroke 1.25** — settled between 1 (too thin) and 1.5
- **Standardized icon color to text-white/70** and size to 22px, baked into GlassIconButton
- **AI Elements FileTree** over custom recursion — context-based state, keyboard nav, selection built-in

### Gotchas
- **Card shadow rectangle** — inner div had no border-radius, transitioning shadow showed rectangular outline. Fix: `rounded-2xl`.
- **Turbopack stale cache** — bulk import removal required `rm -rf .next` and server restart
- **FileTree onSelect type conflict** — HTML `onSelect` event conflicts with component prop. Fix: `Omit<HTMLAttributes, 'onSelect'>`

### Next Action
- Hit 4 review findings in stackdocs-m7b.4.12.14
- Wire + button for new tabs, CSS variable values fix

---

## [2026-02-13 22:30] Session 159

**Branch:** main | **Git:** uncommitted

### What Happened

**Planning session: One Sprite Per User refactor (spec → plan → Beads)**

Took the Session 157 spec (`.space-agents/exploration/ideas/2026-02-13-one-sprite-per-user/spec.md`) through the full planning pipeline:

1. **Convened planning council** — 3 sequential agents (Task Planner, Sequencer, Implementer) analyzed the spec. Task Planner produced 21 tasks, Sequencer identified critical path of 14 tasks across 5 phases, Implementer provided TDD guidance per task.

2. **Synthesized into 17 tasks** — Merged tightly-coupled tasks (auth+index+connection-store, proxy+reconnect, WS+routing, chatbar+canvas-handler) to avoid broken intermediate states. 5 phases: Foundation → Bridge → Sprite → Frontend → Integration.

3. **Design discussions refined the architecture:**
   - **Archive model** — Nothing is ever destroyed. Closing a stack sets `status='archived'` with `archived_at` timestamp. Closing a card archives it too. Archiving a stack cascades to all its cards. Agent can search/reference all archived data. Sprite is a persistent knowledge base that accumulates over time.
   - **User-initiated vs agent-initiated actions** — User UI actions (close tab, close card, create stack) go through `canvas_interaction` WS messages → Sprite gateway handles directly as system operations (no agent involvement). Agent learns of changes passively via updated `context.cards` in next message. Agent-initiated actions use tools that call same DB methods.
   - **Naming convention** — "Stack" is the canonical term everywhere (not desktop/workspace/canvas). `stackId` = which canvas layout. `userId` = which Sprite VM. They never cross. Bridge routes by userId, protocol references stack_id for card placement.
   - **Supabase migration simplified** — `stacks` table keeps its name (no rename to desktops). Just move `sprite_name`/`sprite_status` columns to `users` table, add `status`/`archived_at` columns to `stacks`.

4. **Codebase naming audits** — Sent explore agents to audit all 3 codebases:
   - **Bridge**: 60+ routing `stackId` refs that need → `userId`. Zero desktop/workspace confusion. Clean.
   - **Sprite**: Completely clean. No domain-level stack/desktop naming. All additive.
   - **Frontend**: `activeWorkspace` → `activeStackId`, store types need `stackId` field, `components/desktop/` folder stays (refers to visual environment).

5. **Created Beads** — Feature `stackdocs-m7b.12` with 17 tasks, all dependencies wired. Plan moved to `mission/staged/m7b.12-one-sprite-per-user/`.

### Decisions Made
- **Archive model for stacks AND cards** — nothing is ever destroyed, agent can search all history
- **Gateway handles user UI actions directly** — no agent involvement for close/create/archive operations
- **Keep "stack" as the canonical name** — matches brand (Stackdocs), no rename needed for Supabase table
- **Keep `components/desktop/` folder name** — "desktop" there means visual OS environment, not the data concept
- **Merged tightly-coupled tasks** — auth+index+connection-store as one task, etc. (21 → 17 tasks)
- **Free tier: 3 stacks, 50 chat messages on connect, debounced position sync, last-write-wins for multi-tab**

### Next Action
- `/mission` on `stackdocs-m7b.12` to begin implementation
- Start with Task 1 (Protocol types) and Task 2 (Supabase schema) — both have no blockers

---

## [2026-02-13 23:45] Session 161

**Branch:** main | **Git:** uncommitted

### What Happened

**Frontend cleanup: review findings + code simplification + CLAUDE.md audit**

1. **Executed `stackdocs-m7b.4.12.14`** — 4 review findings from session 160:
   - **ChatPanel → GlassSidePanel refactor** (`chat-panel.tsx`): Eliminated duplicated glass container/animation code. ChatPanel now uses GlassSidePanel with `side="right"`, custom `closeIcon={<Icons.LayoutBottombar />}`, `containerClassName` for streaming glow. GlassSidePanel gained 3 new optional props: `closeIcon`, `closeTooltip`, `containerClassName`, plus `title` became optional.
   - **GlassButton dead code** (`glass-button.tsx`): Removed `glowEffect` prop (never used with `true`), wrapper `<div>`, and inner `<span>`. Fixes Radix `asChild` compatibility. 87→81 lines.
   - **ChatMessage stable keys** (`chat-store.ts`, `chat-panel.tsx`): Added `id: string` to `ChatMessage` interface, auto-generated via `crypto.randomUUID()` in store. `ChatMessageInput` type makes `id` optional at call sites. Fixed `key={i}` → `key={msg.id}`.
   - **appendToLastAgent perf**: Deferred — premature optimization at current scale.

2. **Code simplifier review** — agent scanned all 47 frontend files, found 1 critical + 7 medium + 4 low:
   - **Extracted `hooks/use-momentum.ts`** — shared momentum physics hook used by both `desktop-card.tsx` (204→167 lines) and `desktop-viewport.tsx` (307→283 lines). ~80 lines of duplicated velocity tracking, RAF loop, flick detection consolidated.
   - **GlassCard inner wrapper removed** (`glass-card.tsx`): Deleted unnecessary `<div className="relative z-10">`.
   - **GlassSidePanel nested ternary simplified**: Extracted `hiddenTransform` variable.
   - **Empty `(desktop)/layout.tsx` deleted**: Next.js App Router doesn't need fragment wrapper.
   - **WebSocket `handlers` TODO**: Added comment for future review (per user instruction — still WIP).

3. **Final code review** — second agent verified all changes. 4 "critical" findings were all false positives (verified: `animate` self-ref is stable useCallback pattern, ref-sync during render is standard, `radix-ui` 2.x import is correct, viewport forward refs are pre-existing). TypeScript: 0 errors. Build: clean.

4. **CLAUDE.md audit** — all 3 frontend docs were significantly outdated:
   - **`frontend/CLAUDE.md`**: Full directory tree rewrite. Removed stale refs (canvas/, agent/, documents/, stacks/, glass-dock.tsx, ws-store.ts, canvas-store.ts, layout.tsx). Added actual dirs (desktop/ with 12 files, wallpaper/, ai-elements/). Correct stores, hooks, shadcn count (3 not 16).
   - **`frontend/components/ui/CLAUDE.md`**: Replaced 20+ non-existent shadcn categories with actual 10 components (3 managed + 7 glass).
   - **Root `CLAUDE.md` frontend section**: Updated directory tree to match reality.

### Decisions Made
- **Finding 4 deferred** — appendToLastAgent array copy per token is O(n) but fine at current scale. Immer/batching only worth it with actual perf issues.
- **WebSocket handlers left as TODO** — infrastructure exists internally but no external callers yet. User wants future agent to review when message routing is implemented.
- **Code reviewer false positives documented** — animate self-ref, ref-sync during render, radix-ui 2.x import, and viewport forward refs are all valid patterns. Noted for future reviewers.

### Next Action
- `/mission` on `stackdocs-m7b.12` (One Sprite Per User) — tasks .12.1 (protocol types) and .12.2 (Supabase schema) are unblocked
- Or continue Glass Desktop polish (m7b.4.12 review findings all closed)

---

## [2026-02-13 22:30] Session 162

**Branch:** main | **Git:** uncommitted (spec file only)

### What Happened

**Voice integration brainstorm — full spec produced.**

Explored adding bidirectional voice (STT + TTS) to the Stackdocs frontend. Multi-round brainstorm covering architecture, providers, UX, security, and cost.

1. **Architecture decided**: Voice is a browser I/O layer. Sprite agent stays the brain. Raw audio never touches Bridge or Sprite. Two thin Next.js API routes handle provider auth/CORS (`/api/voice/deepgram-token` for temp tokens, `/api/voice/tts` as OpenAI proxy).

2. **Providers chosen**: Deepgram Nova-3 for STT ($0.0077/min, streaming WebSocket, best accuracy at 5.26% WER). OpenAI `gpt-4o-mini-tts` with `fable` voice for TTS ($0.60/1M input tokens + $12/1M audio output tokens, ~$0.015/min).

3. **UI design**: Vercel AI Elements Persona component (Rive animation) replaces mic button in chat bar. States: idle, listening, thinking, speaking, asleep. Layout toggle moves to chat panel top bar. Real-time transcription preview in chat input field.

4. **MVP scoped**: Tap-to-record, tap-to-send (no VAD/continuous mode). Separate mic and TTS toggles. No cancel recording. No accessibility in v1. Continuous conversation mode explicitly deferred to v2.

5. **Research agent** compared TTS/STT landscape: ElevenLabs (best quality, 4-5x expensive), Deepgram (best single-vendor), Cartesia (lowest latency at 40ms), OpenAI Whisper (no streaming — eliminated). Browser Web Speech API not production-viable (Chrome-only, broken Edge).

6. **Two review agents** caught critical spec issues:
   - OpenAI TTS is CORS-blocked from browsers → must use Next.js API route proxy
   - Deepgram recommends temporary tokens, not raw API keys in browser
   - Persona installed via `npx ai-elements@latest add persona`, not `@ai-sdk/react`
   - TTS needs sentence-level buffering (no input streaming on `/v1/audio/speech`)
   - `asleep` Persona state should map to Sprite disconnected/waking

7. **Spec written** at `.space-agents/exploration/ideas/2026-02-13-voice-integration/spec.md` — status: Ready for planning.

### Decisions Made

- **Browser-direct for STT** (Deepgram WebSocket with temp tokens), **server-proxied for TTS** (Next.js API route → OpenAI). Eliminates all API key exposure.
- **gpt-4o-mini-tts over tts-1** — token-based pricing is cheaper at scale (~$0.015/min vs $15/1M chars).
- **No cancel recording for MVP** — every recording gets sent. User can correct via text.
- **TTS buffering strategy deferred** to implementation — sentence-level chunking likely but edge cases (markdown, code blocks) need hands-on testing.
- **Build after m7b.12** — voice depends on working chat pipeline.

### Next Action

- Continue m7b.12 (One Sprite Per User) — active front with .12.9 in progress
- When m7b.12 completes: `/plan` on voice-integration spec to break into tasks

---

## [2026-02-14 00:30] Session 161

**Branch:** main | **Git:** uncommitted (frontend changes)

### What Happened

**Executed m7b.12 — One Sprite Per User (16/17 tasks completed via orchestrated mode)**

Ran full Pathfinder → Builder → Inspector cycle for each task. All Bridge and Sprite phases complete, Frontend phase complete except E2E test.

**Bridge phase (Tasks 1–7):**
- m7b.12.1: Protocol types — added `stack_id` to CanvasUpdate, `context` to MissionMessage, new `StateSyncMessage` type, expanded `CanvasAction` with archive/create/restore. All 3 codebases synced (bridge/sprite/frontend). 128/128 bridge tests, 19/19 sprite protocol tests.
- m7b.12.2: Supabase migration 012 — moves `sprite_name`/`sprite_status` from stacks to users table, adds `archived_at`/`color`/`sort_order` to stacks. Transaction-wrapped, idempotent, deterministic data copy via `DISTINCT ON`.
- m7b.12.3: Bridge core re-key — `authenticateConnection(token)` (no stackId), queries `users` table, `/ws` exact match (not `/ws/{stack_id}`), `getConnectionsByUser`.
- m7b.12.4: Bridge proxy re-key — `spriteConnections` Map keyed by userId, all functions renamed.
- m7b.12.5: Bridge reconnect + keepalive re-key — mechanical rename, deprecated `getConnectionsByStack` alias removed.
- m7b.12.6: Bridge provisioning per-user — writes to `users` table, sprite names user-derived.
- m7b.12.7: Bridge test verification — 128/128 tests, zero `stackId` references in `bridge/src/`.

**Sprite phase (Tasks 8–11):**
- m7b.12.8: WorkspaceDB — subclasses `_BaseDB`, 3 tables (stacks/cards/chat_messages), 14 CRUD methods, transactional cascade for archive/restore. 38/38 tests.
- m7b.12.9: State sync — `build_state_sync_message(db)` sends full workspace state on TCP connect. Data conversion: timestamp s→ms, id int→str, position defaults. Creates default "My Stack" on first connect. 10/10 tests.
- m7b.12.10: Canvas tools + DB persistence — factory accepts `workspace_db` + `stack_id`, persists to DB, close_card archives (not deletes). Gateway dispatches user-initiated canvas_interaction (archive_card/archive_stack/create_stack/restore_stack) directly — no agent. 29/29 tests.
- m7b.12.11: Chat persistence — user messages saved in gateway, agent responses accumulated via separate `_turn_response` field (avoids TurnBuffer/Stop hook timing). 6/6 tests.

**Frontend phase (Tasks 12–16):**
- m7b.12.12: WS + routing — removed stackId from WebSocket URL, created `/desktop` route, deleted `/stacks/[id]` dynamic route.
- m7b.12.13: Stack store — `DesktopCard.stackId`, `stacks` array, `activeStackId` (renamed from `activeWorkspace`), `useCardsForActiveStack()` selector, persist v1 migration.
- m7b.12.14: State sync handler — `state_sync` case in ws-provider, role mapping `assistant→agent`, auto-position for (0,0) cards, `setCards`/`setMessages` bulk actions.
- m7b.12.15: Message context — ChatBar sends `context: { stack_id: activeStackId }` with every mission.
- m7b.12.16: Top bar wiring — tabs from store (not hardcoded), plus sends `create_stack`, close sends `archive_stack` via canvas_interaction.

### Decisions Made
- `CanvasInteraction.data` field carries `stack_id` for stack operations (not top-level on payload)
- Separate `_turn_response` accumulator on AgentRuntime (TurnBuffer cleared by Stop hook before ResultMessage)
- `archiveStack` removes cards from store (not just hides) — consistent with archive model
- Role mapping: `"assistant"` → `"agent"` in state_sync chat ingestion
- Cards at (0,0) position auto-placed via `getAutoPosition()` during state_sync

### Gotchas
- Pyright diagnostics frequently stale — always verify with `tsc --noEmit` or `pytest`
- `_BaseDB._conn` optional access warnings are pre-existing pattern, not real bugs
- Builder agents sometimes leave unused imports or stale comments — quick cleanup needed after each

### Next Action
- m7b.12.17: Integration E2E test (deferred to next session)
- After E2E: close m7b.12 feature, deploy Bridge update to Fly.io
- Then: `/plan` on voice-integration spec

---

## [2026-02-14 09:45] Session 164

**Branch:** main | **Git:** uncommitted (frontend + bridge + CLAUDE.md changes)

### What Happened

**Closed m7b.12 — One Sprite Per User (17/17 tasks)**
- Wrote `bridge/tests/e2e-user-sprite.test.ts` — 8 E2E integration tests validating the full per-user refactor: state_sync, mission context routing, multi-tab sharing (single TCP connection), broadcast to all tabs, Sprite disconnect on last tab close. Fixed cross-test interference in full suite by adding `resetSpriteConnections()`/`resetKeepalives()`/`resetReconnectState()` to `beforeEach`. 136/136 bridge tests passing.

**Deployed Bridge to Fly.io**
- Applied Supabase migration 012 (`sprite_name`/`sprite_status` moved from `stacks` to `users` table) via Supabase MCP.
- Deployed updated Bridge with `flyctl deploy`. Verified health check + 2 active connections from Fraser's browser.
- Confirmed ANTHROPIC_API_KEY, MISTRAL_API_KEY, SPRITES_PROXY_TOKEN all set as Fly secrets.

**Built Debug Panel (new feature)**
- Created `frontend/components/debug/` — types.ts, use-debug-panel.ts, debug-panel.tsx
- Toggle: `Cmd+Shift+D` + localStorage persistence (`stackdocs:debug`)
- Left-side glass panel (420px wide, z-50) with 3 tabs: Messages, Connection, Agent
- Taps WebSocket traffic via `useRef<DebugLogEntry[]>` in ws-provider (inbound/outbound/status)
- 500ms polling interval, ring buffer (200 entries), click-to-expand JSON payloads
- Auth token redacted in outbound log. Zero TypeScript errors, build passes.

**Updated CLAUDE.md files**
- Root `CLAUDE.md` rewritten: 287→171 lines. Architecture updated for per-user model, memory system corrected (6 md files not journals), Canvas corrected (custom viewport not React Flow), database schema updated.
- Created `bridge/CLAUDE.md` (~319 lines) and `sprite/CLAUDE.md` (~286 lines) with expanded codebase docs.

**Created 2 Beads**
- stackdocs-m7b.4.14 (P2 bug): Chat history disappears on refresh — chat-store missing persist middleware
- stackdocs-inb (P3 feature): Daemon activity feed in debug panel — needs daemon_event WS message type

### Decisions Made
- Debug panel positioned on LEFT side (not bottom drawer) so both ChatBar and ChatPanel remain visible
- Used `useRef` for debug log instead of Zustand store — avoids re-renders in main UI
- Daemon output NOT available in debug panel yet — ObservationProcessor runs entirely on-Sprite with no WS output. Tracked as future bead.

### Next Action
- Supabase RLS security review (Fraser requested)
- Fix chat history persistence (m7b.4.14)
- Continue Phase 3 Canvas UI or Phase 4 Upload+Extraction

---

## [2026-02-14 12:00] Session 163

**Branch:** main | **Git:** committed

### What Happened

**Voice integration planning — full plan.md + 8 Beads tasks created.**

Planned the voice integration feature (m7b.13) from the Session 162 brainstorm spec. Three-phase planning council:

1. **Task Planner** broke spec into 11 tasks with files, deps, and test criteria.
2. **Sequencer** analyzed dependencies, merged to 8 tasks (API routes combined, feature flag moved early, WS status absorbed into integration), identified 5 risks (Deepgram SSR compat, Rive bundle size, iOS Safari autoplay, TTS buffering, component tree nesting).
3. **Implementer** produced full TDD breakdown with test code sketches, caught missing Vitest setup, identified conditional hooks problem (solved with MaybeVoiceProvider pattern).

Walked through all 8 tasks with Fraser one by one via AskUserQuestion. All approved as-is.

**Final 8 tasks (m7b.13.1-m7b.13.8):**
1. Setup — deps, Vitest, Persona, voice-config, feature flag
2. Voice store (Zustand state machine with enforced transitions)
3. API routes (Deepgram temp token GET + TTS proxy POST)
4. use-stt hook (Deepgram streaming, MediaRecorder, real-time transcript)
5. use-tts hook (AudioContext playback, queue, interrupt)
6. Voice provider (React context composing STT+TTS, wiring chat-voice)
7. Persona orb (Rive animation, tap interactions, toggle buttons)
8. Chat integration + feature gate (wire into chat-bar, MaybeVoiceProvider)

Dependencies set up. Critical path: 6 tasks. Plan + spec moved to mission/staged/m7b.13-voice-integration/.

### Decisions Made

- **Full-response-then-speak for TTS MVP** — no sentence-level chunking. Optimize later.
- **Default personaState is 'asleep'** — store initializes before WS connects.
- **Feature flag early (Task 1)** — build with gate from start, not bolted on at end.
- **MaybeVoiceProvider pattern** — solves React conditional hooks problem cleanly.
- **No rate limiting on API routes for MVP** — Clerk auth is sufficient gating.

### Next Action

- Run /mission on m7b.13 to begin implementation (start with Tasks 1+2 in parallel)
- Or continue with remaining work: m7b.12.17 (E2E test), m7b.4.14 (chat history bug)

---

## [2026-02-14 23:25] Session 164

**Branch:** main | **Git:** clean (voice work committed, some out-of-scope Builder changes unstaged)

### What Happened

**Voice integration feature (m7b.13) — COMPLETE. 8/8 tasks implemented via orchestrated mode.**

Executed full Pathfinder → Builder → Inspector cycle for each task, sequentially (user preference: no background agents).

**Tasks completed this session:**
1. **m7b.13.1** Setup — Vitest config, voice-config.ts (feature flag + env validation), Persona component, env placeholders. 6 tests.
2. **m7b.13.2** Voice store — Zustand 5-state machine (asleep/idle/listening/thinking/speaking) with validated transitions. 20 tests.
3. **m7b.13.3** API routes — `GET /api/voice/deepgram-token` (temp browser token) + `POST /api/voice/tts` (OpenAI proxy, streams PCM). 12 tests.
4. **m7b.13.4** use-stt hook — Deepgram Nova-3 streaming STT via browser WebSocket, MediaRecorder 250ms chunks, mic permission handling. 6 tests.
5. **m7b.13.5** use-tts hook — AudioWorklet streaming playback with 50ms pre-buffer, AbortController interruption, lazy AudioContext. 4 tests.
6. **m7b.13.6** Voice provider — React context composing STT+TTS+store, persona state orchestration, MaybeVoiceProvider passthrough. 6 tests.
7. **m7b.13.7** Persona orb — Rive animation wrapper with tap actions (idle→start, listening→stop, speaking→interrupt), mic/TTS toggles, transcript preview. 11 tests.
8. **m7b.13.8** Chat integration — PersonaOrb replaces mic button when enabled, useVoiceMaybe() null-safe pattern, typing-cancels-listening. 7 tests.

**Post-implementation optimization (3 iterations):**
- **Review agent** found: TTS route missing input length limit, STT only storing last transcript segment (not accumulating), AudioContext not closed on unmount. All fixed.
- **PCM format switch**: Changed mp3→pcm, eliminating server encoding + client decoding overhead.
- **Sentence-level chunking**: Split agent response into sentences, queue each as separate TTS call. Later reverted in favor of full-text streaming.
- **AudioWorklet streaming**: Replaced buffered `arrayBuffer()` + `AudioBufferSourceNode` with true streaming `ReadableStream` + `AudioWorkletNode`. Audio starts ~50ms after first chunk arrives.
- **Pre-buffer tuning**: Started at 200ms (4800 samples), reduced to 50ms (1200 samples) after user reported slowness.

**Live testing confirmed:** TTS working, STT working, feature flag gating working. Two minor UI bugs identified but not yet fixed (reverted attempted fix).

### Decisions Made

- **Orchestrated mode, sequential agents** — user preference, no background agents
- **Full-text single stream over sentence chunking** — simpler, faster with AudioWorklet streaming
- **PCM format (24kHz 16-bit signed LE)** — fastest OpenAI TTS format, no encode/decode overhead
- **AudioWorklet via Blob URL** — no separate file needed, inline processor string
- **AudioContext({ sampleRate: 24000 })** — match OpenAI output natively, browser handles device resampling
- **50ms pre-buffer** — prevents initial stutter without noticeable delay
- **Always act on Inspector findings** — user explicitly requested no dismissing review findings, especially bloat/redundancy

### Gotchas

- **Builder agents sometimes commit out-of-scope changes** — m7b.13.2 Builder added state_sync_request to bridge/index.ts and persist middleware to chat-store.ts. These are still unstaged. Future sessions: explicitly warn Builders about scope.
- **`@rive-app/react-webgl2`** needed, not `react-canvas` — AI Elements CLI installs WebGL2 variant, spec was wrong.
- **Inspector can hallucinate scope creep** — claimed d5ecb35 had 6 extra files, but `git diff --stat` showed only voice-store files. Verify Inspector claims before acting.
- **TS diagnostics for test imports are almost always stale** — `Cannot find module '../use-tts'` etc. appear constantly but tests pass fine. Editor module resolution lag.

### In Progress

Two minor UI bugs identified but NOT fixed (attempted fix reverted):
1. **UI blocked on page refresh** until Persona loads and WS connects — dynamic import loading fallback didn't help, needs deeper investigation
2. **Password autofill popup** on chat textarea in side panel — `autoComplete="off"` didn't suppress it

Unstaged out-of-scope changes from Builder agents:
- `bridge/src/index.ts` — state_sync_request forwarding
- `frontend/lib/stores/chat-store.ts` — persist middleware added
- `bridge/tests/*` — mock updates for state_sync_request
- `sprite/src/gateway.py` — state_sync_request handler

### Next Action

- Fix the two UI bugs (persona loading block + autofill popup) — needs proper investigation
- Test voice end-to-end with real Sprite agent responses
- Review/commit or discard the out-of-scope Builder changes (bridge state_sync, chat-store persist)
- Continue with remaining work: m7b.4.14 (chat history disappears on refresh), stackdocs-sm2 (spriteExec CLI bug)

---

## [2026-02-15 09:00] Session 165

**Branch:** main | **Git:** uncommitted (prior session leftovers — wallpapers, bridge, sprite)

### What Happened

**Voice controls cleanup — chat bar layout reorganization.**

Cleaned up the sloppy voice integration layout from session 164. The mic/TTS toggles were inside PersonaOrb as a vertical stack hanging below the orb, breaking the chat bar's horizontal action row.

**Changes made (6 files, committed as `74e0e93`):**

1. **`persona-orb.tsx`** — Stripped mic/TTS toggle buttons and Icons import. PersonaOrb is now just transcript preview + orb tap target. Removed 29 lines.
2. **`chat-bar.tsx`** — Added mic/TTS as inline `GlassIconButton` instances to the LEFT of the orb. Layout: `[+] [Ask anything...] [Mic] [TTS] [Orb]`. Removed PanelRight button entirely.
3. **`desktop-top-bar.tsx`** — Added panel toggle to far-right of system tray pill (after User icon). Icon swaps between `PanelRight` (bar mode) and `LayoutBottombar` (panel mode). Click toggles between modes.
4. **`chat-panel.tsx`** — Removed close button from panel header. Removed empty header via `showHeader={false}`. Messages fill top-to-bottom. ChatBar rendered as **sibling** to GlassSidePanel (not child) to fix backdrop-blur.
5. **`glass-side-panel.tsx`** — Added `showHeader` and `showClose` props (both default `true`).
6. **`persona-orb.test.tsx`** — Removed 2 tests for deleted toggle buttons. 70/70 tests pass.

### Decisions Made

- **Mic/TTS as GlassIconButtons** — consistent with other action bar buttons, same size-10 circular style
- **Panel toggle far-right in top bar** — User icon left of it, matching OS-style tray layout. Icon swaps to show current action (open panel vs dock to bottom).
- **ChatBar as sibling to GlassSidePanel** — nested `backdrop-filter` is broken in browsers (known Chromium bug). Rendering ChatBar outside the panel as a fixed sibling gives it its own blur context, matching the standalone bottom bar's frost quality.
- **No close button in chat panel** — top bar toggle handles mode switching, redundant close removed.

### Gotchas

- **Nested `backdrop-filter: blur()` doesn't work** — when an ancestor has `backdrop-filter`, descendant elements' `backdrop-filter` silently fails. The ChatBar inside GlassSidePanel had zero blur effect. Fix: render as DOM sibling, not child.
- **TS diagnostics for `embedded` prop are phantom** — `chat-panel.tsx` shows `Type '{ embedded: true; }' is not assignable to type 'IntrinsicAttributes'` but the prop is clearly defined and tests pass. Stale editor module resolution.
- **Unstaged changes from session 164 still present** — wallpapers, bridge state_sync, chat-store persist, sprite gateway/runtime. Not committed this session, not related to this work.

### Next Action

- Review/commit or discard the remaining unstaged changes from session 164 (wallpapers, bridge, sprite, chat-store)
- Fix bugs: stackdocs-sm2 (spriteExec CLI), m7b.4.14 (chat history refresh), m7b.4.13 (agent size param)
- Test voice end-to-end with real Sprite agent responses

---

## [2026-02-15 11:00] Session 166

**Branch:** main | **Git:** uncommitted (this session's work + prior session leftovers)

### What Happened

**Sprite deploy improvements + SDK session resume implementation.**

Four areas of work this session:

1. **Closed `stackdocs-ogm` — stale `/workspace/src/` cleanup.**
   - Removed `/workspace/src/` from `sd-e2e-test` Sprite via `sprite exec`.
   - Added `/workspace/src` to `updater.ts` cleanup list (line 88) so any Sprite gets cleaned on next update.
   - Bumped `CURRENT_VERSION` from `0.3.0` → `0.3.1` in `bootstrap.ts` to trigger updater.

2. **Created `stackdocs-iic` (P2 bug) — auth timeout on Fly.io cold start.**
   - Observed 2-3 connection retries before auth succeeds when Bridge machine is cold.
   - Root cause: `AUTH_TIMEOUT_MS = 10_000` in `bridge/src/index.ts:45` too short for Fly.io cold start (3-10s boot).
   - Three fix options captured: bump timeout, HTTP pre-warm, or min_machines_running=1.

3. **Rewrote sprite-deploy skill (`.claude/skills/sprite-deploy/SKILL.md`).**
   - Discovered `pkill -f` kills the exec session (exit 137), `pgrep -f` gives false positives (matches own bash).
   - New approach: kill by port PID via `ss -tlnp | grep 8765`, verify in separate exec session.
   - Reordered steps: kill first, then deploy (not deploy then kill).
   - Added VERSION update step and post-deploy verification.
   - Removed misleading "run test twice" workaround — root cause was stale port, not race condition.

4. **Implemented SDK session resume in `sprite/src/runtime.py`.**
   - Problem: `last_session_id` only stored in memory — lost on every process restart/deploy.
   - Solution: persist to `/workspace/.os/session_id` file after each turn.
   - On restart: read file → pass `resume=session_id` to SDK (Anthropic stores full history server-side).
   - Resume path skips memory loading, tool registration — SDK has everything from original session.
   - Fallback: if resume fails (expired/invalid), delete file, start fresh session.
   - Verified on `sd-e2e-test`: kill server → restart → agent correctly recalled previous exchange.

### Decisions Made

- **Kill by port, not process name** — `ss -tlnp | grep 8765` is the only reliable method on Sprites.
- **Resume skips system prompt** — Anthropic stores the full session including original system prompt. No need to reload memory files on resume.
- **Session file at `/workspace/.os/session_id`** — matches VERSION file pattern, survives code deploys (only `/workspace/.os/src/` gets overwritten).
- **Fallback on resume failure** — delete stale file, fall through to fresh session. Matches existing `_continue_session()` error pattern.

### Gotchas

- **Sprite Python is now 3.13.7** (was 3.13.3 in our notes). Sprites.dev updated the runtime.
- **`pgrep -f` on Sprites matches its own exec bash session** — always use `ss -tlnp` or `ps aux | grep "[p]ython"`.
- **Proxy timeout on first test run after Sprite sleep** — the Sprite was waking, server startup delayed. Not a code bug.
- **SDK resume only preserves context within one session** — earlier conversations (from before session file was persisted) are not in the resumed context. Long-term memory is handled by ObservationProcessor + learnings DB.
- **Runtime tests (15/20 failing)** — pre-existing mock issue: `receive_response()` returns coroutine not async iterator. Not caused by our changes.

### Next Action

- Debug card disappearing / not loading on refresh (stackdocs-m7b.4.14 — chat history + canvas state persistence)
- Commit this session's changes and push

---

## [2026-02-15 10:00] Session 167

**Branch:** main | **Git:** uncommitted (frontend persona/chat-bar/top-bar changes)

### What Happened

**PersonaOrb rendering fix + UI startup performance investigation.**

Deep investigation into why the desktop UI felt "blocked" for 4-12 seconds on page refresh. Traced through the entire component chain and found two independent issues:

1. **Rive WebGL2 blocking main thread.** The `@rive-app/react-webgl2` `useRive()` hook creates a WebGL2 context synchronously on mount, freezing the entire UI for 2-3 seconds. Fixed with `requestIdleCallback` — Rive now mounts only when the browser is idle. Confirmed by toggling `NEXT_PUBLIC_VOICE_ENABLED=false` which made the page instant.

2. **Sprite wake cycle (4s CRIU cold start)** causes the UI to feel inert — no stacks/cards until `state_sync` arrives. This is infrastructure, not frontend. Mitigated by: gating send button on connection status (`chat-bar.tsx`), replacing "Loading..." with "Stackdocs" in top bar (`desktop-top-bar.tsx`).

**PersonaOrb changes (6 iterations this session):**
- `persona-orb.tsx` — Removed `next/dynamic` → direct import → back to `dynamic` + `requestIdleCallback` to defer mount. Removed all `opacity-50` styling. Added `toRiveState()` mapping (idle/asleep → thinking, since those Rive states are invisible in obsidian variant). Added CSS gradient placeholder visible from first render until `onReady` fires.
- `persona.tsx` — Removed `shrink-0` from RiveComponent to allow size override. Changed obsidian source from CDN URL to local `/persona/obsidian.riv`.
- `app/layout.tsx` — Added `<link rel="preload">` for local `.riv` file.
- `chat-bar.tsx` — Send button gated on `status === 'connected'`. Enter key blocked when disconnected.
- `desktop-top-bar.tsx` — "Loading..." → "Stackdocs" when stacks empty.
- Downloaded `obsidian-2.0.riv` (7.8KB) to `public/persona/obsidian.riv`.
- Tests: 73 passing across 9 files. Both persona-orb and chat-bar test mocks updated.

### Decisions Made

- **`requestIdleCallback` for Rive** — Perplexity confirmed WebGL2 context creation is inherently blocking. Deferring to idle time is the standard fix. Fallback to `requestAnimationFrame` for browsers without it.
- **Local `.riv` file** — Downloaded from Vercel CDN to `public/persona/`. Eliminates cross-origin fetch, 7.8KB.
- **Always show thinking animation** — Rive obsidian idle/asleep states invisible. `toRiveState()` maps everything to thinking except listening/speaking.
- **No opacity on orb ever** — User explicitly requested. Asleep state only gets `pointer-events-none`.
- **Send button disabled until connected** — Simpler than message queue. Honest UX.

### Gotchas

- **Rive `shrink-0` prevents size override** — `persona.tsx` had `cn("size-16 shrink-0", className)` preventing `size-10`. Removed `shrink-0`.
- **`next/dynamic` loading fallback only covers chunk load** — Not the `.riv` fetch or WebGL2 init. Need `onReady`-based placeholder.
- **Direct Rive import blocks entire page** — `useRive()` WebGL2 context creation is synchronous. Must use dynamic import + requestIdleCallback.
- **`bg-white/15` invisible on glass** — Glass bar is `bg-white/10`, placeholder blends in. Need gradient or higher contrast.
- **Test env lacks `requestIdleCallback`** — Falls through to `requestAnimationFrame`, stubbed to fire sync.

### Next Action

- Test orb size match after `shrink-0` removal
- Continue design work on desktop UI

---

## [2026-02-15 11:20] Session 168

**Branch:** main | **Git:** uncommitted (voice system changes)

### What Happened

**PersonaOrb redesign — hover pill bar, send-on-click, Web Speech API, voice bars.**

Major rework of the PersonaOrb interaction model. Previously a click-to-talk button; now a dual-purpose orb with hover controls and message sending.

**Structural changes:**
- Extracted `GlassPill` to `components/ui/glass-pill.tsx` (shared between top bar and orb hover pill).
- Moved PersonaOrb outside overflow-hidden glass bar in `chat-bar.tsx` — absolute sibling with spacer div.
- Removed dedicated send button. Orb click sends message when text present.
- Removed inline mic/TTS toggles from chat-bar. All voice controls in hover pill.

**PersonaOrb (`persona-orb.tsx`) new features:**
- `hasText`, `inputActive`, `onSendMessage` props from chat-bar.
- Hover pill: mic toggle + TTS toggle (400ms delay, 800ms when typing).
- Pop-in animation: scale-95→100, translate-y-1→0, opacity with Apple easing.
- Contextual tooltip: "Send message" only when hasText.
- Pill switches: voice controls on hover, transcript + voice bars when listening.

**Web Speech API rewrite (`use-stt.ts`):**
- Replaced Deepgram SDK with native Web Speech API. No API keys needed.
- Added parallel getUserMedia + AudioContext + AnalyserNode for visualisation.
- Exposes `analyser` through voice-provider context.

**Voice bars (`voice-bars.tsx` — new):**
- Reads AnalyserNode frequency data via requestAnimationFrame. 4 bars, smoothed.

**Rive state mapping:** Changed to passthrough. Only `asleep` → `idle`.

### Decisions Made

- **Web Speech API over Deepgram** — Native browser API works immediately. No cost, no keys, no server round-trip.
- **Orb outside overflow-hidden** — Fixes pill clipping and backdrop-blur stacking.
- **JS hover over CSS group-hover** — Needed for delayed show/hide timers.
- **Send button removed** — Orb replaces it. Enter key still works.

### Gotchas

- **Nested backdrop-blur breaks glass effect** — Pill inside glass bar lost blur. Fix: render outside container.
- **Rive canvas ignores className size** — Fix: `absolute inset-[-15%]` with `size-full`.
- **Web Speech API `no-speech` error is non-fatal** — Must not kill session on silence.
- **First frequency bin dominates voice bars** — Low-frequency bin has most energy.

### In Progress

- Voice bars layout: bars inside pill with text above, pill expanding, bar distribution
- Persona-orb tests need TooltipProvider wrapper + new prop tests
- chat-bar tests may need updates for removed send button

### Next Action

- Polish listening pill (vertical layout, expanding height, bar distribution)
- Update and run test suite

---

## [2026-02-15 12:55] Session 169

**Branch:** main | **Git:** uncommitted changes

### What Happened

**Deepgram Nova-3 STT integration — replaced Web Speech API, debugged API key, fixed state machine bug, cursor fix.**

**STT engine swap (`frontend/components/voice/use-stt.ts`):**
- Replaced Web Speech API with Deepgram Nova-3 streaming as primary STT engine.
- Cloned Deepgram's official reference repo (`docs/reference/nextjs-live-transcription`) and compared implementation patterns.
- Matched reference patterns: `addListener` (not `on`), no mimeType on MediaRecorder, `requestClose()` (not deprecated `finish()`), mic setup before Deepgram connection, `noiseSuppression`/`echoCancellation` on mic.
- Kept Web Speech API as `useWebSpeechSTT()` named export fallback. Default `useSTT` = `useDeepgramSTT`.
- Shared `createAnalyser()` helper extracted for both implementations.
- `fftSize` bumped from 64 to 256 for finer frequency resolution.

**Root cause of STT never working:** `DEEPGRAM_API_KEY` in `.env.local` had insufficient permissions — 403 on `auth.grantToken()`. New key (`c5e35f54...`) with Member scope fixes it. Token endpoint (`/api/voice/deepgram-token`) was returning 502 all along.

**State machine bug fix (`voice-provider.tsx:50-62`):**
- `stopVoice()` always set `personaState: 'thinking'` even with empty transcript. No agent response would come, so orb got stuck permanently. Fix: go to `'idle'` when transcript is empty, only `'thinking'` when message actually sent.

**Cursor stuck bug fix (`desktop-viewport.tsx`):**
- Known Chromium bug: `active:cursor-grabbing` CSS pseudo-class + `setPointerCapture()` causes `:active` to get stuck. Cursor locked as grab hand across entire page.
- Fix: replaced CSS `cursor-grab active:cursor-grabbing` with JS state-driven `style={{ cursor: isPanning ? 'grabbing' : 'grab' }}` (same pattern `desktop-card.tsx` uses).
- Added `onLostPointerCapture` safety net to reset `isPanning` if pointer capture lost unexpectedly.

**Voice bars tuning (`voice-bars.tsx`):**
- Skipped bottom 10% of frequency bins to reduce bass-heavy first bar.
- Separated idle height (fixed 3px via `MIN_PX`) from dynamic range (`MAX_PX = 20px`) so scaling changes don't affect idle appearance.
- Tried RMS volume approach but reverted — frequency-based bars looked more natural.

**Persona orb:** Rive canvas inset adjusted from -14% to -13%.

### Decisions Made

- **Deepgram over Web Speech API** — Better accuracy (Nova-3), cross-browser, streaming with smart_format. Web Speech API kept as fallback export.
- **No auto-fallback composing hook** — React state updates are async, can't reliably detect Deepgram failure in a composing hook. Simple alias (`useSTT = useDeepgramSTT`) instead.
- **JS cursor over CSS :active** — Immune to Chromium `:active` stuck bug. Matches pattern already used by desktop-card.tsx.

### Gotchas

- **Deepgram API key permissions** — `grantToken()` requires "Member" scope or higher. Default API keys don't have it. This was the ONLY reason STT never worked — code was fine all along.
- **Chromium `:active` + `setPointerCapture` bug** — Well-documented (issues.chromium.org #40300816). No `lostpointercapture` handler meant no recovery path.
- **`finish()` deprecated in `@deepgram/sdk` v4.11.3** — Use `requestClose()`. Reference repo uses v4.5.1 where `finish()` was current.
- **Voice bars frequency bin 0** — Dominates with bass energy. Must skip bottom bins for balanced visualization.

### Next Action

- More STT refinements next session (user noted). Consider interim transcript display in persona-orb pill for live streaming feedback.

---

## [2026-02-15 15:30] Session 170

**Branch:** main | **Git:** uncommitted (prior session changes + new exploration docs)

### What Happened

**Brainstorm + planning session for chat bar & voice interaction redesign.**

Explored the bottom chat bar, voice recording, and persona orb UX. Three research agents audited the codebase (component hierarchy, flow consistency, code quality). Key design decisions made through iterative discussion.

**Exploration (brainstorm):**
- Decided to move STT transcript from floating pill above orb INTO the textarea where users normally type. Unifies input surface, lets users edit STT mistakes before sending.
- Hover pill repositioned from ABOVE orb to LEFT of orb, inline with the chat bar action row.
- Pill contents simplified: idle = speaker toggle only (mic toggle removed — orb IS the mic). Recording = speaker + stop button + voice bars.
- Three send/stop paths: orb tap = send immediately, stop button/Escape = stop recording but keep text for editing.

**Code audit findings (2 research agents):**
- STT race condition: rapid tap orphans mic streams, Deepgram connections, keepAlive intervals (no generation counter, no double-invocation guard)
- WS disconnect doesn't stop STT (mic stays on, orb unclickable)
- TTS triggers on ALL agent responses when ttsEnabled, not just voice-initiated ones
- Deepgram token TTL 30s silently kills long recordings
- TTS hook has no error state (failures silently swallowed)
- VoiceBars calls setLevels() every rAF frame (~60fps React re-renders)
- persona-orb.test.tsx lines 80 and 162 have wrong assertions (expect 'thinking' but toRiveState returns 'idle')
- Zero keyboard accessibility on voice components

**Planning (spec → plan → beads):**
- Wrote spec.md with full requirements, architecture, and success criteria
- Sent scout agent for comprehensive codebase report, fed to planning council (task-planner + sequencer)
- 8 tasks created: 4 parallel bug fixes (STT, TTS, VoiceBars perf, test assertions) + 4 sequential UX tasks (voice-provider functions → strip orb pill → build chatbar pill → integration test)
- All tasks have full descriptions with goals, file lists, step-by-step implementation, code snippets, and test checklists
- Dependencies wired: E→F→G→H sequential chain, A-D independent

**Feature created:** `stackdocs-m7b.4.15` — Chat Bar & Voice Interaction Redesign (8 tasks)
**Folder:** `.space-agents/mission/staged/m7b.4.15-chat-bar-voice-redesign/` (spec.md + plan.md)

### Decisions Made

- **Transcript in textarea, not floating pill** — single input surface, users can edit STT mistakes, less visual noise
- **Pill to LEFT of orb (not above)** — inline with chat bar, consistent position across states, no floating elements
- **Mic toggle removed** — orb IS the mic button, mic toggle was redundant
- **Three interaction paths** — orb tap (send fast), stop button (edit), Escape key (keyboard edit)
- **Tasks 1+2 merged** — both modify same use-stt.ts function, avoids editing same code twice
- **Task H (mic toggle verification) merged into Task G** — naturally part of building the new pill
- **voiceSessionActive ref** — discriminates voice vs text interactions so TTS doesn't fire on text messages
- **stopRecordingOnly vs stopVoice** — edit path (keep text) vs send path (send + clear)

### Next Action

- Run `/mission` to execute the 8 tasks. Start with `bd ready` — tasks A-E are all unblocked. Recommended single-worker order: A → B → C → D → E → F → G → H.

---

## [2026-02-15 16:10] Session 171

**Branch:** main | **Git:** uncommitted (prior session changes in bridge/desktop/sprite)

### What Happened

**Mission solo execution of Chat Bar & Voice Redesign (m7b.4.15) — completed 4 of 8 tasks.**

Sent Explore agent to scout all voice files (use-stt.ts, use-tts.ts, voice-bars.tsx, persona-orb.tsx, voice-provider.tsx, chat-bar.tsx, voice-store.ts, all test files). Full codebase context gathered before implementation.

**Task A (m7b.4.15.1) — Fix STT bugs:**
- Added `generationRef` counter to `useDeepgramSTT` in `use-stt.ts` — stale async continuations now bail out when generation has advanced
- Added double-invocation guard at top of `startListening` — returns immediately if `connectionRef` or `recorderRef` already set
- Added 10s `AbortController` timeout on `/api/voice/deepgram-token` fetch
- Deepgram `Error` event now calls `stopListening()` for full cleanup (was just `setError`)
- Deepgram `Close` event now releases mic tracks, MediaRecorder, AudioContext, keepAlive interval (was just `setIsListening(false)`)
- Changed token TTL from 30s to 120s in `deepgram-token/route.ts`
- Added 4 new tests: double-invocation guard, fetch timeout, error cleanup, close cleanup (10 total, all pass)

**Task B (m7b.4.15.2) — Fix TTS error surfacing:**
- Added `error` state to `useTTS` in `use-tts.ts`
- Non-ok fetch response sets `'Speech generation failed'`, catch block sets `'Speech playback error'`
- Error resets to null on next `speak()` call
- Updated `TTSControls` interface to include `error: string | null`
- Added 3 new tests: initial null, fetch failure error, error reset (7 total, all pass)

**Task C (m7b.4.15.3) — Fix VoiceBars performance:**
- Added `lastUpdateRef` timestamp tracker to `voice-bars.tsx`
- `setLevels()` now only fires when 66ms+ have elapsed (~15fps) — frequency sampling still runs at full rAF speed for smooth data
- Removed `transition-[height] duration-75` CSS class that conflicted with the 66ms update interval
- Created `voice-bars.test.tsx` with 3 tests: renders 4 bars, no transition class, min height when null analyser

**Task D (m7b.4.15.4) — Fix persona-orb test assertions:**
- Line 80: Changed assertion from `'thinking'` to `'idle'` — `toRiveState('idle')` returns `'idle'`
- Line 163: Changed assertion from `'thinking'` to `'idle'` — `toRiveState('asleep')` returns `'idle'`
- Also fixed pre-existing `TooltipProvider` context error: added `GlassTooltipProvider` wrapper to all 12 tests (they were all broken before this session)
- All 12 persona-orb tests now pass

### Gotchas

- All 12 persona-orb tests were pre-existing failures (missing `TooltipProvider` wrapper) — not just the 2 assertion fixes. Had to fix the wrapper to verify the assertion changes worked.
- There are uncommitted changes from prior sessions in bridge/, desktop/, and sprite/ dirs — not related to this session's work. Committed only voice-related files.

### In Progress

- Feature `m7b.4.15` is 4/8 tasks complete. Remaining: E (voice provider functions), F (strip orb pill), G (build chatbar pill), H (integration test).
- Task E is the gateway — F and G depend on it.

### Next Action

- Continue `/mission solo m7b.4.15` — start with Task E (stopRecordingOnly, voiceSessionActive, WS disconnect cleanup), then F → G → H sequentially.

---

## [2026-02-15 16:10] Session 172

**Branch:** main | **Git:** uncommitted (sprite runtime fixes, frontend canvas clamp, test updates)

### What Happened

**Three critical Sprite agent bugs fixed + canvas bounds clamping added.**

Investigated and fixed the Sprite agent's broken session resume, missing system context, card persistence failure, and added world bounds to the canvas viewport.

**Bug 1 — Resume path missing MCP tools (`sprite/src/runtime.py:175-184`):**
- `_start_session()` resume path created SDK client with `resume=session_id` but never registered MCP tools (canvas + memory). Tools are local Python closures — not stored server-side.
- Fix: moved `create_canvas_tools()` + `create_memory_tools()` + `create_sdk_mcp_server()` above the resume/fresh branch so both paths register tools.
- Agent could chat but had zero tool access — no create_card, no search_memory, nothing.

**Bug 2 — Resume path missing system prompt (`sprite/src/runtime.py:189-195`):**
- Session 166 assumption was wrong: "SDK stores system prompt server-side, no reload needed on resume." In practice, the agent lost its Stackdocs identity — didn't know it was a document assistant, didn't know about Canvas.
- Fix: added `system_prompt=system_prompt` to resume path's `_build_options()`. Memory files (soul.md, os.md, etc.) now loaded on BOTH resume and fresh paths.

**Bug 3 — Card persistence silently skipped (`sprite/src/tools/canvas.py:166-228`):**
- `create_canvas_tools()` captured `stack_id` as a plain closure value at tool creation time. `set_active_stack_id()` updated the runtime field but NOT the closure.
- The E2E test script sends missions without `context.stack_id`, so when it started the server, `_start_session()` captured `stack_id=None` permanently. All subsequent `create_card` calls hit `if workspace_db and stack_id:` → silently skipped DB persist.
- Cards appeared on screen (WebSocket sent first) but were never saved to SQLite → state_sync always returned 0 cards.
- Fix: changed `stack_id` param to `stack_id_fn: Callable[[], str | None]` — a lambda that reads `self._active_stack_id` at call time. Same indirection pattern as `_indirect_send` for send_fn.
- Updated `runtime.py` to pass `stack_id_fn=lambda: self._active_stack_id`.
- Updated test fixtures in `test_canvas_tools.py` and `test_gateway_canvas.py`.

**Canvas bounds clamping (frontend):**
- Added `WORLD_WIDTH=4000`, `WORLD_HEIGHT=3000` constants and `clampCardPosition()` to `desktop-store.ts`.
- Clamped card positions in `addCard`, `moveCard` (store level), drag + momentum in `desktop-card.tsx`, and auto-placer output.
- Added `clampView()` to `desktop-viewport.tsx` — screen center must always point inside the world. Viewport clamped on pan, zoom, momentum, and mount.
- Still needs tuning — viewport bounds feel slightly off at low zoom levels.

**Three new bugs discovered and filed:**
- `stackdocs-oan` (P2): Session memory lost on every deploy (session_id cleared)
- `stackdocs-aq3` (P1): Cards load at (0,0) — position not persisted to WorkspaceDB
- `stackdocs-zxh` (P1): Reconnect stuck on sprite_waking — Bridge never completes TCP proxy reconnection

### Decisions Made

- **Always load memory + tools on resume** — the Session 166 optimization of skipping memory/tools on resume was wrong. Both are local-only (closures + markdown files) and must be re-created every time.
- **Lambda for stack_id** — same indirection pattern as `_indirect_send`. Closures capture a callable, not a value, so the stack_id is always current.
- **Screen-center-in-world clamp** — simpler than force-centering or elastic snap-back. Never fights drag gestures.

### Gotchas

- **CRIU restores killed processes** — killing the server on a Sprite, then running another exec command can wake the Sprite and CRIU restores the old checkpoint (including the killed process). Need to kill and start in rapid succession or same session.
- **Zombie server processes accumulate** — repeated kill/start cycles left 8+ orphaned Python server processes on the Sprite. Use `for pid in $(ps aux | grep "[p]ython3 -m src.server" | awk "{print \$2}"); do kill -9 $pid; done` to clean.
- **E2E test poisons stack_id** — test-e2e-v2.ts sends missions without `context.stack_id`, which means the first `_start_session()` captured `stack_id=None` permanently. Any test that starts the server must either send a stack_id or use the new lambda pattern.
- **state_sync hardcodes position to (0,0)** — cards table has no position columns. Frontend localStorage is the only source of card positions. Need DB columns or merge strategy.

### Next Action

- Commit and push all changes from this session
- Fix card position persistence (stackdocs-aq3) — add position/z_index columns to cards table
- Fix reconnect (stackdocs-zxh) — investigate Bridge reconnect.ts
- Continue m7b.4.15 tasks E-H (voice redesign)

---

## [2026-02-15 19:10] Session 173

**Branch:** main | **Git:** uncommitted (voice/chatbar from prior sessions + sprite-deploy skill update)

### What Happened

**Fixed stackdocs-aq3: Card positions now persist through reconnects (full round-trip).**

Dispatched 3 debug agents in parallel to investigate Session 172 bugs (aq3, oan, zxh). All returned HIGH confidence root cause analyses:

- **aq3** (cards at 0,0): Position was never designed for server persistence. DB has no position columns, `state_sync.py:56` hardcodes (0,0), `ws-provider.tsx:177` does full store replacement. Protocol has "move" action but nothing sends/handles it.
- **oan** (session memory lost): Initial hypothesis WRONG — no `rm -f session_id` in deploy skill. Real cause: resume fails on changed system prompt/tools, `runtime.py:207` deletes session_id on failure, ObservationProcessor never fired (25-turn threshold). `user.md` still empty template.
- **zxh** (reconnect stuck): Primary cause is keepalive gap during reconnect — `spriteConnections.delete()` removes connection, keepalive pings silently fail during 1-12s reconnect window, Sprite can re-sleep before first ping arrives. Also found buffer drain re-buffer bug (data loss) and no recovery after failed reconnect.

Ran orchestrated mission on aq3 — 3 tasks with Pathfinder/Builder/Inspector per task:

1. **aq3.1** (`451670d`): Added `position_x`, `position_y`, `z_index` columns to WorkspaceDB cards table. Idempotent ALTER TABLE migration in `WorkspaceDB.connect()` for existing Sprites. Updated `upsert_card()` with position params, added `update_card_position()`. 6 new tests.
2. **aq3.2** (`1c98448`): `state_sync.py` reads real positions from DB instead of hardcoding. `gateway.py` handles `"move"` canvas_interaction — calls `update_card_position()`. 5 new tests.
3. **aq3.3** (`0e6ec83`): `desktop-card.tsx` sends `canvas_interaction` move on drag end via `syncToStore()`. `desktop-store.ts` adds `mergeCards()` that preserves existing positions on state_sync. `ws-provider.tsx` uses `mergeCards` instead of `setCards`. 9 new tests. Builder hit rate limit mid-task — HOUSTON finished manually (mocked `useMomentum` in test, wired ws-provider merge).

**Deployed to sd-e2e-test Sprite.** Migration ran live — added position columns to existing DB. Confirmed via E2E test: state_sync now returns real card positions. Confirmed in browser: debug panel shows canvas_interaction move messages with position_x/position_y being sent and acknowledged.

**Discovered deploy env var issue:** Manual server restart via `sprite exec` doesn't inject `ANTHROPIC_API_KEY`/`ANTHROPIC_BASE_URL` — agent responds "Not logged in · Please run /login". Bridge normally sets these during provisioning. Fixed by restarting with explicit env vars. Updated `sprite-deploy` skill with Option B (manual start with env vars) and troubleshooting entry.

**Also observed:** Agent thinks user's name is "Rich" due to polluted session context from multiple voice test users (Justin, Samuel, Daniel). This is oan bug — `user.md` still empty, ObservationProcessor never extracted learnings.

### Decisions Made

- **Option 1 (full DB persistence) for card positions** — bidirectional: drag saves to DB, state_sync reads from DB. Enables multi-device in future.
- **mergeCards preserves positions by checking (0,0) default** — if existing card has non-zero position, keep it. Incoming position only wins for new cards or cards at origin.
- **useMomentum mock in desktop-card tests** — momentum `releaseWithFlick()` returns true in jsdom (events fire instantly, within 60ms window), deferring `syncToStore` to RAF-based onStop which never fires. Mocked to return false.

### Gotchas

- **sprite-deploy doesn't inject API env vars** — server started via `sprite exec` lacks `ANTHROPIC_API_KEY`. Must use `source bridge/.env` and pass env vars explicitly. Updated skill.
- **test-e2e-v2.ts tries to start a new server even if one is running** — if you manually start the server first, the script's server start hits "address in use", times out, then connects to the existing (possibly broken) server. Always ensure port is free before running.
- **Sprite Python version mismatch** — local tests use Python 3.13.3, Sprite has 3.13.7. No issues found but worth noting.
- **test_e2e_hooks.py has sys.exit() at module level** — kills pytest when collected. Must exclude with `--ignore`.

### Next Action

Two Session 172 bugs remain with full root cause analyses ready:
- **stackdocs-oan** (P2): Fix resume failure handling + lower ObservationProcessor threshold
- **stackdocs-zxh** (P1): Fix keepalive gap during reconnect + buffer drain bug

---

## [2026-02-15 19:57] Session 176

**Branch:** main | **Git:** uncommitted (17 files across frontend voice/chat/store)

### What Happened

**Major chat bar & voice system cleanup + bug fixes across 7 areas.**

**1. Code review & cleanup (code-simplifier agent):**
- Fixed `lingerVisible` mount bug — added `wasListeningRef` guard so voice controls don't flash on page load (`chat-bar.tsx:85-109`)
- Renamed 6 stale "pill" identifiers to "controls" (`showPill` → `showControls`, `pillVisible` → `controlsVisible`, etc.)
- Removed dead `stopVoice()` from voice-provider + interface + all tests (~15 lines)
- Fixed test description referencing removed `GlassPill` in persona-orb.test.tsx
- Added missing `stopListening` dependency in voice-provider WS status effect

**2. Voice controls layout fix (`chat-bar.tsx:231-283`):**
- Hidden elements now collapse to `w-0 overflow-hidden` instead of just `opacity-0` — prevents invisible stop/bars from pushing speaker icon far from orb
- Added `delay-0` to all hidden states so speaker/stop/bars disappear together

**3. Shared draft state (`chat-store.ts` + `chat-bar.tsx`):**
- Moved `inputValue` and `inputActive` from local useState to shared store in chat-store
- Both dock bar and sidebar ChatBar now share same draft text and expanded/collapsed state
- Transcript wiring only runs on standalone bar (`!embedded`) to prevent double-append

**4. Orb state machine improvements:**
- Added `idle → thinking` as valid transition in voice-store
- `handleSend` sets persona to `thinking` after sending
- Agent completion → `speaking` state for 10s visual animation (even without TTS) via `speakingTimerRef`

**5. Orb tooltips (`persona-orb.tsx`):**
- Added state-dependent tooltips (Start listening / Send message / Thinking... / Stop speaking / Connecting...)

**6. TTS fixes (partially working — filed stackdocs-m7b.4.15.9):**
- Added `stopRecordingForSend()` — stops STT but keeps voiceSessionRef alive for TTS
- Added `ctx.resume()` in use-tts.ts for suspended AudioContext
- Added `prevSpeakingRef` guard to isSpeaking effect
- Removed `voiceSessionRef` gating — TTS triggers for ALL agent responses when speaker ON
- **TTS still not producing audio** — OpenAI API returns valid PCM but no sound output

**7. STT race condition fix (`use-stt.ts:135-148`):**
- Added `stream.active` guard + try/catch around `recorder.start()` — prevents NotSupportedError

### Decisions Made

- **Shared draft in chat-store** — both ChatBar instances share same input. Prevents stale text after switching views.
- **Speaker toggle = TTS for all** — removed voiceSessionRef gating. Speaker ON = hear all agent replies.
- **Visual speaking animation** — 10s timer when TTS off, real duration when on.
- **stopRecordingForSend vs stopRecordingOnly** — send preserves voice session, cancel resets it.

### In Progress

- **TTS audio not playing (stackdocs-m7b.4.15.9)** — P1 bug. speak() called, API returns data, but no sound. Needs browser console debugging.

### Next Action

- Debug TTS audio (stackdocs-m7b.4.15.9) with console breadcrumbs in speak()
- Close m7b.4.15 once TTS working and smoke test passes

---

## [2026-02-15 21:45] Session 177

**Branch:** main | **Git:** uncommitted (bridge reconnect + proxy + protocol, sprite hooks + protocol, frontend protocol)

### What Happened

**Fixed two bugs via /exploration-debug: stackdocs-zxh (P1 reconnect) and stackdocs-oan (P2 memory).**

**stackdocs-zxh — Reconnect stuck on sprite_waking (3 sub-bugs fixed):**

1. **No retry on `createConnection`** (root cause) — `handleDisconnect` in `bridge/src/reconnect.ts:150` had ONE attempt at TCP proxy connection. During deploy (server killed, new server not yet up), it threw and gave up permanently. Browser stuck on `sprite_waking` forever. **Fix:** Added `connectWithRetry()` function (reconnect.ts:134-151) — 5 attempts with 2s delay, only retries on "TCP Proxy closed during init". If all fail, calls `restartServer()` then one final attempt.

2. **No failure message to browser** — catch block only logged to console. **Fix:** Added `broadcastSystem(userId, 'reconnect_failed', msg)` on all failure paths (reconnect.ts:172, 207). Added `reconnect_failed` to `SystemEvent` in protocol.ts, ws-protocol.ts, protocol.py.

3. **Race condition: stale `onClose` deletes new connection** — When verify fails and `conn.close()` is called in reconnect, the async `onClose` callback fires later and blindly deletes from `spriteConnections` — even if a newer replacement connection was already registered. **Fix:** Identity guard in proxy.ts:29: `if (spriteConnections.get(userId) !== conn) return`.

4 new bridge tests (3 reconnect + 1 proxy race condition). All 132 bridge tests pass.

**stackdocs-oan — Session memory lost on deploy (ObservationProcessor never fires):**

Root cause: `turn_count` in `sprite/src/memory/hooks.py:68` was a closure variable, reset to 0 on every process restart. With 25-turn threshold and frequent deploys, never reached threshold. `user.md` stayed empty forever.

**Fix:** Replaced ephemeral `turn_count` with DB query: `SELECT COUNT(*) FROM observations WHERE processed = 0` (hooks.py:108-111). Lowered `DEFAULT_BATCH_THRESHOLD` from 25 to 10. Count now accumulates across process restarts since observations persist in transcript.db.

1 new sprite test (`test_unprocessed_count_survives_restart`). All 18 hooks tests pass.

**Inspector agent reviewed all changes — PASS on both requirements (10/10) and quality.**

### Decisions Made

- **DB-based counting over file-based counter** — querying `observations WHERE processed = 0` is more robust than persisting a counter file. Naturally survives restarts, accurately represents actual unprocessed work.
- **10-turn threshold** — balanced between too aggressive (3) and the broken 25. ~$0.001/batch via Haiku.
- **`reconnect_failed` as new SystemEvent** — gives frontend a way to show "please refresh" instead of infinite spinner.
- **soul.md/os.md overwrite on deploy is correct** — they're deploy-managed. Session resume breaking is expected. Memory files are the persistence layer.

### Gotchas

- **e2e-user-sprite.test.ts** has 3 pre-existing flaky multi-tab tests (message timeout + afterAll hook timeout). Not related to our changes.
- **test_runtime.py** has 15 pre-existing failures locally due to missing `anthropic`/`websockets` modules (Sprite-only deps).
- **Reconnect tests are slow (~20s)** due to real 2s `setTimeout` delays in `connectWithRetry`. Inspector noted this could be improved with injectable delay.

### Next Action

- Deploy bridge changes to Fly.io (`flyctl deploy`) and sprite changes via `/sprite-deploy` to verify in production
- Remaining bugs: m7b.4.14 (chat history lost on refresh), sm2 (spriteExec missing on Fly.io), iic (auth timeout cold start)

---
