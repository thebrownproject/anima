'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface SelectedDocumentContextValue {
  selectedDocId: string | null
  setSelectedDocId: (id: string | null) => void
  signedUrl: string | null
  setSignedUrl: (url: string | null) => void
  clearSelection: () => void
}

const SelectedDocumentContext = createContext<SelectedDocumentContextValue | null>(null)

export function SelectedDocumentProvider({ children }: { children: ReactNode }) {
  const [selectedDocId, setSelectedDocIdState] = useState<string | null>(null)
  const [signedUrl, setSignedUrlState] = useState<string | null>(null)

  const setSelectedDocId = useCallback((id: string | null) => {
    setSelectedDocIdState(id)
    // Always clear URL - will be fetched by consumer if needed
    setSignedUrlState(null)
  }, [])

  const setSignedUrl = useCallback((url: string | null) => {
    setSignedUrlState(url)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedDocIdState(null)
    setSignedUrlState(null)
  }, [])

  return (
    <SelectedDocumentContext.Provider value={{
      selectedDocId,
      setSelectedDocId,
      signedUrl,
      setSignedUrl,
      clearSelection,
    }}>
      {children}
    </SelectedDocumentContext.Provider>
  )
}

export function useSelectedDocument() {
  const context = useContext(SelectedDocumentContext)
  if (!context) {
    throw new Error('useSelectedDocument must be used within SelectedDocumentProvider')
  }
  return context
}
