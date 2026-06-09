import type { Neighbor, XYZ } from '../types'

const EPS = 1e-9

/** Distance-weighted centroid of neighbors' 3D positions (inverse-distance weights). */
export function placeLivePoint(neighbors: Neighbor[]): XYZ {
  if (neighbors.length === 0) return [0, 0, 0]
  let wx = 0, wy = 0, wz = 0, wsum = 0
  for (const nb of neighbors) {
    const w = 1 / (nb.distance + EPS)
    wx += w * nb.xyz[0]
    wy += w * nb.xyz[1]
    wz += w * nb.xyz[2]
    wsum += w
  }
  return [wx / wsum, wy / wsum, wz / wsum]
}
