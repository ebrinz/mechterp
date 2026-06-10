import type { Token } from '../tokens/tokens'

export function TokenChips({ tokens, onToggle }: { tokens: Token[]; onToggle: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tokens.map((t) => (
        <button
          key={t.index}
          onClick={() => onToggle(t.index)}
          className={`min-h-[44px] rounded-full px-3 text-sm transition ${
            t.masked ? 'bg-gray-700 text-gray-400 line-through' : 'bg-indigo-600 text-white'
          }`}
        >
          {t.text}
        </button>
      ))}
    </div>
  )
}
