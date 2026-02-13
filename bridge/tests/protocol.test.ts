/**
 * Tests for WebSocket protocol type guards and message validation.
 * Covers new stack_id, context, state_sync, and expanded canvas actions.
 */

import { describe, it, expect } from 'vitest'
import {
  isCanvasUpdate,
  isMissionMessage,
  isCanvasInteraction,
  isProtocolMessage,
  isStateSyncMessage,
} from '../src/protocol.js'

function baseMsg(type: string, payload: Record<string, unknown>) {
  return {
    type,
    id: 'test-uuid-1234',
    timestamp: Date.now(),
    payload,
  }
}

describe('isCanvasUpdate — optional stack_id', () => {
  it('validates canvas_update without stack_id', () => {
    const msg = baseMsg('canvas_update', {
      command: 'create_card',
      card_id: 'card-1',
      title: 'Test',
    })
    expect(isCanvasUpdate(msg)).toBe(true)
  })

  it('validates canvas_update with stack_id', () => {
    const msg = baseMsg('canvas_update', {
      command: 'create_card',
      card_id: 'card-1',
      title: 'Test',
      stack_id: 'stack-abc',
    })
    expect(isCanvasUpdate(msg)).toBe(true)
  })

  it('rejects canvas_update with non-string stack_id', () => {
    const msg = baseMsg('canvas_update', {
      command: 'create_card',
      card_id: 'card-1',
      stack_id: 123,
    })
    expect(isCanvasUpdate(msg)).toBe(false)
  })
})

describe('isMissionMessage — optional context', () => {
  it('validates mission without context', () => {
    const msg = baseMsg('mission', { text: 'Hello agent' })
    expect(isMissionMessage(msg)).toBe(true)
  })

  it('validates mission with context.stack_id', () => {
    const msg = baseMsg('mission', {
      text: 'Hello agent',
      context: { stack_id: 'stack-abc' },
    })
    expect(isMissionMessage(msg)).toBe(true)
  })

  it('rejects mission with invalid context (missing stack_id)', () => {
    const msg = baseMsg('mission', {
      text: 'Hello agent',
      context: { bad_field: true },
    })
    expect(isMissionMessage(msg)).toBe(false)
  })

  it('rejects mission with non-object context', () => {
    const msg = baseMsg('mission', {
      text: 'Hello agent',
      context: 'not-an-object',
    })
    expect(isMissionMessage(msg)).toBe(false)
  })
})

describe('isStateSyncMessage — new message type', () => {
  const validPayload = {
    stacks: [{ id: 'stack-1', name: 'My Stack' }],
    active_stack_id: 'stack-1',
    cards: [{
      id: 'card-1',
      stack_id: 'stack-1',
      title: 'Test Card',
      blocks: [{ id: 'b1', type: 'text', content: 'hello' }],
      size: 'medium',
      position: { x: 0, y: 0 },
      z_index: 1,
    }],
    chat_history: [{ id: 'msg-1', role: 'user', content: 'Hi', timestamp: 1000 }],
  }

  it('validates well-formed state_sync message', () => {
    const msg = baseMsg('state_sync', validPayload)
    expect(isStateSyncMessage(msg)).toBe(true)
  })

  it('validates state_sync with empty arrays', () => {
    const msg = baseMsg('state_sync', {
      stacks: [],
      active_stack_id: 'stack-1',
      cards: [],
      chat_history: [],
    })
    expect(isStateSyncMessage(msg)).toBe(true)
  })

  it('rejects state_sync missing stacks', () => {
    const msg = baseMsg('state_sync', {
      active_stack_id: 'stack-1',
      cards: [],
      chat_history: [],
    })
    expect(isStateSyncMessage(msg)).toBe(false)
  })

  it('rejects state_sync missing active_stack_id', () => {
    const msg = baseMsg('state_sync', {
      stacks: [],
      cards: [],
      chat_history: [],
    })
    expect(isStateSyncMessage(msg)).toBe(false)
  })

  it('passes isProtocolMessage for state_sync', () => {
    const msg = baseMsg('state_sync', validPayload)
    expect(isProtocolMessage(msg)).toBe(true)
  })
})

describe('isCanvasInteraction — expanded actions', () => {
  const originalActions = ['edit_cell', 'resize', 'move', 'close']
  const newActions = ['archive_card', 'archive_stack', 'create_stack', 'restore_stack']

  for (const action of [...originalActions, ...newActions]) {
    it(`validates canvas_interaction with action: ${action}`, () => {
      const msg = baseMsg('canvas_interaction', {
        card_id: 'card-1',
        action,
        data: {},
      })
      expect(isCanvasInteraction(msg)).toBe(true)
    })
  }

  it('rejects invalid action', () => {
    const msg = baseMsg('canvas_interaction', {
      card_id: 'card-1',
      action: 'delete_everything',
      data: {},
    })
    expect(isCanvasInteraction(msg)).toBe(false)
  })
})
