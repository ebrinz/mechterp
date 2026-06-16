import { EMOTIONS, emotionColor } from '../scene/colors'

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 font-mono text-[10px] text-ink-500">
      {EMOTIONS.map((e) => (
        <span key={e} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: emotionColor(e) }} />
          {e}
        </span>
      ))}
    </div>
  )
}
