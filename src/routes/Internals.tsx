import { Link } from 'react-router-dom'

/** Decorative 8x8 "attention grid" placeholder (pure CSS, scales on mobile). */
function AttentionGridMock() {
  const cells = Array.from({ length: 64 }, (_, i) => {
    const r = Math.floor(i / 8), c = i % 8
    // a soft diagonal + a couple of "heads" attending to token 0, just for flavor
    const v = Math.max(0, 1 - Math.abs(r - c) / 3) * 0.7 + (c === 0 ? 0.25 : 0)
    return Math.min(1, v)
  })
  return (
    <div className="grid w-full max-w-[260px] grid-cols-8 gap-[2px] rounded-lg border border-gray-800 p-2">
      {cells.map((v, i) => (
        <div key={i} className="aspect-square rounded-[2px]" style={{ backgroundColor: `rgba(129,140,248,${v.toFixed(2)})` }} />
      ))}
    </div>
  )
}

export function Internals() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto bg-gray-950 p-6 text-center text-gray-100">
      <div className="max-w-xl">
        <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
          coming soon
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Stage 2 · Internals</h1>
        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          Where we crack the model open. Type a sentence and see its <strong className="text-gray-200">attention
          patterns</strong> — which tokens attend to which, across all 6 layers and 12 heads — plus the
          <strong className="text-gray-200"> layer trajectory</strong> of how its representation forms with depth.
          Read straight from the model's exposed internals.
        </p>
      </div>
      <AttentionGridMock />
      <Link to="/embeddings" className="text-sm text-gray-400 underline hover:text-gray-200">
        ← Back to Stage 1
      </Link>
    </main>
  )
}
