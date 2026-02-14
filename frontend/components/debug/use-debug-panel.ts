'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'stackdocs:debug'

export function useDebugPanel() {
  const [isOpen, setIsOpen] = useState(false)

  // Read persisted state on mount
  useEffect(() => {
    setIsOpen(localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  // Cmd+Shift+D / Ctrl+Shift+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle])

  return { isOpen, toggle }
}
