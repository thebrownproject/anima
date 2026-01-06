# Frontend CLAUDE.md

See root `CLAUDE.md` for project overview, tech stack, and development workflow.

## Quick Facts

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (new-york style)
- **Auth**: Clerk (modal sign-in/sign-up)
- **Data**: Supabase client (direct reads/writes), FastAPI (AI operations only)

## Directory Structure

```
frontend/
├── app/
│   ├── (app)/                    # Protected routes (requires auth)
│   │   ├── @header/              # Parallel route for page headers
│   │   │   ├── documents/        # Documents list/detail headers
│   │   │   └── stacks/           # Stacks list/detail headers
│   │   ├── @subbar/              # Parallel route for page toolbars
│   │   │   ├── documents/        # Documents list/detail subbars
│   │   │   └── stacks/           # Stacks list/detail subbars
│   │   ├── documents/            # Documents list and detail pages
│   │   └── stacks/               # Stacks list and detail pages
│   └── api/webhooks/clerk/       # Clerk webhook for user sync
├── components/
│   ├── agent/                    # Agent system (card, flows, registry)
│   ├── documents/                # Document tables, columns, preview, detail views
│   ├── stacks/                   # Stack tables, detail views, table extraction
│   ├── icons/                    # Centralized Tabler icon barrel export
│   ├── layout/                   # App-level layout components
│   │   └── sidebar/              # Sidebar and navigation components
│   ├── providers/                # Context providers (theme)
│   ├── shared/                   # Reusable components (file-type-icon, stack-badges)
│   └── ui/                       # shadcn/ui primitives
├── lib/
│   ├── queries/                  # Data fetching with React cache()
│   └── supabase/                 # Supabase client setup
├── hooks/                        # Custom React hooks
└── types/                        # TypeScript type definitions
```

## Key Patterns

### Clerk Auth with Next.js 16 (proxy.ts)

Next.js 16 renamed `middleware.ts` to `proxy.ts` and requires the exported function to be named `proxy`. Clerk's `clerkMiddleware()` must be wrapped:

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

**Do NOT use** `export default clerkMiddleware()` - this pattern from Clerk docs is for Next.js 15 and earlier. Next.js 16 won't detect it, causing `auth()` calls in server components to fail with "clerkMiddleware not detected" errors.

If you see this error, check that `proxy.ts` uses `export function proxy(...)` wrapper.

### Page Headers (@header parallel route)

Page-specific headers live in `app/(app)/@header/` as a parallel route slot. The layout renders the `header` prop in the PageHeader component.

- `@header/documents/page.tsx` - Header for documents list
- `@header/documents/[id]/page.tsx` - Header for document detail
- Use `default.tsx` files for route fallbacks

**Why**: Server-component friendly, no hydration issues, idiomatic Next.js pattern.

### Page Subbars (@subbar parallel route)

Same pattern as headers. Filter contexts (e.g., `DocumentsFilterContext`) share state between subbar and page content.

### Data Fetching

- **Reads/writes**: Use Supabase client directly (no FastAPI)
- **AI operations**: Call FastAPI endpoints (extraction, OCR)
- **Deduplication**: Wrap shared fetches with `cache()` from React (see `lib/queries/`)

### Components

- **Always use shadcn/ui** for primitives (Button, Input, Card, Dialog, etc.)
- Don't use raw HTML elements (`<button>`, `<input>`) - use shadcn equivalents
- Component location: feature-specific in `components/<feature>/`, shared UI in `components/ui/`

### Icons

All icons use Tabler Icons via a centralized barrel export:

```typescript
import * as Icons from "@/components/icons"

<Icons.Check className="size-4" />
<Icons.Search className="size-4" />
```

- **Never import directly** from `@tabler/icons-react` - always use the barrel
- **Naming**: `Icon` prefix stripped (e.g., `IconCheck` → `Check`)
- **Type imports**: `import type { Icon } from "@/components/icons"`
- **Adding icons**: Add new exports to `components/icons/index.ts`

### Agent System (Config + Hook Hybrid)

The agent card (bottom of screen) handles document uploads and AI interactions using a registry-based flow system.

**Architecture:**
- **AgentCard**: Unified component that renders any registered flow
- **Flow Registry**: Maps flow types to their metadata + hooks
- **FlowMetadata**: Static config (steps, icons, components)
- **FlowHook**: Dynamic logic (state, handlers, props)

**Directory Structure:**
```
components/agent/
├── card/                    # AgentCard and subcomponents
├── flows/                   # Flow implementations
│   ├── types.tsx            # Core types
│   ├── registry.ts          # Flow registry
│   ├── documents/upload/    # Upload flow (complete)
│   ├── documents/extract/   # Re-extract flow
│   ├── stacks/              # Stack flows (create, edit, add-documents)
│   └── tables/              # Table flows (create, manage-columns, extract)
└── stores/agent-store.ts    # Zustand state
```

**8 Registered Flow Types:**

| Category | Flows |
|----------|-------|
| documents | `upload`, `extract-document` |
| stacks | `create-stack`, `edit-stack`, `add-documents` |
| tables | `create-table`, `manage-columns`, `extract-table` |

**Opening a Flow:**
```typescript
import { useAgentStore, initialUploadData } from '@/components/agent'

const openFlow = useAgentStore((s) => s.openFlow)
openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })
```

**Key Store Actions:**
- `openFlow(flow)` - Start a flow
- `setStep(step)` - Navigate steps
- `setStatus(status, text)` - Update status
- `close()` - Close flow, reset to idle

**Adding New Flows:** See `flows/documents/upload/` as reference. Each flow needs:
1. `metadata.ts` - FlowMetadata config
2. `use-[name]-flow.ts` - Logic hook returning FlowHookResult
3. `index.ts` - Barrel export
4. Register in `flows/registry.ts`
