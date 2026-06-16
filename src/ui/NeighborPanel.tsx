import type { Neighbor } from '../types'
import { emotionColor } from '../scene/colors'

export function NeighborPanel({ neighbors }: { neighbors: Neighbor[] }) {
  return (
    <ul className="space-y-1.5 overflow-y-auto">
      {neighbors.map((n) => (
        <li key={n.id} className="border border-ink-700 bg-ink-850 p-2.5">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: emotionColor(n.emotion) }}
            />
            <span className="font-mono text-xs text-paper">{n.emotion}</span>
            <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-600">
              {n.distance.toFixed(3)}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-500">{n.text}</p>
        </li>
      ))}
    </ul>
  )
}
