import { create } from 'zustand'

// =============================================================================
// Types
// =============================================================================

export interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: number
}

export interface SuggestionChip {
  label: string
  action: string
}

interface ChatState {
  messages: ChatMessage[]
  chips: SuggestionChip[]
  mode: 'bar' | 'panel'
  isAgentStreaming: boolean
}

type ChatMessageInput = Omit<ChatMessage, 'id'> & { id?: string }

interface ChatActions {
  addMessage: (message: ChatMessageInput) => void
  appendToLastAgent: (content: string) => void
  setChips: (chips: SuggestionChip[]) => void
  setMode: (mode: 'bar' | 'panel') => void
  setAgentStreaming: (isStreaming: boolean) => void
  clearMessages: () => void
}

// =============================================================================
// Store (NOT persisted — ephemeral chat state)
// =============================================================================

export const useChatStore = create<ChatState & ChatActions>()((set) => ({
  // State
  messages: [],
  chips: [],
  mode: 'bar',
  isAgentStreaming: false,

  // Actions
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, id: message.id || crypto.randomUUID() }],
    })),

  appendToLastAgent: (content) =>
    set((state) => {
      const last = state.messages[state.messages.length - 1]
      if (last?.role === 'agent') {
        return {
          messages: [
            ...state.messages.slice(0, -1),
            { ...last, content: last.content + content },
          ],
        }
      }
      return {
        messages: [
          ...state.messages,
          { id: crypto.randomUUID(), role: 'agent' as const, content, timestamp: Date.now() },
        ],
      }
    }),

  setChips: (chips) => set({ chips }),
  setMode: (mode) => set({ mode }),
  setAgentStreaming: (isStreaming) => set({ isAgentStreaming: isStreaming }),
  clearMessages: () => set({ messages: [], chips: [] }),
}))
