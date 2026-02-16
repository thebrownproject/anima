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
import { isVoiceEnabled } from '@/lib/voice-config'

interface VoiceContextValue {
  startVoice: () => Promise<void>
  stopRecordingOnly: () => void
  stopRecordingForSend: () => void
  interruptTTS: () => void
  analyser: AnalyserNode | null
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
  const { startListening, stopListening, analyser } = useSTT()
  const { speak, interrupt, isSpeaking } = useTTS()
  const { status } = useWebSocket()

  const prevStreamingRef = useRef(false)
  const prevSpeakingRef = useRef(false)
  const voiceSessionRef = useRef(false)
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const SPEAKING_DISPLAY_MS = 10_000 // visual speaking duration when TTS is off

  const startVoice = useCallback(async () => {
    voiceSessionRef.current = true
    useVoiceStore.getState().clearTranscript()
    useVoiceStore.getState().setPersonaState('connecting')
    await startListening(() => useVoiceStore.getState().setPersonaState('listening'))
  }, [startListening])

  const stopRecordingOnly = useCallback(() => {
    stopListening()
    voiceSessionRef.current = false
    useVoiceStore.getState().setPersonaState('idle')
  }, [stopListening])

  // Stop STT but keep voiceSessionRef alive so TTS fires after agent responds
  const stopRecordingForSend = useCallback(() => {
    stopListening()
  }, [stopListening])

  const interruptTTS = useCallback(() => {
    interrupt()
    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current)
      speakingTimerRef.current = null
    }
    useVoiceStore.getState().setPersonaState('idle')
  }, [interrupt])

  // Agent completion: isAgentStreaming true->false triggers TTS
  const isAgentStreaming = useChatStore((s) => s.isAgentStreaming)

  useEffect(() => {
    if (prevStreamingRef.current && !isAgentStreaming) {
      const { ttsEnabled, personaState, setPersonaState } = useVoiceStore.getState()
      if (ttsEnabled) {
        // Speaker is on — play TTS for all agent responses
        const messages = useChatStore.getState().messages
        const last = messages[messages.length - 1]
        if (last?.role === 'agent' && last.content) {
          setPersonaState('speaking')
          speak(last.content)
        }
      } else if (personaState === 'thinking') {
        voiceSessionRef.current = false
        // Visual speaking animation (no TTS) — show for a few seconds then idle
        setPersonaState('speaking')
        if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current)
        speakingTimerRef.current = setTimeout(() => {
          if (useVoiceStore.getState().personaState === 'speaking') {
            useVoiceStore.getState().setPersonaState('idle')
          }
        }, SPEAKING_DISPLAY_MS)
      }
    }
    prevStreamingRef.current = isAgentStreaming
  }, [isAgentStreaming, speak])

  // WS status -> personaState sync
  useEffect(() => {
    if (status !== 'connected') {
      stopListening()
      voiceSessionRef.current = false
      useVoiceStore.getState().setPersonaState('asleep')
    } else if (useVoiceStore.getState().personaState === 'asleep') {
      useVoiceStore.getState().setPersonaState('idle')
    }
  }, [status, stopListening])

  // Real TTS finished: isSpeaking true->false + personaState 'speaking' -> idle
  useEffect(() => {
    if (prevSpeakingRef.current && !isSpeaking && useVoiceStore.getState().personaState === 'speaking') {
      if (speakingTimerRef.current) {
        clearTimeout(speakingTimerRef.current)
        speakingTimerRef.current = null
      }
      voiceSessionRef.current = false
      useVoiceStore.getState().setPersonaState('idle')
    }
    prevSpeakingRef.current = isSpeaking
  }, [isSpeaking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening()
      interrupt()
      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current)
    }
  }, [stopListening, interrupt])

  return (
    <VoiceContext.Provider value={{ startVoice, stopRecordingOnly, stopRecordingForSend, interruptTTS, analyser }}>
      {children}
    </VoiceContext.Provider>
  )
}

export function MaybeVoiceProvider({ children }: { children: ReactNode }) {
  if (!isVoiceEnabled()) return <>{children}</>
  return <VoiceProvider>{children}</VoiceProvider>
}
