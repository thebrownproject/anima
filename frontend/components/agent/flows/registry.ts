// frontend/components/agent/flows/registry.ts
import type { FlowRegistration } from './types'
import type { AgentFlow } from '../stores/agent-store'

/**
 * Registry of all flow types.
 * Maps flow type string to its metadata and hook.
 *
 * Add new flows here as they're implemented.
 */
export const flowRegistry: Partial<Record<NonNullable<AgentFlow>['type'], FlowRegistration>> = {
  // Flows will be registered here as they're migrated/created
  // Example:
  // upload: {
  //   metadata: uploadFlowMetadata,
  //   useHook: useUploadFlow,
  // },
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
