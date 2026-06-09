import { describe, it, expect } from 'vitest'
import { cosineDistance, bruteForceKnn } from './cosine'
import type { Point } from '../types'

const v = (arr: number[]) => Float32Array.from(arr)
const pt = (id: number, vec: number[]): Point =>
  ({ id, text: `p${id}`, emotion: 'x', xyz: [0, 0, 0], vec: v(vec) })

describe('cosineDistance', () => {
  it('is 0 for identical normalized vectors', () => {
    expect(cosineDistance(v([1, 0]), v([1, 0]))).toBeCloseTo(0, 6)
  })
  it('is 1 for orthogonal vectors', () => {
    expect(cosineDistance(v([1, 0]), v([0, 1]))).toBeCloseTo(1, 6)
  })
})

describe('bruteForceKnn', () => {
  const points = [pt(1, [1, 0]), pt(2, [0, 1]), pt(3, [0.9, 0.1])]
  it('returns k nearest sorted by ascending distance', () => {
    const res = bruteForceKnn(v([1, 0]), points, 2)
    expect(res.map(r => r.id)).toEqual([1, 3])
    expect(res[0].distance).toBeLessThanOrEqual(res[1].distance)
  })
})
