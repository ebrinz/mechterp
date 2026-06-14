export interface ProjectedPoint {
  index: number
  x: number
  y: number
}

/** Index of the projected point nearest the cursor within radiusPx, or null. */
export function nearestPointToCursor(
  projected: { index?: number; id?: number; x: number; y: number }[],
  cursor: { x: number; y: number },
  radiusPx: number,
): number | null {
  let best: number | null = null
  let bestD = Infinity
  for (const p of projected) {
    const key = (p.index ?? p.id) as number
    const dx = p.x - cursor.x
    const dy = p.y - cursor.y
    const d = dx * dx + dy * dy
    if (d < bestD) { bestD = d; best = key }
  }
  return bestD <= radiusPx * radiusPx ? best : null
}
