// frontend/components/documents/upload-dialog/upload-dialog-content.tsx
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DropzoneStep } from './steps/dropzone-step'
import { ConfigureStep } from './steps/configure-step'
import { FieldsStep } from './steps/fields-step'
import { UploadStatus } from './upload-status'
import { ExtractionProgress } from './extraction-progress'
import { streamAgentExtraction, type AgentEvent } from '@/lib/agent-api'
import { getUploadErrorMessage } from '@/lib/upload-config'
import type {
  UploadStep,
  UploadStatus as UploadStatusType,
  ExtractionMethod,
  ExtractionStatus,
  CustomField,
} from '@/types/upload'

interface UploadDialogContentProps {
  /** Callback to close the dialog */
  onClose?: () => void
}

/**
 * Upload dialog content with internal state management.
 * Manages the full upload and extraction flow.
 */
export function UploadDialogContent({ onClose }: UploadDialogContentProps) {
  const { getToken } = useAuth()
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  // State
  const [step, setStep] = useState<UploadStep>('dropzone')
  const [file, setFile] = useState<File | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatusType>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [extractionMethod, setExtractionMethod] =
    useState<ExtractionMethod>('auto')
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle')
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [extractionEvents, setExtractionEvents] = useState<AgentEvent[]>([])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      abortControllerRef.current?.abort()
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [])

  // Handle escape key to cancel extraction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && extractionStatus === 'extracting') {
        abortControllerRef.current?.abort()
        setExtractionStatus('idle')
        setExtractionError('Extraction cancelled')
      }
    }

    if (extractionStatus === 'extracting') {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [extractionStatus])

  // Upload file handler
  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile)
      setUploadStatus('uploading')
      setUploadError(null)
      setStep('configure')

      // Reset extraction state from previous upload
      setExtractionMethod('auto')
      setCustomFields([])
      setExtractionStatus('idle')
      setExtractionError(null)
      setExtractionEvents([])

      try {
        const token = await getToken()
        if (!token) {
          throw new Error('Not authenticated')
        }

        const formData = new FormData()
        formData.append('file', selectedFile)

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/api/document/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          const errorMessage = getUploadErrorMessage(
            response.status,
            error.detail
          )
          throw new Error(errorMessage)
        }

        const data = await response.json()
        setDocumentId(data.document_id)
        setUploadStatus('ready')
      } catch (error) {
        console.error('Upload error:', error)
        setUploadError(error instanceof Error ? error.message : 'Upload failed')
        setUploadStatus('error')
      }
    },
    [getToken]
  )

  // Start extraction
  const handleExtraction = useCallback(
    async () => {
      if (!documentId) {
        setExtractionError('No document to extract from')
        return
      }

      setExtractionStatus('extracting')
      setExtractionError(null)
      setExtractionEvents([])

      abortControllerRef.current = new AbortController()

      const handleEvent = (event: AgentEvent) => {
        if (event.type === 'error') {
          setExtractionError(event.content)
          setExtractionStatus('error')
        } else if (event.type === 'complete') {
          setExtractionStatus('complete')
          setExtractionEvents((prev) => [...prev, event])
          // Close dialog and navigate after brief delay
          navigationTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              onClose?.()
              router.push(`/documents/${documentId}`)
              router.refresh()
            }
          }, 1000)
        } else {
          setExtractionEvents((prev) => [...prev, event])
        }
      }

      try {
        const token = await getToken()
        if (!token) {
          throw new Error('Authentication required')
        }

        await streamAgentExtraction(
          documentId,
          extractionMethod,
          extractionMethod === 'custom' ? customFields : null,
          handleEvent,
          token,
          abortControllerRef.current.signal
        )
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        setExtractionError(message)
        setExtractionStatus('error')
      }
    },
    [documentId, extractionMethod, customFields, getToken, router, onClose]
  )

  // Add custom field
  const handleAddField = useCallback((field: CustomField) => {
    setCustomFields((prev) => [...prev, field])
  }, [])

  // Remove custom field
  const handleRemoveField = useCallback((name: string) => {
    setCustomFields((prev) => prev.filter((f) => f.name !== name))
  }, [])

  // Navigation
  const canGoBack = step !== 'dropzone' && extractionStatus === 'idle'

  const handleBack = () => {
    if (step === 'configure') {
      setStep('dropzone')
    } else if (step === 'fields') {
      setStep('configure')
    }
  }

  const handlePrimaryAction = () => {
    if (step === 'configure') {
      if (extractionMethod === 'auto') {
        handleExtraction()
      } else {
        setStep('fields')
      }
    } else if (step === 'fields') {
      handleExtraction()
    }
  }

  const isPrimaryDisabled = () => {
    if (uploadStatus === 'uploading') return true
    if (uploadStatus !== 'ready') return true
    if (extractionStatus === 'extracting') return true
    if (step === 'fields' && customFields.length === 0) return true
    return false
  }

  const getPrimaryButtonText = () => {
    if (uploadStatus === 'uploading') return 'Uploading...'
    if (extractionStatus === 'extracting') return 'Extracting...'
    if (step === 'configure' && extractionMethod === 'custom') return 'Next'
    return 'Extract'
  }

  const getTitle = () => {
    switch (step) {
      case 'dropzone':
        return 'Upload Document'
      case 'configure':
        return 'Configure Extraction'
      case 'fields':
        return 'Specify Fields'
      default:
        return 'Upload Document'
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-2">
          {canGoBack && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleBack}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Go back</span>
            </Button>
          )}
          <DialogTitle>{getTitle()}</DialogTitle>
        </div>
      </DialogHeader>

      {/* Step content */}
      <div className="py-4">
        {step === 'dropzone' && (
          <DropzoneStep onFileSelect={handleFileSelect} />
        )}

        {step === 'configure' && file && (
          <ConfigureStep
            fileName={file.name}
            extractionMethod={extractionMethod}
            onMethodChange={setExtractionMethod}
          />
        )}

        {step === 'fields' && file && (
          <FieldsStep
            fileName={file.name}
            fields={customFields}
            onAddField={handleAddField}
            onRemoveField={handleRemoveField}
          />
        )}

        {/* Extraction progress */}
        {extractionStatus !== 'idle' && (
          <div className="mt-4">
            <ExtractionProgress
              status={extractionStatus}
              events={extractionEvents}
              error={extractionError}
            />
          </div>
        )}
      </div>

      {/* Footer with status and action */}
      {step !== 'dropzone' && (
        <div className="flex items-center justify-between border-t pt-4">
          <UploadStatus
            status={uploadStatus}
            error={uploadError}
          />
          <Button
            onClick={handlePrimaryAction}
            disabled={isPrimaryDisabled()}
          >
            {getPrimaryButtonText()}
          </Button>
        </div>
      )}
    </DialogContent>
  )
}
