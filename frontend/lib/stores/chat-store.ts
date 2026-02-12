import { create } from 'zustand'

// =============================================================================
// Types
// =============================================================================

export interface ChatMessage {
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
  isTyping: boolean
  isAgentStreaming: boolean
}

interface ChatActions {
  addMessage: (message: ChatMessage) => void
  appendToLastAgent: (content: string) => void
  setChips: (chips: SuggestionChip[]) => void
  setMode: (mode: 'bar' | 'panel') => void
  setTyping: (isTyping: boolean) => void
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
  isTyping: false,
  isAgentStreaming: false,

  // Actions
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
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
          { role: 'agent' as const, content, timestamp: Date.now() },
        ],
      }
    }),

  setChips: (chips) => set({ chips }),
  setMode: (mode) => set({ mode }),
  setTyping: (isTyping) => set({ isTyping }),
  setAgentStreaming: (isStreaming) => set({ isAgentStreaming: isStreaming }),
  clearMessages: () => set({ messages: [], chips: [] }),
}))
