import Link from 'next/link'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Stackdocs</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Document data extraction with AI
        </p>
      </div>

      <div className="flex gap-4">
        <SignedIn>
          <Link
            href="/documents"
            className="rounded-md bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Go to Documents
          </Link>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="rounded-md border px-6 py-2 hover:bg-accent">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-md bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90">
              Get Started
            </button>
          </SignUpButton>
        </SignedOut>
      </div>
    </div>
  )
}
