// frontend/components/agent/flows/documents/upload-flow.tsx
'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { useAgentStore, useAgentFlow, getUploadTitle, type UploadFlowStep } from '../../stores/agent-store'
import { AgentPopup } from '../../agent-popup'
import { UploadDropzone } from './upload-dropzone'
import { UploadConfigure } from './upload-configure'
import { UploadFields } from './upload-fields'
import { UploadExtracting } from './upload-extracting'
import { UploadComplete } from './upload-complete'
import { streamAgentExtraction, type AgentEvent } from '@/lib/agent-api'
import { getUploadErrorMessage } from '@/lib/upload-config'

export function UploadFlow() {
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
      collapsePopup: s.collapsePopup,
      close: s.close,
    }))
  )

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortControllerRef.current?.abort()
  }, [])

  // Only render for upload flow
  if (!flow || flow.type !== 'upload') return null

  const { step, data } = flow
  const { setStep, updateFlowData, setStatus, addEvent, collapsePopup, close } = actions

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
  const handleExtract = useCallback(async () => {
    if (!data.documentId) return

    setStep('extracting')
    collapsePopup()
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
  }, [data, getToken, setStep, collapsePopup, setStatus, addEvent, updateFlowData])

  // Navigation handlers - type-safe step transitions
  const handleBack = useCallback(() => {
    const prevStep: Partial<Record<UploadFlowStep, UploadFlowStep>> = {
      configure: 'dropzone',
      fields: 'configure',
    }
    const prev = prevStep[step]
    if (prev) setStep(prev)
  }, [step, setStep])

  const handleNext = useCallback(() => {
    if (step === 'configure' && data.extractionMethod === 'custom') {
      setStep('fields')
    } else {
      handleExtract()
    }
  }, [step, data.extractionMethod, setStep, handleExtract])

  const handleViewDocument = useCallback(() => {
    if (data.documentId) {
      close()
      router.push(`/documents/${data.documentId}`)
    }
  }, [data.documentId, router, close])

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

  const showBack = step === 'configure' || step === 'fields'

  return (
    <AgentPopup title={getUploadTitle(step)} showBack={showBack} onBack={handleBack}>
      {step === 'dropzone' && (
        <UploadDropzone onFileSelect={handleFileSelect} />
      )}
      {step === 'configure' && (
        <UploadConfigure
          data={data}
          onUpdate={updateFlowData}
          onNext={handleNext}
          isPrimaryDisabled={data.uploadStatus !== 'ready'}
          primaryButtonText={data.uploadStatus === 'uploading' ? 'Uploading...' : (data.extractionMethod === 'custom' ? 'Next' : 'Extract')}
        />
      )}
      {step === 'fields' && (
        <UploadFields
          data={data}
          onUpdate={updateFlowData}
          onExtract={handleExtract}
        />
      )}
      {step === 'extracting' && (
        <UploadExtracting />
      )}
      {step === 'complete' && (
        <UploadComplete
          documentName={data.documentName}
          onViewDocument={handleViewDocument}
          onUploadAnother={handleUploadAnother}
        />
      )}
    </AgentPopup>
  )
}
