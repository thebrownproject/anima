// frontend/components/agent/stores/agent-store.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type {} from '@redux-devtools/extension' // required for devtools typing
import type { AgentEvent } from '@/lib/agent-api'
import type { CustomField, ExtractionMethod } from '@/types/upload'

// Upload step type (extends existing UploadStep with extraction states)
export type UploadFlowStep = 'dropzone' | 'configure' | 'fields' | 'extracting' | 'complete'

// Discriminated union for type-safe flow routing
export type AgentFlow =
  // Document flows
  | { type: 'upload'; step: UploadFlowStep; data: UploadFlowData }
  | { type: 'extract-document'; documentId: string }
  // Stack flows (post-MVP)
  | { type: 'create-stack' }
  | { type: 'edit-stack'; stackId: string }
  | { type: 'add-documents'; stackId: string }
  // Table flows (post-MVP)
  | { type: 'create-table'; stackId: string }
  | { type: 'manage-columns'; stackId: string; tableId: string }
  | { type: 'extract-table'; stackId: string; tableId: string }
  | null

export interface UploadFlowData {
  file: File | null
  documentId: string | null
  documentName: string
  extractionMethod: ExtractionMethod
  customFields: CustomField[]
  uploadStatus: 'idle' | 'uploading' | 'ready' | 'error'
  uploadError: string | null
  extractionError: string | null
}

export type AgentStatus = 'idle' | 'processing' | 'waiting' | 'complete' | 'error'

interface AgentStore {
  // Popup state
  flow: AgentFlow
  isExpanded: boolean  // Actions visible in bar
  isPopupOpen: boolean // Popup visible

  // Dynamic bar state
  status: AgentStatus
  statusText: string

  // SSE events (capped at 100)
  events: AgentEvent[]

  // Actions
  openFlow: (flow: NonNullable<AgentFlow>) => void
  setStep: (step: UploadFlowStep) => void
  updateFlowData: (data: Partial<UploadFlowData>) => void
  setStatus: (status: AgentStatus, text: string) => void
  addEvent: (event: AgentEvent) => void
  setExpanded: (expanded: boolean) => void
  collapsePopup: () => void
  expandPopup: () => void
  close: () => void
  reset: () => void
}

export const initialUploadData: UploadFlowData = {
  file: null,
  documentId: null,
  documentName: '',
  extractionMethod: 'auto',
  customFields: [],
  uploadStatus: 'idle',
  uploadError: null,
  extractionError: null,
}

export const useAgentStore = create<AgentStore>()(
  devtools(
    persist(
      (set, get) => ({
        flow: null,
        isExpanded: false,
        isPopupOpen: false,
        status: 'idle',
        statusText: 'How can I help you today?',
        events: [],

        openFlow: (flow) => set({
          flow,
          isPopupOpen: true,
          status: 'idle',
          statusText: getFlowStatusText(flow),
          events: [],
        }, undefined, 'agent/openFlow'),

        setStep: (step) => set((state) => {
          if (!state.flow || state.flow.type !== 'upload') return state
          return {
            flow: { ...state.flow, step },
            statusText: getStepStatusText(step),
          }
        }, undefined, 'agent/setStep'),

        updateFlowData: (data) => set((state) => {
          if (!state.flow || state.flow.type !== 'upload') return state
          return {
            flow: {
              ...state.flow,
              data: { ...state.flow.data, ...data },
            },
          }
        }, undefined, 'agent/updateFlowData'),

        setStatus: (status, statusText) => set({ status, statusText }, undefined, 'agent/setStatus'),

        addEvent: (event) => set((state) => ({
          events: [...state.events, event].slice(-100), // Cap at 100
        }), undefined, 'agent/addEvent'),

        setExpanded: (isExpanded) => set({ isExpanded }, undefined, 'agent/setExpanded'),

        collapsePopup: () => set({ isPopupOpen: false }, undefined, 'agent/collapsePopup'),

        expandPopup: () => set({ isPopupOpen: true }, undefined, 'agent/expandPopup'),

        close: () => set({
          flow: null,
          isPopupOpen: false,
          status: 'idle',
          statusText: 'How can I help you today?',
          events: [],
        }, undefined, 'agent/close'),

        reset: () => set({
          flow: null,
          isPopupOpen: false,
          isExpanded: false,
          status: 'idle',
          statusText: 'How can I help you today?',
          events: [],
        }, undefined, 'agent/reset'),
      }),
      {
        name: 'agent-store', // localStorage key
        // Only persist flow state - exclude non-serializable data and transient UI state
        partialize: (state) => ({
          flow: state.flow
            ? {
                ...state.flow,
                // For upload flows, exclude File objects (not serializable)
                ...(state.flow.type === 'upload' && {
                  data: {
                    ...state.flow.data,
                    file: null, // File objects can't be serialized to localStorage
                  },
                }),
              }
            : null,
          isPopupOpen: state.isPopupOpen,
        }),
      }
    ),
    { name: 'AgentStore', enabled: process.env.NODE_ENV !== 'production' }
  )
)

// Helper functions for status text
function getFlowStatusText(flow: NonNullable<AgentFlow>): string {
  switch (flow.type) {
    case 'upload': return 'Drop a file to get started'
    case 'create-stack': return 'Create a new stack'
    default: return 'How can I help you today?'
  }
}

function getStepStatusText(step: UploadFlowStep): string {
  switch (step) {
    case 'dropzone': return 'Drop a file to get started'
    case 'configure': return 'Configure extraction settings'
    case 'fields': return 'Specify fields to extract'
    case 'extracting': return 'Extracting...'
    case 'complete': return 'Extraction complete'
  }
}

// Selector helpers (useShallow for object selectors to prevent unnecessary re-renders)
export const useAgentFlow = () => useAgentStore((s) => s.flow)
export const useAgentStatus = () => useAgentStore(
  useShallow((s) => ({ status: s.status, statusText: s.statusText }))
)
export const useAgentPopup = () => useAgentStore(
  useShallow((s) => ({ isPopupOpen: s.isPopupOpen, isExpanded: s.isExpanded }))
)
export const useAgentEvents = () => useAgentStore((s) => s.events)
