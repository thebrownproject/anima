import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'

// Mock performance.now for throttle testing
let mockNow = 0
vi.spyOn(performance, 'now').mockImplementation(() => mockNow)

import { VoiceBars } from '../voice-bars'

describe('VoiceBars', () => {
  beforeEach(() => {
    mockNow = 0
    vi.clearAllMocks()
  })

  it('renders 4 bar divs', () => {
    const { container } = render(<VoiceBars analyser={null} />)
    const barDivs = container.querySelectorAll('.rounded-full')
    expect(barDivs).toHaveLength(4)
  })

  it('bars have no transition-[height] class', () => {
    const { container } = render(<VoiceBars analyser={null} />)
    const barDivs = container.querySelectorAll('.rounded-full')
    barDivs.forEach((bar) => {
      expect(bar.className).not.toContain('transition-[height]')
      expect(bar.className).not.toContain('duration-75')
    })
  })

  it('renders at min height when analyser is null', () => {
    const { container } = render(<VoiceBars analyser={null} />)
    const barDivs = container.querySelectorAll('.rounded-full')
    barDivs.forEach((bar) => {
      expect((bar as HTMLElement).style.height).toBe('3px')
    })
  })
})
