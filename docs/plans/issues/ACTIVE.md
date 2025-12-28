# Active Issues

Lightweight tracking for items that don't need immediate action.

**Categories:** `bug` | `deprecation` | `tech-debt` | `feature`

**Workflow:** Notice something → add a line → move to COMPLETED.md when done

---

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
- [ ] #10 `feature` Global context to persist SSE streams across navigation - currently if user navigates away mid-extraction/correction, progress panel is lost (agent continues server-side) (2025-12-24)
- [ ] #11 `feature` Drag-and-drop anywhere on documents page - drop file anywhere to start upload, skip dialog step 1, jump straight to extraction config (2025-12-24)
- [ ] #12 `feature` Inline stack creation during upload - "+ New Stack" chip in upload dialog to create stack without leaving flow (2025-12-24)
- [ ] #14 `feature` Support JPG/PNG image uploads - Mistral OCR already handles images, just need to update accepted file types in upload dialog (2025-12-24)
- [ ] #16 `bug` Document status stuck at `ocr_complete` - extraction agent saves data but doesn't call `complete` tool, so document/extraction status never updates to `completed` (2025-12-24)
  - Files: `backend/app/agents/extraction_agent/agent.py`, `backend/app/agents/extraction_agent/tools/complete.py`
  - Agent needs to reliably call `complete` tool after saving extraction
- [ ] #18 `feature` Undo/Redo navigation in sidebar header - Linear-style back/forward/history buttons above search, requires navigation history system (2025-12-25)
- [ ] #20 `feature` Sub-bar button functionality - Filter dropdown options, Edit inline editing, Export format options need implementation (2025-12-28)
- [ ] #21 `feature` Upload dialog UI/UX polish - redesign wizard flow, integrate with AI chat bar for seamless upload-to-extraction experience (2025-12-28)
- [ ] #25 `bug` Realtime subscription breaks on document detail pages - channel fails with "CLOSED undefined" after 1-2 minutes, likely Clerk JWT expiry not refreshing Supabase connection (2025-12-28)
  - Error: `[Realtime Debug] Channel failed: CLOSED undefined` in `useExtractionRealtime.useEffect`
  - Files: `frontend/hooks/useExtractionRealtime.ts`
  - Investigate: JWT token refresh, Supabase realtime auth, channel reconnection logic
