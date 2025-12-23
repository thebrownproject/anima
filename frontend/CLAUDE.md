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
│   │   │   ├── documents/        # Documents list header (Upload button)
│   │   │   └── documents/[id]/   # Document detail header (title + actions)
│   │   ├── documents/            # Documents list and detail pages
│   │   ├── stacks/               # Stacks feature (placeholder)
│   │   └── extractions/          # Extractions feature (placeholder)
│   └── api/webhooks/clerk/       # Clerk webhook for user sync
├── components/
│   ├── documents/                # Document-specific components
│   ├── layout/                   # PageHeader, sidebar components
│   └── ui/                       # shadcn/ui primitives (Button, Card, etc.)
├── lib/
│   ├── queries/                  # Data fetching with React cache()
│   └── supabase/                 # Supabase client setup
├── hooks/                        # Custom React hooks
└── types/                        # TypeScript type definitions
```

## Key Patterns

### Page Headers (@header parallel route)

Page-specific headers live in `app/(app)/@header/` as a parallel route slot. The layout renders the `header` prop in the PageHeader component.

- `@header/documents/page.tsx` - Header for documents list
- `@header/documents/[id]/page.tsx` - Header for document detail
- Use `default.tsx` files for route fallbacks

**Why**: Server-component friendly, no hydration issues, idiomatic Next.js pattern.

### Data Fetching

- **Reads/writes**: Use Supabase client directly (no FastAPI)
- **AI operations**: Call FastAPI endpoints (extraction, OCR)
- **Deduplication**: Wrap shared fetches with `cache()` from React (see `lib/queries/`)

### Components

- **Always use shadcn/ui** for primitives (Button, Input, Card, Dialog, etc.)
- Don't use raw HTML elements (`<button>`, `<input>`) - use shadcn equivalents
- Component location: feature-specific in `components/<feature>/`, shared UI in `components/ui/`
