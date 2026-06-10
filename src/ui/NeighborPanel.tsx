import type { Neighbor } from '../types'
import { emotionColor } from '../scene/colors'

export function NeighborPanel({ neighbors }: { neighbors: Neighbor[] }) {
  return (
    <ul className="space-y-2 overflow-y-auto">
      {neighbors.map((n) => (
        <li key={n.id} className="rounded bg-gray-800 p-2 text-sm">
          <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                style={{ backgroundColor: emotionColor(n.emotion) }} />
          <span className="font-medium">{n.emotion}</span>
          <span className="ml-2 text-gray-400">({n.distance.toFixed(3)})</span>
          <p className="mt-1 text-gray-300">{n.text}</p>
        </li>
      ))}
    </ul>
  )
}
