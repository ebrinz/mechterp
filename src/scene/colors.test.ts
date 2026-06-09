import { describe, it, expect } from 'vitest'
import { emotionColor, EMOTIONS } from './colors'

describe('emotionColor', () => {
  it('returns a stable hex for a known emotion', () => {
    expect(emotionColor('joy')).toMatch(/^#[0-9a-f]{6}$/i)
    expect(emotionColor('joy')).toBe(emotionColor('joy'))
  })
  it('covers all 28 GoEmotions labels', () => {
    expect(EMOTIONS.length).toBe(28)
    for (const e of EMOTIONS) expect(emotionColor(e)).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('falls back to gray for unknown', () => {
    expect(emotionColor('not-an-emotion')).toBe('#888888')
  })
})
