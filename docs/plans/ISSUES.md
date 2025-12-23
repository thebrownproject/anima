# Issues & Ideas

Lightweight tracking for items that don't need immediate action.

**Categories:** `bug` | `deprecation` | `tech-debt` | `feature`

**Workflow:** Notice something → add a line → check off when done

---

- [x] #1 `deprecation` Clerk `afterSignInUrl` → use `fallbackRedirectUrl` or `forceRedirectUrl` instead (2025-12-23)
- [ ] #2 `feature` Field type definitions for documents page extraction (post-MVP) (2025-12-23)
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
