import { EMOTIONS, emotionColor } from '../scene/colors'

export function Legend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {EMOTIONS.map((e) => (
        <span key={e} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: emotionColor(e) }} />
          {e}
        </span>
      ))}
    </div>
  )
}
