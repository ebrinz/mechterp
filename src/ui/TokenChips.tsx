import type { Token } from '../tokens/tokens'

export function TokenChips({ tokens, onToggle }: { tokens: Token[]; onToggle: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tokens.map((t) => (
        <button
          key={t.index}
          onClick={() => onToggle(t.index)}
          aria-pressed={!t.masked}
          className={`min-h-[44px] border px-3 font-mono text-sm transition-colors ${
            t.masked
              ? 'border-ink-700 bg-transparent text-ink-600 line-through'
              : 'border-brass/40 bg-brass/10 text-paper hover:border-brass'
          }`}
        >
          {t.text}
        </button>
      ))}
    </div>
  )
}
