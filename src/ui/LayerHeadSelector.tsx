function Row({ count, value, onChange, label }: { count: number; value: number; onChange: (i: number) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 w-12 text-xs uppercase tracking-wide text-gray-500">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          aria-label={`${label} ${i}`}
          aria-pressed={value === i}
          onClick={() => onChange(i)}
          className={`min-h-[36px] min-w-[36px] rounded text-xs ${value === i ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'}`}
        >
          {i}
        </button>
      ))}
    </div>
  )
}

export function LayerHeadSelector({
  layers, heads, layer, head, onLayer, onHead,
}: {
  layers: number; heads: number; layer: number; head: number; onLayer: (i: number) => void; onHead: (i: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Row count={layers} value={layer} onChange={onLayer} label="layer" />
      <Row count={heads} value={head} onChange={onHead} label="head" />
    </div>
  )
}
