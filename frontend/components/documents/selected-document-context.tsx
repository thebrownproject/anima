'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

interface StackSummary {
  id: string
  name: string
}

interface DocumentMetadata {
  filename: string
  filePath: string | null
  assignedStacks: StackSummary[]
}

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
  // Document metadata for subbar actions
  filename: string | null
  filePath: string | null
  assignedStacks: StackSummary[]
  setDocumentMetadata: (metadata: DocumentMetadata) => void
  // Extraction data for export
  extractedFields: Record<string, unknown> | null
  setExtractedFields: (fields: Record<string, unknown> | null) => void
  isLoadingExtraction: boolean
  setIsLoadingExtraction: (loading: boolean) => void
}

const SelectedDocumentContext = createContext<SelectedDocumentContextValue | null>(null)

export function SelectedDocumentProvider({ children }: { children: ReactNode }) {
  const [selectedDocId, setSelectedDocIdState] = useState<string | null>(null)
  const [signedUrl, setSignedUrlState] = useState<string | null>(null)
  const [signedUrlDocId, setSignedUrlDocIdState] = useState<string | null>(null)
  const [mimeType, setMimeTypeState] = useState<string>('')
  const [ocrText, setOcrTextState] = useState<string | null>(null)
  // Document metadata for subbar actions
  const [filename, setFilenameState] = useState<string | null>(null)
  const [filePath, setFilePathState] = useState<string | null>(null)
  const [assignedStacks, setAssignedStacksState] = useState<StackSummary[]>([])
  // Extraction data for export
  const [extractedFields, setExtractedFieldsState] = useState<Record<string, unknown> | null>(null)
  const [isLoadingExtraction, setIsLoadingExtractionState] = useState(false)

  const setSelectedDocId = useCallback((id: string | null) => {
    setSelectedDocIdState(id)
    // Don't clear URL here - causes race condition with react-pdf
    // Consumer will fetch new URL and call setSignedUrl when ready
    // Clear metadata when deselecting
    if (id === null) {
      setFilenameState(null)
      setFilePathState(null)
      setAssignedStacksState([])
      setExtractedFieldsState(null)
      setIsLoadingExtractionState(false)
    }
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

  const setDocumentMetadata = useCallback((metadata: DocumentMetadata) => {
    setFilenameState(metadata.filename)
    setFilePathState(metadata.filePath)
    setAssignedStacksState(metadata.assignedStacks)
  }, [])

  const setExtractedFields = useCallback((fields: Record<string, unknown> | null) => {
    setExtractedFieldsState(fields)
  }, [])

  const setIsLoadingExtraction = useCallback((loading: boolean) => {
    setIsLoadingExtractionState(loading)
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
    // Document metadata
    filename,
    filePath,
    assignedStacks,
    setDocumentMetadata,
    // Extraction data
    extractedFields,
    setExtractedFields,
    isLoadingExtraction,
    setIsLoadingExtraction,
  }), [
    selectedDocId, setSelectedDocId,
    signedUrl, setSignedUrl,
    signedUrlDocId, setSignedUrlDocId,
    mimeType, setMimeType,
    ocrText, setOcrText,
    filename, filePath, assignedStacks, setDocumentMetadata,
    extractedFields, setExtractedFields,
    isLoadingExtraction, setIsLoadingExtraction,
  ])

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
