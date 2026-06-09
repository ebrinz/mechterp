import { describe, it, expect } from 'vitest'
import { placeLivePoint } from './placement'
import type { Neighbor } from '../types'

const n = (xyz: [number, number, number], distance: number): Neighbor =>
  ({ id: 0, text: '', emotion: '', xyz, distance })

describe('placeLivePoint', () => {
  it('returns the single neighbor position when k=1', () => {
    expect(placeLivePoint([n([1, 2, 3], 0.4)])).toEqual([1, 2, 3])
  })

  it('weights closer neighbors more (inverse distance)', () => {
    // neighbor A at x=0 dist 0.1 (weight 10), B at x=10 dist 1.0 (weight 1) -> ~0.909
    const [x] = placeLivePoint([n([0, 0, 0], 0.1), n([10, 0, 0], 1.0)])
    expect(x).toBeCloseTo(10 / 11, 5)
  })

  it('handles a zero distance without dividing by zero', () => {
    const [x] = placeLivePoint([n([5, 0, 0], 0), n([10, 0, 0], 1.0)])
    expect(x).toBeCloseTo(5, 5)  // exact match dominates
  })

  it('returns origin for empty neighbors', () => {
    expect(placeLivePoint([])).toEqual([0, 0, 0])
  })
})
