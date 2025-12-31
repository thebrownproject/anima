'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

interface SelectedDocumentContextValue {
  // Document selection state
  selectedDocId: string | null
  setSelectedDocId: (id: string | null) => void
  // Preview data (signed URL, MIME type, OCR text)
  signedUrl: string | null
  setSignedUrl: (url: string | null) => void
  signedUrlDocId: string | null
  setSignedUrlDocId: (id: string | null) => void
  mimeType: string
  setMimeType: (type: string) => void
  ocrText: string | null
  setOcrText: (text: string | null) => void
}

const SelectedDocumentContext = createContext<SelectedDocumentContextValue | null>(null)

export function SelectedDocumentProvider({ children }: { children: ReactNode }) {
  const [selectedDocId, setSelectedDocIdState] = useState<string | null>(null)
  const [signedUrl, setSignedUrlState] = useState<string | null>(null)
  const [signedUrlDocId, setSignedUrlDocIdState] = useState<string | null>(null)
  const [mimeType, setMimeTypeState] = useState<string>('')
  const [ocrText, setOcrTextState] = useState<string | null>(null)

  const setSelectedDocId = useCallback((id: string | null) => {
    setSelectedDocIdState(id)
    // Don't clear URL here - causes race condition with react-pdf
    // Consumer will fetch new URL and call setSignedUrl when ready
  }, [])

  const setSignedUrl = useCallback((url: string | null) => {
    setSignedUrlState(url)
  }, [])

  const setSignedUrlDocId = useCallback((id: string | null) => {
    setSignedUrlDocIdState(id)
  }, [])

  const setMimeType = useCallback((type: string) => {
    setMimeTypeState(type)
  }, [])

  const setOcrText = useCallback((text: string | null) => {
    setOcrTextState(text)
  }, [])

  const contextValue = useMemo(() => ({
    selectedDocId,
    setSelectedDocId,
    signedUrl,
    setSignedUrl,
    signedUrlDocId,
    setSignedUrlDocId,
    mimeType,
    setMimeType,
    ocrText,
    setOcrText,
  }), [selectedDocId, setSelectedDocId, signedUrl, setSignedUrl, signedUrlDocId, setSignedUrlDocId, mimeType, setMimeType, ocrText, setOcrText])

  return (
    <SelectedDocumentContext.Provider value={contextValue}>
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
