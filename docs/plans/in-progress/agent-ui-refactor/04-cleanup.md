# Agent UI Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove old upload dialog and chat bar components after new agent system is integrated.

**Architecture:** Delete deprecated files, update imports, verify build passes.

**Tech Stack:** Next.js, TypeScript

---

## Task 4.1: Remove Old Upload Dialog Components

**Files:**
- Delete: `frontend/components/layout/upload-dialog/` (entire folder)
- Delete: `frontend/components/layout/ai-chat-bar.tsx`
- Delete: `frontend/components/layout/ai-activity-panel.tsx`
- Modify: Any files that import the deleted components

**Step 1: Find all imports of deleted components**

Run: `grep -r "upload-dialog\|ai-chat-bar\|ai-activity-panel" frontend/`

**Step 2: Update imports to use new agent components**

For each file found, update imports:
- `UploadDialogTrigger` / `UploadDialogContent` → `UploadButton` from `@/components/agent`
- `AiChatBar` → `AgentContainer` from `@/components/agent`
- `AiActivityPanel` → Remove (integrated into agent system)

**Step 3: Delete old files**

```bash
rm -rf frontend/components/layout/upload-dialog/
rm frontend/components/layout/ai-chat-bar.tsx
rm frontend/components/layout/ai-activity-panel.tsx
```

**Step 4: Verify no broken imports**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(agent): remove old upload dialog and chat bar components"
```

---

## Task 4.2: Update Barrel Exports

**Files:**
- Modify: `frontend/components/layout/index.ts` (if exists)

**Step 1: Remove deleted exports**

Remove any exports of:
- `UploadDialogTrigger`
- `UploadDialogContent`
- `AiChatBar`
- `AiActivityPanel`

**Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/layout/
git commit -m "refactor(layout): clean up barrel exports after agent migration"
```

---

## Task 4.3: Final Verification and Cleanup

**Files:** None (verification only)

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors (or only pre-existing ones)

**Step 3: Test production build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup after agent UI refactor"
```

---

## Success Criteria

After completing all phases, verify:

- [ ] Upload button in header opens agent popup (not modal)
- [ ] Dropzone → Configure → Processing → Complete flow works
- [ ] User can rename document in configure step
- [ ] Bar shows dynamic status during upload/extraction
- [ ] Popup auto-collapses during processing
- [ ] Actions appear on bar focus, hidden otherwise
- [ ] Actions change based on current route
- [ ] Close mid-flow shows confirmation dialog
- [ ] No regressions in upload/extraction functionality
- [ ] Old upload dialog components deleted
- [ ] Build passes with no TypeScript errors

---

## Files Summary

### Created (all phases)
- `frontend/components/agent/stores/agent-store.ts`
- `frontend/components/agent/agent-bar.tsx`
- `frontend/components/agent/agent-popup.tsx`
- `frontend/components/agent/agent-popup-content.tsx`
- `frontend/components/agent/agent-actions.tsx`
- `frontend/components/agent/agent-container.tsx`
- `frontend/components/agent/upload-button.tsx`
- `frontend/components/agent/index.ts`
- `frontend/components/agent/flows/documents/upload-flow.tsx`
- `frontend/components/agent/flows/documents/upload-dropzone.tsx`
- `frontend/components/agent/flows/documents/upload-configure.tsx`
- `frontend/components/agent/flows/documents/upload-fields.tsx`
- `frontend/components/agent/flows/documents/upload-extracting.tsx`
- `frontend/components/agent/flows/documents/upload-complete.tsx`
- `frontend/components/agent/panels/confirm-close.tsx`

### Modified (all phases)
- `frontend/app/(app)/documents/layout.tsx`
- `frontend/app/(app)/@header/documents/page.tsx`
- `frontend/components/documents/selected-document-context.tsx`

### Deleted (this phase)
- `frontend/components/layout/upload-dialog/` (entire folder)
- `frontend/components/layout/ai-chat-bar.tsx`
- `frontend/components/layout/ai-activity-panel.tsx`
