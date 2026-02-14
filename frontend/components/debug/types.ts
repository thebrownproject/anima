export interface DebugLogEntry {
  id: string
  timestamp: number
  direction: 'inbound' | 'outbound' | 'status'
  type: string
  summary: string
  payload: unknown
}

/** Max entries in the debug ring buffer. */
export const DEBUG_LOG_MAX = 200
