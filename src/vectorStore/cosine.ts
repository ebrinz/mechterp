import type { Point, Neighbor, Vec384 } from '../types'

/** Cosine distance in [0, 2]. Assumes inputs may not be normalized. */
export function cosineDistance(a: Vec384, b: Vec384): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1e-12
  return 1 - dot / denom
}

export function bruteForceKnn(query: Vec384, points: Point[], k: number): Neighbor[] {
  return points
    .map(p => ({ id: p.id, text: p.text, emotion: p.emotion, xyz: p.xyz, distance: cosineDistance(query, p.vec) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k)
}
