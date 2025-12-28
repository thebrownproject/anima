# Issues & Ideas

Lightweight tracking for items that don't need immediate action.

**Categories:** `bug` | `deprecation` | `tech-debt` | `feature`

**Workflow:** Notice something → add a line → check off when done

---

- [x] #1 `deprecation` Clerk `afterSignInUrl` → use `fallbackRedirectUrl` or `forceRedirectUrl` instead (2025-12-23)
- [ ] #2 `feature` Field type definitions for custom extraction - add type selector (text, number, date, array) to field badges, enforce type safety in agent output (2025-12-23)
- [ ] #3 `bug` Clerk production OAuth missing client_id - Google, Microsoft fail; Apple removed (2025-12-23)
  - Google: Cloud Console → APIs & Credentials → Create OAuth 2.0 Client ID → Add to Clerk
  - Microsoft: Azure Portal → App Registrations → Create app → Add to Clerk
  - Clerk docs: https://clerk.com/docs/authentication/social-connections/google
- [ ] #4 `bug` Sign-in page flashes briefly after login before redirecting to /documents (2025-12-23)
- [ ] #5 `tech-debt` Documents table accessibility: add keyboard navigation (Enter/Space) and ARIA labels to clickable rows (2025-12-23)
- [ ] #6 `feature` OCR images not rendering in Visual preview - Mistral OCR extracts images as `![img-0.jpeg](img-0.jpeg)` but we don't store/serve them (2025-12-23)
  - Options: Store extracted images to Supabase Storage during OCR, or strip/hide image markdown
- [ ] #7 `feature` Investigate Mistral OCR markdown output - currently exporting as raw text, check if API supports structured markdown output (2025-12-23)
- [ ] #8 `bug` Changed field highlight animation not visible - animation exists but too subtle or clearing too fast (2025-12-24)
  - Files: `frontend/app/globals.css:130-142`, `frontend/components/documents/document-detail-client.tsx` (changedFields state), `frontend/components/documents/extracted-data-table.tsx:97`
  - Fix: Increase opacity (currently 15%), extend duration, or check if class is being applied
- [x] #9 `bug` Clerk UserButton menu items (Manage account, Sign out) not responding to touch on mobile - popup opens but buttons do nothing (2025-12-24)
- [ ] #10 `feature` Global context to persist SSE streams across navigation - currently if user navigates away mid-extraction/correction, progress panel is lost (agent continues server-side) (2025-12-24)
- [ ] #11 `feature` Drag-and-drop anywhere on documents page - drop file anywhere to start upload, skip dialog step 1, jump straight to extraction config (2025-12-24)
- [ ] #12 `feature` Inline stack creation during upload - "+ New Stack" chip in upload dialog to create stack without leaving flow (2025-12-24)
- [x] #13 `bug` Clerk auth() not detecting clerkMiddleware() - server-side Supabase client fails on routes not matched by middleware (2025-12-24)
  - Fix: Next.js 16 requires `export function proxy(req)` wrapper around `clerkMiddleware()` in `proxy.ts`
- [ ] #14 `feature` Support JPG/PNG image uploads - Mistral OCR already handles images, just need to update accepted file types in upload dialog (2025-12-24)
- [x] #15 `bug` Production RLS failing - Supabase third-party auth only had dev Clerk domain (`worthy-rodent-66.clerk.accounts.dev`), needed to add production domain (`clerk.stackdocs.io`) (2025-12-24)
- [ ] #16 `bug` Document status stuck at `ocr_complete` - extraction agent saves data but doesn't call `complete` tool, so document/extraction status never updates to `completed` (2025-12-24)
  - Files: `backend/app/agents/extraction_agent/agent.py`, `backend/app/agents/extraction_agent/tools/complete.py`
  - Agent needs to reliably call `complete` tool after saving extraction
- [x] #17 `tech-debt` Branding consistency - use "Stackdocs" not "StackDocs" across codebase and marketing (2025-12-24)
  - Fix: Replaced 100+ occurrences across frontend, backend, docs, plans, migrations, CI/CD
- [ ] #18 `feature` Undo/Redo navigation in sidebar header - Linear-style back/forward/history buttons above search, requires navigation history system (2025-12-25)
- [x] #19 `bug` Checkbox selection on document details not activating actions and selection count in sub nav bar (2025-12-28)
  - Fix: Wired up onSelectionChange callback and added SelectionActions to sub-bar
- [ ] #20 `feature` Sub-bar button functionality - Filter dropdown options, Edit inline editing, Export format options need implementation (2025-12-28)
- [ ] #21 `feature` Upload dialog UI/UX polish - redesign wizard flow, integrate with AI chat bar for seamless upload-to-extraction experience (2025-12-28)
- [x] #22 `bug` Visual preview empty on documents list - DocumentsTable passes `ocrText={null}` to PreviewPanel, need to fetch OCR text for selected document (2025-12-28)
  - Files: `frontend/components/documents/documents-table.tsx`
  - Fix: Combined useEffect fetches signed URL and OCR text in parallel when document selected
- [x] #23 `bug` Chevron expansion resizes Field/Value columns - expanding nested fields in ExtractedDataTable causes column widths to shift (2025-12-28)
  - Files: `frontend/components/documents/extracted-data-table.tsx`
  - Fix: Added `table-fixed` class and explicit column widths (select: w-10, field: w-[40%])
- [ ] #24 `bug` Layout breaks at narrow viewports when sidebar + preview open - content goes off-screen, works fine if sidebar collapsed OR preview closed (2025-12-28)
  - Files: `frontend/components/documents/document-detail-client.tsx`, ResizablePanelGroup
  - Likely min-width conflict between sidebar and resizable panels
