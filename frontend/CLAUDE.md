# Frontend CLAUDE.md

See root `CLAUDE.md` for project overview, tech stack, and development workflow.

## Quick Facts

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (new-york style) + Ein UI glass components
- **Auth**: Clerk (modal sign-in/sign-up)
- **Data**: Supabase (platform data only — users/stacks), WebSocket to Bridge/Sprite
- **State**: Zustand stores for desktop + chat + wallpaper + voice state
- **Animation**: framer-motion (used by Ein UI glass-tabs), Rive (Persona orb)
- **Voice**: Deepgram Nova-3 STT + OpenAI gpt-4o-mini-tts (feature-flagged)

## Current State

Clean infrastructure + `(desktop)/` route group for the v2 glass desktop build. The `(app)/` route group holds the working test-chat prototype. All v1 code is preserved in the `archive/v1-frontend` worktree.

## Directory Structure

```
frontend/
├── app/
│   ├── (app)/                      # Prototype route group
│   │   ├── layout.tsx              # Minimal inset shell (dark bg, rounded-xl)
│   │   └── test-chat/page.tsx      # Glass desktop prototype
│   ├── (desktop)/                  # v2 glass desktop route group
│   │   └── desktop/page.tsx        # Desktop workspace page
│   ├── layout.tsx                  # Root — Clerk, ThemeProvider, Toaster
│   ├── page.tsx                    # Landing page (sign in → /desktop)
│   ├── globals.css                 # Global styles + Ein UI CSS vars + glass tokens
│   ├── api/webhooks/clerk/         # Clerk webhook for user sync to Supabase
│   └── api/voice/                 # Voice API routes (auth + feature-gated)
│       ├── deepgram-token/route.ts # GET — temp Deepgram browser token (30s TTL)
│       └── tts/route.ts           # POST — OpenAI TTS proxy (streams PCM audio)
├── components/
│   ├── ai-elements/                # AI Elements (Vercel) — FileTree, Persona
│   ├── desktop/                    # v2 glass desktop components
│   │   ├── desktop-viewport.tsx    # Infinite canvas with pan/zoom/momentum
│   │   ├── desktop-card.tsx        # Draggable card with momentum physics
│   │   ├── desktop-top-bar.tsx     # Top bar with workspace tabs
│   │   ├── desktop-context-menu.tsx # Right-click context menu
│   │   ├── chat-panel.tsx          # Side panel chat (uses GlassSidePanel)
│   │   ├── chat-bar.tsx            # Bottom chat bar + embedded mode + voice orb
│   │   ├── documents-panel.tsx     # File tree side panel
│   │   ├── glass-side-panel.tsx    # Reusable sliding glass panel
│   │   ├── glass-tab-switcher.tsx  # Workspace tab switcher
│   │   ├── block-renderer.tsx      # Card content block renderer
│   │   ├── auto-placer.ts          # Auto-position new cards on canvas
│   │   └── ws-provider.tsx         # WebSocket React context provider
│   ├── voice/                      # Voice integration (feature-flagged)
│   │   ├── use-stt.ts             # Deepgram streaming STT hook
│   │   ├── use-tts.ts             # OpenAI audio playback hook
│   │   ├── voice-provider.tsx     # React context composing STT+TTS+store
│   │   └── persona-orb.tsx        # Rive animation orb with tap actions
│   ├── icons/                      # Tabler icon barrel export
│   ├── providers/                  # ThemeProvider (next-themes)
│   ├── ui/                         # shadcn/ui primitives + glass components
│   │   ├── button.tsx              # shadcn button (managed)
│   │   ├── collapsible.tsx         # shadcn collapsible (managed)
│   │   ├── sonner.tsx              # shadcn toast (managed)
│   │   ├── glass-button.tsx        # Glass morphism button (CVA variants)
│   │   ├── glass-card.tsx          # Glass morphism card with optional glow
│   │   ├── glass-icon-button.tsx   # Reusable tooltip + icon button
│   │   ├── glass-input.tsx         # Glass input field
│   │   ├── glass-tabs.tsx          # Glass tab switcher (framer-motion)
│   │   ├── glass-tooltip.tsx       # Glass tooltip
│   │   └── glass-context-menu.tsx  # Glass right-click menu
│   └── wallpaper/                  # Desktop wallpaper system
│       ├── wallpaper-layer.tsx     # Wallpaper background renderer
│       └── wallpaper-picker.tsx    # Wallpaper selection UI
├── hooks/
│   ├── use-mobile.ts              # Viewport detection (used by shadcn tooltip)
│   └── use-momentum.ts            # Shared momentum physics (card + viewport drag)
├── lib/
│   ├── stores/
│   │   ├── chat-store.ts          # Chat messages, mode, streaming state
│   │   ├── desktop-store.ts       # Cards, tabs, active workspace
│   │   ├── voice-store.ts         # Voice state machine (5 states, validated transitions)
│   │   └── wallpaper-store.ts     # Wallpaper selection + persistence
│   ├── voice-config.ts            # Voice feature flag + env validation
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
- `(desktop)/` — v2 production routes. No layout wrapper. URL: `/stacks/[id]`

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

All icons via `@/components/icons` barrel. Never import directly from `@tabler/icons-react`. Global stroke-width set to 1.25 in `globals.css`.

```typescript
import * as Icons from "@/components/icons"
<Icons.Check className="size-4" />
```

### Ein UI Glass Components

Registry configured in `components.json` as `@einui` → `https://ui.eindev.ir/r/{name}.json`. Install new glass components via shadcn CLI. Components use hardcoded Tailwind classes (`bg-white/10`, `backdrop-blur-xl`, etc.) plus the CSS variables above.

### WebSocket Protocol

Types in `types/ws-protocol.ts` are a copy of `bridge/src/protocol.ts` (source of truth). Update bridge first, then copy here.

## Voice Integration

Feature-flagged via `NEXT_PUBLIC_VOICE_ENABLED`. When `true`, the chat bar mic button becomes a Persona orb with STT/TTS.

**Required env vars** (`.env.local`):
```
NEXT_PUBLIC_VOICE_ENABLED=true   # Feature flag (build-time, requires restart)
DEEPGRAM_API_KEY=...             # Server-side only — STT temp tokens
OPENAI_API_KEY=...               # Server-side only — TTS proxy
```

**Architecture:** Browser-only I/O layer. Raw audio never touches Bridge or Sprite.
- STT: Deepgram Nova-3 via browser WebSocket (temp token from `/api/voice/deepgram-token`)
- TTS: OpenAI gpt-4o-mini-tts via `/api/voice/tts` proxy (streams audio/mpeg)
- State: `voice-store.ts` — 5-state machine (`asleep → idle → listening → thinking → speaking`)
- Provider nesting: `WebSocketProvider > MaybeVoiceProvider > GlassTooltipProvider`
- `MaybeVoiceProvider` renders children-only when voice disabled (zero overhead)
- `useVoiceMaybe()` returns `null` outside VoiceProvider (safe for conditional voice features)

**Tests:** 74 tests across 9 files. Run with `npm run test:run` from `frontend/`.

## shadcn/ui Components

3 managed primitives: `button`, `collapsible`, `sonner`.

**Do not modify** — managed by shadcn CLI. Custom glass components (`glass-*.tsx`) are project-owned and editable.
