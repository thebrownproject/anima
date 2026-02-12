# Frontend CLAUDE.md

See root `CLAUDE.md` for project overview, tech stack, and development workflow.

## Quick Facts

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (new-york style) + Ein UI glass components
- **Auth**: Clerk (modal sign-in/sign-up)
- **Data**: Supabase (platform data only — users/stacks), WebSocket to Bridge/Sprite
- **State**: Zustand stores for canvas + chat state (v2)
- **Animation**: framer-motion (used by Ein UI glass-tabs)

## Current State

Clean infrastructure + `(desktop)/` route group for the v2 glass desktop build. The `(app)/` route group holds the working test-chat prototype. All v1 code is preserved in the `archive/v1-frontend` worktree.

## Directory Structure

```
frontend/
├── app/
│   ├── (app)/                      # Prototype route group
│   │   ├── layout.tsx              # Minimal inset shell (dark bg, rounded-xl)
│   │   └── test-chat/page.tsx      # Glass desktop prototype (529 lines)
│   ├── (desktop)/                  # v2 glass desktop route group
│   │   ├── layout.tsx              # Bare layout — just {children}
│   │   └── stacks/[id]/page.tsx    # Desktop workspace page (placeholder)
│   ├── layout.tsx                  # Root — Clerk, ThemeProvider, Toaster
│   ├── page.tsx                    # Landing page (sign in → /desktop)
│   ├── globals.css                 # Global styles + Ein UI CSS vars + glass tokens
│   └── api/webhooks/clerk/         # Clerk webhook for user sync to Supabase
├── components/
│   ├── icons/                      # Tabler icon barrel export
│   ├── providers/                  # ThemeProvider (next-themes)
│   └── ui/                         # shadcn/ui primitives + Ein UI glass components
│       ├── glass-button.tsx        # Glass morphism button (variants: default, primary, outline, ghost, destructive)
│       ├── glass-card.tsx          # Glass morphism card with optional glow
│       ├── glass-dock.tsx          # Vertical dock component
│       ├── glass-input.tsx         # Glass input field
│       └── glass-tabs.tsx          # Glass tab switcher (framer-motion animated)
├── hooks/
│   └── use-mobile.ts              # Viewport detection (used by shadcn tooltip)
├── lib/
│   ├── supabase.ts                # Supabase client (browser)
│   ├── supabase-server.ts         # Supabase client (server components)
│   ├── websocket.ts               # v2 WebSocketManager (auto-reconnect, routing)
│   └── utils.ts                   # cn() for Tailwind class merging
├── types/
│   ├── ws-protocol.ts             # WebSocket message protocol (copy of bridge source)
│   └── index.ts                   # Barrel export
├── proxy.ts                       # Clerk auth middleware (Next.js 16 pattern)
├── components.json                # shadcn/ui config + @einui registry
└── package.json
```

## CSS Variables (globals.css)

### Ein UI Glass Theming

```css
/* Glass Effect */
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-border: rgba(255, 255, 255, 0.1);
--glass-blur: 16px;

/* Glow Colors */
--glow-cyan: rgba(6, 182, 212, 0.3);
--glow-purple: rgba(147, 51, 234, 0.3);
--glow-pink: rgba(236, 72, 153, 0.3);

/* Text Colors */
--text-primary: rgba(255, 255, 255, 0.95);
--text-secondary: rgba(255, 255, 255, 0.7);
--text-muted: rgba(255, 255, 255, 0.5);
```

### Custom Tokens

- `--ease-apple: cubic-bezier(0.2, 0.8, 0.2, 1)` — Apple-style easing (in `@theme inline`)
- `@keyframes animate-scan` — CRT scan line effect (Phase C generative cards)

## Key Patterns

### Route Groups

- `(app)/` — prototype/dev routes. Inset layout with dark bg + rounded corners.
- `(desktop)/` — v2 production routes. Bare layout, full viewport. URL: `/stacks/[id]`

### Clerk Auth with Next.js 16 (proxy.ts)

`proxy.ts` protects all non-public routes automatically. Layouts need zero auth code.

```typescript
// proxy.ts - CORRECT for Next.js 16
export function proxy(req: NextRequest, event: NextFetchEvent) {
  return clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect()
    }
  })(req, event)
}
```

**Do NOT use** `export default clerkMiddleware()` — Next.js 16 won't detect it.

### Icons

All icons via `@/components/icons` barrel. Never import directly from `@tabler/icons-react`.

```typescript
import * as Icons from "@/components/icons"
<Icons.Check className="size-4" />
```

### Ein UI Glass Components

Registry configured in `components.json` as `@einui` → `https://ui.eindev.ir/r/{name}.json`. Install new glass components via shadcn CLI. Components use hardcoded Tailwind classes (`bg-white/10`, `backdrop-blur-xl`, etc.) plus the CSS variables above.

### WebSocket Protocol

Types in `types/ws-protocol.ts` are a copy of `bridge/src/protocol.ts` (source of truth). Update bridge first, then copy here.

## shadcn/ui Components

16 primitives: avatar, badge, button, card, checkbox, dialog, dropdown-menu, input, popover, progress, separator, sheet, skeleton, sonner, table, tabs, textarea, tooltip.

**Do not modify** — managed by shadcn CLI. Custom components belong in `components/<feature>/`.

## What Was Removed (v1)

All v1 code preserved in `archive/v1-frontend` worktree. See git history for details.
