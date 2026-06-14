import type { Point } from '../types'
import { emotionColor } from '../scene/colors'

export function InspectedCard({ point, onClear }: { point: Point; onClear: () => void }) {
  return (
    <div className="mb-3 rounded-lg border border-gray-700 bg-gray-800/80 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-gray-500">inspecting</span>
        <button onClick={onClear} aria-label="clear inspection" className="-mt-1 text-gray-400 hover:text-white">
          ✕
        </button>
      </div>
      <span className="font-medium" style={{ color: emotionColor(point.emotion) }}>{point.emotion}</span>
      <p className="mt-1 text-gray-200">{point.text}</p>
    </div>
  )
}
