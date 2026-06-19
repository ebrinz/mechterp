function ChannelRow({
  count,
  value,
  onChange,
  label,
}: {
  count: number
  value: number
  onChange: (i: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="readout w-9 shrink-0">{label}</span>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {Array.from({ length: count }, (_, i) => {
          const active = value === i
          return (
            <button
              key={i}
              aria-label={`${label} ${i}`}
              aria-pressed={active}
              onClick={() => onChange(i)}
              className={`flex h-9 min-w-[34px] shrink-0 items-center justify-center border font-mono text-xs tabular-nums transition-colors ${
                active
                  ? 'border-brass bg-brass text-ink-950 shadow-[0_0_12px_-2px] shadow-brass/50'
                  : 'border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-500 hover:text-paper'
              }`}
            >
              {i}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function LayerHeadSelector({
  layers,
  heads,
  layer,
  head,
  onLayer,
  onHead,
}: {
  layers: number
  heads: number
  layer: number
  head: number
  onLayer: (i: number) => void
  onHead: (i: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <ChannelRow count={layers} value={layer} onChange={onLayer} label="layer" />
      <ChannelRow count={heads} value={head} onChange={onHead} label="head" />
    </div>
  )
}
