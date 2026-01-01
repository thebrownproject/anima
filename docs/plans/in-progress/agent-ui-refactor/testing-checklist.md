# Agent UI Refactor - Testing Checklist

## Upload Flow Tests

- [ ] Upload button in header opens popup with dropzone
- [ ] Dropzone accepts PDF files (drag or click)
- [ ] Dropzone accepts JPG/PNG files
- [ ] File validation rejects invalid types
- [ ] File validation rejects files > 10MB
- [ ] Document rename field works in configure step
- [ ] Auto Extract method triggers SSE streaming
- [ ] Custom Fields → Next → Fields step works
- [ ] Custom field tags can be added/removed
- [ ] Popup collapses during extraction
- [ ] Bar shows dynamic status during extraction
- [ ] Complete step shows success actions
- [ ] "View Document" navigates correctly
- [ ] "Upload Another" resets flow
- [ ] Close mid-flow (configure/fields/extracting) shows confirmation dialog
- [ ] Close on dropzone/complete steps does NOT show confirmation

## AgentBar Tests

- [ ] Bar visible on `/documents`
- [ ] Bar visible on `/stacks`
- [ ] Bar visible on `/documents/[id]`
- [ ] Bar visible on `/stacks/[id]`
- [ ] Bar hidden on other routes (settings, etc.)
- [ ] Focus on bar input reveals action buttons
- [ ] Blur from bar hides action buttons
- [ ] Expand/collapse button toggles popup
- [ ] Status text updates during flow
- [ ] Status icon changes based on state (idle, processing, complete, error)

## Popup Tests

- [ ] Popup width matches bar width
- [ ] Popup appears above bar (not overlapping)
- [ ] Collapse button minimizes popup
- [ ] Close button closes flow
- [ ] Popup content scrolls if too tall

## Mobile/Responsive Tests

- [ ] Full width on mobile (< 640px)
- [ ] Max-width constraint on desktop (sm+)
- [ ] iOS safe area padding works (test on real device/simulator)

## Integration Tests

- [ ] Sidebar upload button opens agent popup
- [ ] Header upload button opens agent popup
- [ ] Both buttons use same flow/state
- [ ] No console errors during flow
- [ ] TypeScript compiles with no errors
- [ ] Build passes

## Bugs Found During Testing

| Bug | Status | Notes |
|-----|--------|-------|
| Create Stack action stuck UI | Fixed | Removed action until flow implemented |
| Popup wider than bar | Fixed | Added `w-full` to popup container |

---

Last Updated: 2025-01-01
