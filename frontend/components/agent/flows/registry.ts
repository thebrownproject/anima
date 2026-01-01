// frontend/components/agent/flows/registry.ts
import type { FlowRegistration } from './types'
import type { AgentFlow, UploadFlowStep } from '../stores/agent-store'
import { uploadFlowMetadata, useUploadFlow } from './documents/upload'

/**
 * Registry of all flow types.
 * Maps flow type string to its metadata and hook.
 */
export const flowRegistry: Partial<Record<NonNullable<AgentFlow>['type'], FlowRegistration>> = {
  upload: {
    metadata: uploadFlowMetadata,
    useHook: useUploadFlow,
  } as FlowRegistration<UploadFlowStep>,
}

/**
 * Get a flow registration by type.
 * Returns undefined if flow type is not registered.
 */
export function getFlowRegistration(flowType: string): FlowRegistration | undefined {
  return flowRegistry[flowType as keyof typeof flowRegistry]
}

/**
 * Check if a flow type is registered.
 */
export function isFlowRegistered(flowType: string): boolean {
  return flowType in flowRegistry
}
