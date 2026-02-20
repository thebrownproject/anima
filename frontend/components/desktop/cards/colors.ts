import type { CardType } from '@/types/ws-protocol'

export type CardColor = 'yellow' | 'pink' | 'green' | 'blue' | 'white' | 'dark' | 'orange' | 'purple' | 'cream'

export const COLOR_STYLES: Record<CardColor, { bg: string; text: string; border?: string }> = {
  yellow: { bg: '#F2E8CF', text: '#2C2C2C' },
  pink:   { bg: '#FFD6E0', text: '#2C2C2C' },
  green:  { bg: '#D8F3DC', text: '#1B4332' },
  blue:   { bg: '#D7E3FC', text: '#1D3557' },
  white:  { bg: '#F8F9FA', text: '#212529' },
  cream:  { bg: '#F2E9E4', text: '#22223B' },
  dark:   { bg: '#121212', text: '#E0E0E0', border: 'rgba(255,255,255,0.10)' },
  orange: { bg: '#FFD8BE', text: '#4A2C18' },
  purple: { bg: '#E2C6FF', text: '#2E1A47' },
}

export const DEFAULT_TEMPLATE_COLORS: Record<CardType, CardColor> = {
  document: 'cream',
  metric:   'blue',
  table:    'white',
  article:  'yellow',
  data:     'green',
}

export function getCardColor(cardType: CardType, override?: string): CardColor {
  if (override && override in COLOR_STYLES) return override as CardColor
  return DEFAULT_TEMPLATE_COLORS[cardType]
}
