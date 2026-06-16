import type { Point } from '../types'
import { emotionColor } from '../scene/colors'

export function InspectedCard({ point, onClear }: { point: Point; onClear: () => void }) {
  return (
    <div className="plate mb-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="readout text-brass/80">inspecting</span>
        <button
          onClick={onClear}
          aria-label="clear inspection"
          className="-mt-1 font-mono text-ink-600 transition-colors hover:text-brass"
        >
          ✕
        </button>
      </div>
      <span className="font-mono text-sm font-medium" style={{ color: emotionColor(point.emotion) }}>
        {point.emotion}
      </span>
      <p className="mt-1 font-mono text-[12px] leading-relaxed text-paper/85">{point.text}</p>
    </div>
  )
}
