import { describe, it, expect } from 'vitest'
import { toTokens, maskedSentence } from './tokens'

describe('tokens', () => {
  it('splits into word tokens with indices', () => {
    expect(toTokens('I am grateful')).toEqual([
      { index: 0, text: 'I', masked: false },
      { index: 1, text: 'am', masked: false },
      { index: 2, text: 'grateful', masked: false },
    ])
  })
  it('omits masked tokens from the rebuilt sentence', () => {
    const t = toTokens('I am grateful')
    t[2].masked = true
    expect(maskedSentence(t)).toBe('I am')
  })
  it('returns empty string when all masked', () => {
    const t = toTokens('hi there').map((x) => ({ ...x, masked: true }))
    expect(maskedSentence(t)).toBe('')
  })
})
