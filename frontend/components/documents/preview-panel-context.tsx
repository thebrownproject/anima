'use client'

import { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react'
import type { ImperativeHandle as PanelImperativeHandle } from 'react-resizable-panels'

const STORAGE_KEY = 'stackdocs-preview-collapsed'

interface PreviewPanelContextValue {
  panelRef: React.RefObject<PanelImperativeHandle | null>
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  toggle: () => void
}

const PreviewPanelContext = createContext<PreviewPanelContextValue | null>(null)

export function PreviewPanelProvider({ children }: { children: ReactNode }) {
  const panelRef = useRef<PanelImperativeHandle | null>(null)

  // Initialize from localStorage to avoid hydration mismatch
  const [isCollapsed, setIsCollapsedState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    }
    return false
  })

  const setIsCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(collapsed))
    }
  }, [])

  const toggle = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return

    if (panel.isCollapsed()) {
      panel.expand()
    } else {
      panel.collapse()
    }
  }, [])

  return (
    <PreviewPanelContext.Provider value={{ panelRef, isCollapsed, setIsCollapsed, toggle }}>
      {children}
    </PreviewPanelContext.Provider>
  )
}

export function usePreviewPanel() {
  const context = useContext(PreviewPanelContext)
  if (!context) {
    throw new Error('usePreviewPanel must be used within PreviewPanelProvider')
  }
  return context
}
