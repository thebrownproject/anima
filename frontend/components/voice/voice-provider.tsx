'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { useSTT } from './use-stt'
import { useTTS } from './use-tts'
import { useVoiceStore } from '@/lib/stores/voice-store'
import { useChatStore } from '@/lib/stores/chat-store'
import { useWebSocket } from '@/components/desktop/ws-provider'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import { isVoiceEnabled } from '@/lib/voice-config'

interface VoiceContextValue {
  startVoice: () => Promise<void>
  stopVoice: () => Promise<void>
  interruptTTS: () => void
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext)
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider')
  return ctx
}

export function useVoiceMaybe(): VoiceContextValue | null {
  return useContext(VoiceContext)
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { startListening, stopListening } = useSTT()
  const { speak, interrupt, isSpeaking } = useTTS()
  const { status, send } = useWebSocket()

  const prevStreamingRef = useRef(false)

  const startVoice = useCallback(async () => {
    useVoiceStore.getState().setPersonaState('listening')
    await startListening()
  }, [startListening])

  const stopVoice = useCallback(async () => {
    stopListening()
    const { transcript, clearTranscript, setPersonaState } = useVoiceStore.getState()

    if (transcript.trim()) {
      const activeStackId = useDesktopStore.getState().activeStackId
      useChatStore.getState().addMessage({ role: 'user', content: transcript, timestamp: Date.now() })
      send({ type: 'mission', payload: { text: transcript, context: { stack_id: activeStackId } } })
    }

    clearTranscript()
    setPersonaState('thinking')
  }, [stopListening, send])

  const interruptTTS = useCallback(() => {
    interrupt()
    useVoiceStore.getState().setPersonaState('idle')
  }, [interrupt])

  // Agent completion: isAgentStreaming true->false triggers TTS
  const isAgentStreaming = useChatStore((s) => s.isAgentStreaming)

  useEffect(() => {
    if (prevStreamingRef.current && !isAgentStreaming) {
      const { ttsEnabled, personaState, setPersonaState } = useVoiceStore.getState()
      if (ttsEnabled) {
        const messages = useChatStore.getState().messages
        const last = messages[messages.length - 1]
        if (last?.role === 'agent' && last.content) {
          setPersonaState('speaking')
          speak(last.content)
        }
      } else if (personaState === 'thinking') {
        setPersonaState('idle')
      }
    }
    prevStreamingRef.current = isAgentStreaming
  }, [isAgentStreaming, speak])

  // WS status -> personaState sync
  useEffect(() => {
    if (status !== 'connected') {
      useVoiceStore.getState().setPersonaState('asleep')
    } else if (useVoiceStore.getState().personaState === 'asleep') {
      useVoiceStore.getState().setPersonaState('idle')
    }
  }, [status])

  // isSpeaking false + personaState 'speaking' -> idle
  useEffect(() => {
    if (!isSpeaking && useVoiceStore.getState().personaState === 'speaking') {
      useVoiceStore.getState().setPersonaState('idle')
    }
  }, [isSpeaking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening()
      interrupt()
    }
  }, [stopListening, interrupt])

  return (
    <VoiceContext.Provider value={{ startVoice, stopVoice, interruptTTS }}>
      {children}
    </VoiceContext.Provider>
  )
}

export function MaybeVoiceProvider({ children }: { children: ReactNode }) {
  if (!isVoiceEnabled()) return <>{children}</>
  return <VoiceProvider>{children}</VoiceProvider>
}
