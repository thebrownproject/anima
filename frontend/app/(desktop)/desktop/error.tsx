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
    <div className="flex h-svh w-full items-center justify-center bg-black/90">
      <div className="mx-4 max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
        <h2 className="mb-2 text-lg font-medium text-white/95">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-white/50">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="rounded-xl border border-white/20 bg-white/10 px-6 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/15"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
