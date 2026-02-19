/**
 * WebSocket Message Protocol — Frontend Copy
 *
 * IMPORTANT: This file is a copy of bridge/src/protocol.ts (source of truth).
 * When updating message types, update bridge/src/protocol.ts FIRST, then
 * copy changes here and to sprite/src/protocol.py.
 *
 * Source of truth: bridge/src/protocol.ts
 * Python equivalent: sprite/src/protocol.py
 */

export type DocumentStatus =
  | 'processing'
  | 'ocr_complete'
  | 'completed'
  | 'failed'

// =============================================================================
// Base Message
// =============================================================================

/** Every WebSocket message must include these fields. */
export interface WebSocketMessageBase {
  type: string
  id: string              // Mandatory UUID
  timestamp: number       // Unix epoch ms
  request_id?: string     // References the request this responds to
}

// =============================================================================
// Block Types (Composable Card System — A2UI-inspired)
// =============================================================================

/** Each block has a mandatory `id` and `type`. */

export interface HeadingBlock {
  id: string
  type: 'heading'
  text: string
  subtitle?: string
}

export interface StatBlock {
  id: string
  type: 'stat'
  value: string
  label: string
  trend?: string
}

export interface KeyValuePair {
  label: string
  value: string
}

export interface KeyValueBlock {
  id: string
  type: 'key-value'
  pairs: KeyValuePair[]
}

export interface TableBlock {
  id: string
  type: 'table'
  columns: string[]
  rows: Record<string, unknown>[]
}

export type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive'

export interface BadgeBlock {
  id: string
  type: 'badge'
  text: string
  variant: BadgeVariant
}

export interface ProgressBlock {
  id: string
  type: 'progress'
  value: number
  label?: string
}

export interface TextBlock {
  id: string
  type: 'text'
  content: string  // Markdown supported
}

export interface SeparatorBlock {
  id: string
  type: 'separator'
}

/** Union of all 8 MVP block types. */
export type Block =
  | HeadingBlock
  | StatBlock
  | KeyValueBlock
  | TableBlock
  | BadgeBlock
  | ProgressBlock
  | TextBlock
  | SeparatorBlock

/** All valid block type strings. */
export const BLOCK_TYPES = [
  'heading',
  'stat',
  'key-value',
  'table',
  'badge',
  'progress',
  'text',
  'separator',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

// =============================================================================
// Browser -> Sprite Messages
// =============================================================================

/** Lightweight card snapshot sent with missions for agent context. */
export interface CanvasCardSnapshot {
  card_id: string
  title: string
  blocks: Block[]
}

/** Context sent with a mission to identify the active stack. */
export interface MissionContext {
  stack_id: string
  canvas_state?: CanvasCardSnapshot[]
}

/** User sends a mission (chat message). */
export interface MissionMessage extends WebSocketMessageBase {
  type: 'mission'
  payload: {
    text: string
    attachments?: string[]  // Document IDs to reference
    context?: MissionContext
  }
}

/** File upload (base64 encoded). */
export interface FileUploadMessage extends WebSocketMessageBase {
  type: 'file_upload'
  payload: {
    filename: string
    mime_type: string
    data: string  // Base64 encoded, max 25MB
  }
}

/** Canvas interaction (user edited a cell, moved a card, etc.). */
export type CanvasAction =
  | 'edit_cell' | 'resize' | 'move' | 'close'
  | 'archive_card' | 'archive_stack' | 'create_stack' | 'restore_stack'

export interface CanvasInteraction extends WebSocketMessageBase {
  type: 'canvas_interaction'
  payload: {
    card_id: string
    block_id?: string  // Which block the interaction targets
    action: CanvasAction
    data: unknown
  }
}

/** Auth message (sent on connect only). */
export interface AuthConnect extends WebSocketMessageBase {
  type: 'auth'
  payload: {
    token: string  // Clerk JWT, validated once
  }
}

// =============================================================================
// Sprite -> Browser Messages
// =============================================================================

/** Agent event types for streaming. */
export type AgentEventType = 'text' | 'tool' | 'complete' | 'error'

export interface AgentEventMeta {
  extractionId?: string
  sessionId?: string
}

/** Agent thinking/streaming text. */
export interface AgentEvent extends WebSocketMessageBase {
  type: 'agent_event'
  payload: {
    event_type: AgentEventType
    content: string
    meta?: AgentEventMeta
  }
}

/** Canvas commands for the composable card system. */
export type CanvasCommand = 'create_card' | 'update_card' | 'close_card'
export type CardSize = 'small' | 'medium' | 'large' | 'full'

export interface CanvasUpdate extends WebSocketMessageBase {
  type: 'canvas_update'
  payload: {
    command: CanvasCommand
    card_id: string
    title?: string
    blocks?: Block[]  // Array of composable blocks (create/update)
    size?: CardSize   // Card size hint (small/medium/large/full)
    mission_id?: string
    stack_id?: string
  }
}

/** Document status updates. */
// DocumentStatus defined at top of this file

export interface StatusUpdate extends WebSocketMessageBase {
  type: 'status'
  payload: {
    document_id: string
    status: DocumentStatus
    message?: string
  }
}

/** State sync — full workspace state sent on connect/stack-switch. */
export interface StackInfo {
  id: string
  name: string
  color?: string
}

export interface CardPosition {
  x: number
  y: number
}

export interface CardInfo {
  id: string
  stack_id: string
  title: string
  blocks: Block[]
  size: CardSize
  position: CardPosition
  z_index: number
}

export interface ChatMessageInfo {
  id: string
  role: string
  content: string
  timestamp: number
}

export interface StateSyncMessage extends WebSocketMessageBase {
  type: 'state_sync'
  payload: {
    stacks: StackInfo[]
    active_stack_id: string
    cards: CardInfo[]
    chat_history: ChatMessageInfo[]
  }
}

/** System messages (connection state, errors). */
export type SystemEvent =
  | 'connected'
  | 'sprite_waking'
  | 'sprite_ready'
  | 'reconnect_failed'
  | 'error'

export interface SystemMessage extends WebSocketMessageBase {
  type: 'system'
  payload: {
    event: SystemEvent
    message?: string
  }
}

// =============================================================================
// Union Types
// =============================================================================

/** Messages sent from Browser to Sprite (via Bridge). */
export type BrowserToSpriteMessage =
  | MissionMessage
  | FileUploadMessage
  | CanvasInteraction
  | AuthConnect

/** Messages sent from Sprite to Browser (via Bridge). */
export type SpriteToBrowserMessage =
  | AgentEvent
  | CanvasUpdate
  | StatusUpdate
  | SystemMessage
  | StateSyncMessage

/** Any valid WebSocket message in the protocol. */
export type ProtocolMessage = BrowserToSpriteMessage | SpriteToBrowserMessage

/** All valid message type strings. */
export const MESSAGE_TYPES = [
  'mission',
  'file_upload',
  'canvas_interaction',
  'auth',
  'agent_event',
  'canvas_update',
  'status',
  'system',
  'state_sync',
] as const

export type MessageType = (typeof MESSAGE_TYPES)[number]

// =============================================================================
// Type Guards — Message Validation
// =============================================================================

/**
 * Check if a value is a valid WebSocket message base (has id, timestamp, type).
 * This is the first check — all messages must pass this.
 */
export function isWebSocketMessage(value: unknown): value is WebSocketMessageBase {
  if (typeof value !== 'object' || value === null) return false
  const msg = value as Record<string, unknown>
  return (
    typeof msg.type === 'string' &&
    typeof msg.id === 'string' &&
    typeof msg.timestamp === 'number'
  )
}

/** Check if a value has a payload object. */
function hasPayload(value: unknown): value is { payload: Record<string, unknown> } {
  if (typeof value !== 'object' || value === null) return false
  const msg = value as Record<string, unknown>
  return typeof msg.payload === 'object' && msg.payload !== null
}

/** Validate a MissionMessage. */
export function isMissionMessage(value: unknown): value is MissionMessage {
  if (!isWebSocketMessage(value) || !hasPayload(value)) return false
  const msg = value as MissionMessage
  if (msg.type !== 'mission' || typeof msg.payload.text !== 'string') return false
  if (msg.payload.context !== undefined) {
    if (typeof msg.payload.context !== 'object' || msg.payload.context === null) return false
    if (typeof msg.payload.context.stack_id !== 'string') return false
  }
  return true
}

/** Validate a FileUploadMessage. */
export function isFileUploadMessage(value: unknown): value is FileUploadMessage {
  if (!isWebSocketMessage(value) || !hasPayload(value)) return false
  const msg = value as FileUploadMessage
  return (
    msg.type === 'file_upload' &&
    typeof msg.payload.filename === 'string' &&
    typeof msg.payload.mime_type === 'string' &&
    typeof msg.payload.data === 'string'
  )
}

/** Validate a CanvasInteraction. */
export function isCanvasInteraction(value: unknown): value is CanvasInteraction {
  if (!isWebSocketMessage(value) || !hasPayload(value)) return false
  const msg = value as CanvasInteraction
  const validActions: CanvasAction[] = [
    'edit_cell', 'resize', 'move', 'close',
    'archive_card', 'archive_stack', 'create_stack', 'restore_stack',
  ]
  return (
    msg.type === 'canvas_interaction' &&
    typeof msg.payload.card_id === 'string' &&
    validActions.includes(msg.payload.action)
  )
}

/** Validate an AuthConnect message. */
export function isAuthConnect(value: unknown): value is AuthConnect {
  if (!isWebSocketMessage(value) || !hasPayload(value)) return false
  const msg = value as AuthConnect
  return (
    msg.type === 'auth' &&
    typeof msg.payload.token === 'string'
  )
}

/** Validate an AgentEvent. */
export function isAgentEvent(value: unknown): value is AgentEvent {
  if (!isWebSocketMessage(value) || !hasPayload(value)) return false
  const msg = value as AgentEvent
  const validTypes: AgentEventType[] = ['text', 'tool', 'complete', 'error']
  return (
    msg.type === 'agent_event' &&
    validTypes.includes(msg.payload.event_type) &&
    typeof msg.payload.content === 'string'
  )
}

/** Validate a CanvasUpdate. */
export function isCanvasUpdate(value: unknown): value is CanvasUpdate {
  if (!isWebSocketMessage(value) || !hasPayload(value)) return false
  const msg = value as CanvasUpdate
  const validCommands: CanvasCommand[] = ['create_card', 'update_card', 'close_card']
  if (msg.type !== 'canvas_update' || !validCommands.includes(msg.payload.command)) return false
  if (typeof msg.payload.card_id !== 'string') return false
  if (msg.payload.stack_id !== undefined && typeof msg.payload.stack_id !== 'string') return false
  return true
}

/** Validate a StatusUpdate. */
export function isStatusUpdate(value: unknown): value is StatusUpdate {
  if (!isWebSocketMessage(value) || !hasPayload(value)) return false
  const msg = value as StatusUpdate
  const validStatuses: DocumentStatus[] = [
    'processing',
    'ocr_complete',
    'completed',
    'failed',
  ]
  return (
    msg.type === 'status' &&
    typeof msg.payload.document_id === 'string' &&
    validStatuses.includes(msg.payload.status)
  )
}

/** Validate a SystemMessage. */
export function isSystemMessage(value: unknown): value is SystemMessage {
  if (!isWebSocketMessage(value) || !hasPayload(value)) return false
  const msg = value as SystemMessage
  const validEvents: SystemEvent[] = [
    'connected',
    'sprite_waking',
    'sprite_ready',
    'reconnect_failed',
    'error',
  ]
  return (
    msg.type === 'system' &&
    validEvents.includes(msg.payload.event)
  )
}

/** Validate a StateSyncMessage. */
export function isStateSyncMessage(value: unknown): value is StateSyncMessage {
  if (!isWebSocketMessage(value) || !hasPayload(value)) return false
  const msg = value as StateSyncMessage
  return (
    msg.type === 'state_sync' &&
    Array.isArray(msg.payload.stacks) &&
    typeof msg.payload.active_stack_id === 'string' &&
    Array.isArray(msg.payload.cards) &&
    Array.isArray(msg.payload.chat_history)
  )
}

/** Validate any protocol message by dispatching to the correct type guard. */
export function isProtocolMessage(value: unknown): value is ProtocolMessage {
  if (!isWebSocketMessage(value)) return false
  const msg = value as WebSocketMessageBase
  switch (msg.type) {
    case 'mission':
      return isMissionMessage(value)
    case 'file_upload':
      return isFileUploadMessage(value)
    case 'canvas_interaction':
      return isCanvasInteraction(value)
    case 'auth':
      return isAuthConnect(value)
    case 'agent_event':
      return isAgentEvent(value)
    case 'canvas_update':
      return isCanvasUpdate(value)
    case 'status':
      return isStatusUpdate(value)
    case 'system':
      return isSystemMessage(value)
    case 'state_sync':
      return isStateSyncMessage(value)
    default:
      return false
  }
}

// =============================================================================
// Block Type Guards
// =============================================================================

/** Check if a value is a valid Block (has id and valid type). */
export function isBlock(value: unknown): value is Block {
  if (typeof value !== 'object' || value === null) return false
  const block = value as Record<string, unknown>
  if (typeof block.id !== 'string' || typeof block.type !== 'string') return false
  return (BLOCK_TYPES as readonly string[]).includes(block.type)
}

/** Validate an array of blocks. */
export function isBlockArray(value: unknown): value is Block[] {
  if (!Array.isArray(value)) return false
  return value.every(isBlock)
}

// =============================================================================
// Utility: Parse raw WebSocket data
// =============================================================================

/**
 * Parse a raw WebSocket message string into a typed ProtocolMessage.
 * Returns null if parsing fails or the message is invalid.
 */
export function parseMessage(data: string): ProtocolMessage | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (isProtocolMessage(parsed)) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}
