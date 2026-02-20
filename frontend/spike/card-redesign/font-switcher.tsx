'use client'

import { useEffect } from 'react'
import { create } from 'zustand'

const FONT_OPTIONS = [
  { key: 'dm-sans', label: 'DM Sans', css: 'var(--font-dm-sans), sans-serif' },
  { key: 'plus-jakarta', label: 'Plus Jakarta', css: 'var(--font-plus-jakarta), sans-serif' },
  { key: 'general-sans', label: 'General Sans', css: '"General Sans", sans-serif' },
  { key: 'system', label: 'System (Geist)', css: 'var(--font-geist-sans), sans-serif' },
] as const

const STORAGE_KEY = 'stackdocs:spike-font'

export type SpikeFont = (typeof FONT_OPTIONS)[number]['key']

const useSpikeFontStore = create<{
  font: SpikeFont
  setFont: (f: SpikeFont) => void
}>((set) => ({
  font: 'dm-sans',
  setFont: (f) => {
    localStorage.setItem(STORAGE_KEY, f)
    set({ font: f })
  },
}))

export function useSpikeFont() {
  const { font, setFont } = useSpikeFontStore()
  const css = FONT_OPTIONS.find((o) => o.key === font)?.css ?? FONT_OPTIONS[0].css

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SpikeFont | null
    if (saved && saved !== font) setFont(saved)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { font, setFont, fontFamily: css }
}

export function FontSwitcher() {
  const { font, setFont } = useSpikeFont()

  return (
    <div className="fixed bottom-20 right-4 z-[9999] flex gap-1 rounded-xl bg-black/80 p-1.5 shadow-2xl backdrop-blur-sm">
      {FONT_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => setFont(opt.key)}
          className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            font === opt.key
              ? 'bg-white text-black'
              : 'text-white/70 hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
