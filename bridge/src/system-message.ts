import { v4 as uuidv4 } from 'uuid'
import type { SystemEvent, SystemMessage } from './protocol.js'

/** Create a serialized SystemMessage. Shared by index.ts and reconnect.ts. */
export function createSystemMessage(
  event: SystemEvent,
  message?: string,
  requestId?: string,
): string {
  const msg: SystemMessage = {
    type: 'system',
    id: uuidv4(),
    timestamp: Date.now(),
    payload: { event, message },
    ...(requestId ? { request_id: requestId } : {}),
  }
  return JSON.stringify(msg)
}
