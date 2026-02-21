import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore, type ChatMessage } from '../chat-store'

function makeMessage(overrides: Partial<ChatMessage> & { id: string }): ChatMessage {
  return {
    role: 'user',
    content: `Message ${overrides.id}`,
    timestamp: 1000,
    ...overrides,
  }
}

describe('chat-store mergeMessages', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], chips: [], isAgentStreaming: false })
  })

  it('replaces messages with server state when no local messages are newer', () => {
    const local = [makeMessage({ id: 'a', timestamp: 500 })]
    useChatStore.setState({ messages: local })

    const server = [
      makeMessage({ id: 'a', content: 'updated', timestamp: 500 }),
      makeMessage({ id: 'b', timestamp: 600 }),
    ]
    useChatStore.getState().mergeMessages(server, 1000)

    const result = useChatStore.getState().messages
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('updated')
    expect(result[1].id).toBe('b')
  })

  it('preserves local optimistic messages newer than sync timestamp', () => {
    const local = [
      makeMessage({ id: 'a', timestamp: 500 }),
      makeMessage({ id: 'optimistic', content: 'just typed', timestamp: 1100 }),
    ]
    useChatStore.setState({ messages: local })

    const server = [makeMessage({ id: 'a', timestamp: 500 })]
    useChatStore.getState().mergeMessages(server, 1000)

    const result = useChatStore.getState().messages
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('a')
    expect(result[1].id).toBe('optimistic')
    expect(result[1].content).toBe('just typed')
  })

  it('deduplicates by message id when local message matches server', () => {
    const local = [
      makeMessage({ id: 'a', timestamp: 1100 }),
    ]
    useChatStore.setState({ messages: local })

    // Server also has 'a' -- local newer version should not create duplicate
    const server = [makeMessage({ id: 'a', content: 'server version', timestamp: 900 })]
    useChatStore.getState().mergeMessages(server, 1000)

    const result = useChatStore.getState().messages
    // 'a' is in server AND local (newer), but dedup by id means only server version kept
    // because the local one has the same id as server
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('clears chips on merge', () => {
    useChatStore.setState({ chips: [{ label: 'test', action: 'test' }] })

    useChatStore.getState().mergeMessages([], 1000)

    expect(useChatStore.getState().chips).toEqual([])
  })
})
