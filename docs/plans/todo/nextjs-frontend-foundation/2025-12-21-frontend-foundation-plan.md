# Next.js Frontend Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up Next.js 16 frontend with shadcn/ui Nova style, Clerk auth, and Supabase integration for StackDocs MVP

**Architecture:** Next.js App Router with direct Supabase access for CRUD, Clerk for auth, and sidebar-08 boilerplate for navigation

**Tech Stack:** Next.js 16, shadcn/ui (Nova style), Clerk, Supabase, HugeIcons, TypeScript

---

## Task 1: Initialize Next.js Project with shadcn/ui Nova Style

**Files:**
- Scaffolded by shadcn: `frontend/` (entire project structure with all components)
- Modified: `frontend/package.json`

**Step 1: Initialize Next.js project with shadcn Nova preset**

Run:
```bash
cd /Users/fraserbrown/stackdocs/frontend
npx shadcn@latest create \
  --preset "https://ui.shadcn.com/init?base=radix&style=nova&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=inter&menuAccent=subtle&menuColor=default&radius=small&template=next" \
  --template next
```

This creates:
- Complete Next.js 16 project structure
- All shadcn/ui components (button, sidebar, etc.)
- Nova style applied (compact, neutral theme)
- HugeIcons configured
- Tailwind config with Nova theme
- All base dependencies installed

**Step 2: Install additional dependencies**

Run:
```bash
npm install @clerk/nextjs @supabase/supabase-js
```

**Step 3: Test dev server**

Run:
```bash
npm run dev
```
Expected: Server runs on http://localhost:3000 with Nova styling

---

## Task 2: Add Clerk Authentication

**Files:**
- Create: `frontend/middleware.ts`
- Modify: `frontend/app/layout.tsx`

**Step 1: Create Clerk middleware**

Create `frontend/middleware.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher(['/(dashboard)(.*)'])
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Protect dashboard routes
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // Allow public routes
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

**Step 2: Update root layout with ClerkProvider**

Modify `frontend/app/layout.tsx` (add ClerkProvider wrapper):

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'StackDocs',
  description: 'Document data extraction with AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

**Step 3: Create sign-in page**

Create `frontend/app/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}
```

**Step 4: Create sign-up page**

Create `frontend/app/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  )
}
```

---

## Task 3: Setup Supabase Client

**Files:**
- Create: `frontend/lib/supabase.ts`

**Step 1: Create Supabase client**

Create `frontend/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
```

---

## Task 4: Create Environment Variables Template

**Files:**
- Create: `frontend/.env.local.example`

**Step 1: Create environment template**

Create `frontend/.env.local.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key

# API (for agent operations)
NEXT_PUBLIC_API_URL=https://api.stackdocs.io
```

---

## Task 5: Customize Sidebar Navigation

**Files:**
- Already exists (from shadcn): `frontend/components/ui/sidebar.tsx`
- Create: `frontend/components/sidebar/nav.tsx`
- Create: `frontend/app/(dashboard)/layout.tsx`

**Note:** The sidebar components are already created by shadcn. We only customize the navigation content.

**Step 1: Create custom navigation component**

Create `frontend/components/sidebar/nav.tsx` (imports existing sidebar components):

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Layers, Folder } from "@hugeicons/react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

const workspaceItems = [
  {
    title: "Documents",
    url: "/dashboard/documents",
    icon: FileText,
  },
  {
    title: "Extractions",
    url: "/dashboard/extractions",
    icon: Layers,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar variant="inset">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Stacks</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/stacks">
                    <Folder />
                    <span>All Stacks</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
```

**Step 2: Create dashboard layout with sidebar**

Create `frontend/app/(dashboard)/layout.tsx`:

```tsx
import { AppSidebar } from "@/components/sidebar/nav"
import { auth } from "@clerk/nextjs/server"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = auth()

  if (!userId) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  )
}
```

---

## Task 6: Create Dashboard Pages

**Files:**
- Create: `frontend/app/(dashboard)/documents/page.tsx`
- Create: `frontend/app/(dashboard)/extractions/page.tsx`
- Create: `frontend/app/(dashboard)/stacks/page.tsx`

**Step 1: Create Documents page**

Create `frontend/app/(dashboard)/documents/page.tsx`:

```tsx
export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Upload and manage your documents
        </p>
      </div>

      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">
          Upload functionality coming in next phase
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Create Extractions page**

Create `frontend/app/(dashboard)/extractions/page.tsx`:

```tsx
export default function ExtractionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Extractions</h1>
        <p className="text-muted-foreground">
          View and edit extracted data
        </p>
      </div>

      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">
          Extractions view coming in next phase
        </p>
      </div>
    </div>
  )
}
```

**Step 3: Create Stacks page**

Create `frontend/app/(dashboard)/stacks/page.tsx`:

```tsx
export default function StacksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stacks</h1>
        <p className="text-muted-foreground">
          Manage your document stacks
        </p>
      </div>

      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">
          Stacks feature coming in next phase
        </p>
      </div>
    </div>
  )
}
```

---

## Task 7: Final Testing and Commit

**Step 1: Test development server**

Run:
```bash
npm run dev
```
Expected: Server runs on http://localhost:3000

**Step 2: Verify navigation**

Expected:
- Home page loads with StackDocs title
- Navigating to /dashboard redirects to Clerk sign-in
- Sign-in page displays correctly
- After authentication, dashboard layout with sidebar shows
- Sidebar navigation links are present and styled with Nova theme

**Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: initialize Next.js frontend with shadcn Nova, Clerk, and Supabase"
```

---

## Success Criteria

- ✅ Next.js 16 project runs without errors
- ✅ shadcn/ui Nova style applied (compact, neutral theme)
- ✅ Clerk authentication working (sign-in, protected routes)
- ✅ Supabase client configured
- ✅ Sidebar navigation with Workspace/Stacks structure
- ✅ Dashboard pages created (placeholders for future features)
- ✅ Environment variables template created
- ✅ All dependencies installed successfully

---

**Plan complete and saved to `docs/plans/todo/nextjs-frontend-foundation/2025-12-21-frontend-foundation-plan.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**