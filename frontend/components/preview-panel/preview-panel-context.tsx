'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo, ReactNode } from 'react'
import type { ImperativePanelHandle } from 'react-resizable-panels'

// Tab persistence uses a separate key from the panel layout
// The panel layout (width/collapsed) is handled by react-resizable-panels autoSaveId
const TAB_STORAGE_KEY = 'stackdocs-preview-tab'

interface PreviewPanelContextValue {
  panelRef: React.RefObject<ImperativePanelHandle | null>
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  toggle: () => void
  activeTab: 'pdf' | 'text'
  setActiveTab: (tab: 'pdf' | 'text') => void
}

const PreviewPanelContext = createContext<PreviewPanelContextValue | null>(null)

export function PreviewPanelProvider({ children }: { children: ReactNode }) {
  const panelRef = useRef<ImperativePanelHandle | null>(null)

  // isCollapsed is synced via onCollapse/onExpand callbacks from ResizablePanel
  // The library's autoSaveId handles persisting the actual collapsed state
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Tab state with separate persistence (not handled by react-resizable-panels)
  const [activeTab, setActiveTabState] = useState<'pdf' | 'text'>('pdf')

  // Restore tab from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY)
    if (saved === 'pdf' || saved === 'text') {
      setActiveTabState(saved)
    } else if (saved === 'visual') {
      // Migrate old 'visual' tab to 'text'
      setActiveTabState('text')
      localStorage.setItem(TAB_STORAGE_KEY, 'text')
    }
  }, [])

  const setActiveTab = useCallback((tab: 'pdf' | 'text') => {
    setActiveTabState(tab)
    localStorage.setItem(TAB_STORAGE_KEY, tab)
  }, [])

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
    activeTab,
    setActiveTab,
  }), [panelRef, isCollapsed, setIsCollapsed, toggle, activeTab, setActiveTab])

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
