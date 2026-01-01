// frontend/components/agent/flows/documents/upload/use-upload-flow.ts
'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import {
  useAgentStore,
  useAgentFlow,
  type UploadFlowStep,
  type UploadFlowData,
} from '../../../stores/agent-store'
import { streamAgentExtraction, type AgentEvent } from '@/lib/agent-api'
import { getUploadErrorMessage } from '@/lib/upload-config'
import type { FlowHookResult } from '../../types'

/**
 * Props for each step component.
 * Explicitly typed for type safety.
 */
export interface UploadFlowStepProps {
  dropzone: {
    onFileSelect: (file: File) => void
  }
  configure: {
    data: UploadFlowData
    onUpdate: (data: Partial<UploadFlowData>) => void
    onNext: () => void
    isPrimaryDisabled: boolean
    primaryButtonText: string
  }
  fields: {
    data: UploadFlowData
    onUpdate: (data: Partial<UploadFlowData>) => void
    onExtract: () => void
  }
  extracting: Record<string, never> // No props - reads from store
  complete: {
    documentName: string
    onViewDocument: () => void
    onUploadAnother: () => void
  }
}

/**
 * Hook containing all upload flow logic.
 * Returns computed state and handlers for the AgentCard.
 */
export function useUploadFlow(): FlowHookResult<UploadFlowStep> & {
  stepProps: UploadFlowStepProps
} {
  const { getToken } = useAuth()
  const router = useRouter()
  const flow = useAgentFlow()
  const abortControllerRef = useRef<AbortController | null>(null)

  const actions = useAgentStore(
    useShallow((s) => ({
      setStep: s.setStep,
      updateFlowData: s.updateFlowData,
      setStatus: s.setStatus,
      addEvent: s.addEvent,
      collapse: s.collapse,
      close: s.close,
    }))
  )

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortControllerRef.current?.abort()
  }, [])

  // Extract flow state (with safe defaults)
  const step = (flow?.type === 'upload' ? flow.step : 'dropzone') as UploadFlowStep
  const data = (flow?.type === 'upload' ? flow.data : {}) as UploadFlowData

  const { setStep, updateFlowData, setStatus, addEvent, collapse, close } = actions

  // Handle file selection from dropzone
  const handleFileSelect = useCallback(async (file: File) => {
    updateFlowData({
      file,
      documentName: file.name,
      uploadStatus: 'uploading',
      uploadError: null,
    })
    setStep('configure')
    setStatus('processing', 'Uploading document...')

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/document/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(getUploadErrorMessage(response.status, error.detail))
      }

      const result = await response.json()
      updateFlowData({
        documentId: result.document_id,
        uploadStatus: 'ready',
      })
      setStatus('idle', 'Configure extraction settings')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      updateFlowData({ uploadStatus: 'error', uploadError: message })
      setStatus('error', message)
    }
  }, [getToken, updateFlowData, setStep, setStatus])

  // Start extraction
  // FIX #10: Use specific data fields instead of entire `data` object
  // to prevent unnecessary callback recreation when unrelated fields change
  const handleExtract = useCallback(async () => {
    if (!data.documentId) return

    setStep('extracting')
    collapse()
    setStatus('processing', 'Extracting...')

    const handleEvent = (event: AgentEvent) => {
      addEvent(event)
      if (event.type === 'tool') {
        setStatus('processing', event.content)
      } else if (event.type === 'complete') {
        setStep('complete')
        setStatus('complete', 'Extraction complete')
      } else if (event.type === 'error') {
        updateFlowData({ extractionError: event.content })
        setStatus('error', event.content)
      }
    }

    try {
      const token = await getToken()
      if (!token) throw new Error('Authentication required')

      // Cancel any in-flight extraction and create new controller
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      await streamAgentExtraction(
        data.documentId,
        data.extractionMethod,
        data.extractionMethod === 'custom' ? data.customFields : null,
        handleEvent,
        token,
        abortControllerRef.current.signal
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : 'Extraction failed'
      updateFlowData({ extractionError: message })
      setStatus('error', message)
    }
  }, [
    // FIX #10: Only depend on specific fields used in the callback
    data.documentId,
    data.extractionMethod,
    data.customFields,
    getToken,
    setStep,
    collapse,
    setStatus,
    addEvent,
    updateFlowData,
  ])

  // Navigation: back
  const handleBack = useCallback(() => {
    const prevStep: Partial<Record<UploadFlowStep, UploadFlowStep>> = {
      configure: 'dropzone',
      fields: 'configure',
    }
    const prev = prevStep[step]
    if (prev) setStep(prev)
  }, [step, setStep])

  // Navigation: next
  const handleNext = useCallback(() => {
    if (step === 'configure' && data.extractionMethod === 'custom') {
      setStep('fields')
    } else {
      handleExtract()
    }
  }, [step, data.extractionMethod, setStep, handleExtract])

  // Complete: view document
  const handleViewDocument = useCallback(() => {
    if (data.documentId) {
      close()
      router.push(`/documents/${data.documentId}`)
    }
  }, [data.documentId, router, close])

  // Complete: upload another
  const handleUploadAnother = useCallback(() => {
    updateFlowData({
      file: null,
      documentId: null,
      documentName: '',
      extractionMethod: 'auto',
      customFields: [],
      uploadStatus: 'idle',
      uploadError: null,
      extractionError: null,
    })
    setStep('dropzone')
    setStatus('idle', 'Drop a file to get started')
  }, [updateFlowData, setStep, setStatus])

  // Computed state
  const canGoBack = step === 'configure' || step === 'fields'
  const needsConfirmation = ['configure', 'fields', 'extracting'].includes(step)

  // Build step props
  const stepProps: UploadFlowStepProps = {
    dropzone: {
      onFileSelect: handleFileSelect,
    },
    configure: {
      data,
      onUpdate: updateFlowData,
      onNext: handleNext,
      isPrimaryDisabled: data.uploadStatus !== 'ready',
      primaryButtonText:
        data.uploadStatus === 'uploading'
          ? 'Uploading...'
          : data.extractionMethod === 'custom'
            ? 'Next'
            : 'Extract',
    },
    fields: {
      data,
      onUpdate: updateFlowData,
      onExtract: handleExtract,
    },
    extracting: {},
    complete: {
      documentName: data.documentName,
      onViewDocument: handleViewDocument,
      onUploadAnother: handleUploadAnother,
    },
  }

  return {
    step,
    canGoBack,
    needsConfirmation,
    onBack: handleBack,
    stepProps,
  }
}
