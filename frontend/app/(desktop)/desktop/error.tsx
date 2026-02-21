'use client'

import { useEffect } from 'react'

export default function DesktopError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Desktop error boundary caught:', error)
  }, [error])

  return (
    <div className="flex h-svh w-full items-center justify-center bg-background">
      <div className="mx-4 max-w-md rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-lg">
        <h2 className="mb-2 text-lg font-medium text-foreground">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="rounded-xl border border-border bg-secondary px-6 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
