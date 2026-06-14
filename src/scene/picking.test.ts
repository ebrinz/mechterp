import { describe, it, expect } from 'vitest'
import { nearestPointToCursor } from './picking'

const P = [
  { id: 0, x: 10, y: 10 },
  { id: 1, x: 100, y: 100 },
  { id: 2, x: 12, y: 11 },
]

describe('nearestPointToCursor', () => {
  it('returns the nearest point within the radius', () => {
    expect(nearestPointToCursor(P, { x: 11, y: 10 }, 14)).toBe(0)
  })
  it('returns the nearest even when several are within the radius', () => {
    expect(nearestPointToCursor(P, { x: 12, y: 11 }, 14)).toBe(2)
  })
  it('returns null when all points are beyond the radius', () => {
    expect(nearestPointToCursor(P, { x: 500, y: 500 }, 14)).toBeNull()
  })
  it('returns null for empty input', () => {
    expect(nearestPointToCursor([], { x: 0, y: 0 }, 14)).toBeNull()
  })
})
