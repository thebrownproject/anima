'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo, ReactNode } from 'react'
import type { ImperativePanelHandle } from 'react-resizable-panels'

const STORAGE_KEY = 'stackdocs-preview-panel'

interface PreviewPanelState {
  collapsed: boolean
  width: number
  tab: 'pdf' | 'visual'
}

const DEFAULT_STATE: PreviewPanelState = {
  collapsed: false,
  width: 40,
  tab: 'pdf',
}

interface PreviewPanelContextValue {
  panelRef: React.RefObject<ImperativePanelHandle | null>
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  toggle: () => void
  panelWidth: number
  setPanelWidth: (width: number) => void
  activeTab: 'pdf' | 'visual'
  setActiveTab: (tab: 'pdf' | 'visual') => void
}

const PreviewPanelContext = createContext<PreviewPanelContextValue | null>(null)

export function PreviewPanelProvider({ children }: { children: ReactNode }) {
  const panelRef = useRef<ImperativePanelHandle | null>(null)

  // Initialize with defaults for SSR, sync with localStorage after mount
  const [isCollapsed, setIsCollapsedState] = useState(DEFAULT_STATE.collapsed)
  const [panelWidth, setPanelWidthState] = useState(DEFAULT_STATE.width)
  const [activeTab, setActiveTabState] = useState<'pdf' | 'visual'>(DEFAULT_STATE.tab)

  // Sync with localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const state = JSON.parse(saved) as Partial<PreviewPanelState>
        if (typeof state.collapsed === 'boolean') setIsCollapsedState(state.collapsed)
        if (typeof state.width === 'number') setPanelWidthState(state.width)
        if (state.tab === 'pdf' || state.tab === 'visual') setActiveTabState(state.tab)
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, [])

  const persistState = useCallback((updates: Partial<PreviewPanelState>) => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const current = saved ? JSON.parse(saved) : DEFAULT_STATE
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...updates }))
    } catch {
      // Reset to defaults if localStorage is corrupted
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_STATE, ...updates }))
    }
  }, [])

  const setIsCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed)
    persistState({ collapsed })
  }, [persistState])

  const setPanelWidth = useCallback((width: number) => {
    setPanelWidthState(width)
    persistState({ width })
  }, [persistState])

  const setActiveTab = useCallback((tab: 'pdf' | 'visual') => {
    setActiveTabState(tab)
    persistState({ tab })
  }, [persistState])

  const toggle = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return

    if (panel.isCollapsed()) {
      panel.expand()
    } else {
      panel.collapse()
    }
  }, [panelRef])

  const contextValue = useMemo(() => ({
    panelRef,
    isCollapsed,
    setIsCollapsed,
    toggle,
    panelWidth,
    setPanelWidth,
    activeTab,
    setActiveTab,
  }), [panelRef, isCollapsed, setIsCollapsed, toggle, panelWidth, setPanelWidth, activeTab, setActiveTab])

  return (
    <PreviewPanelContext.Provider value={contextValue}>
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
