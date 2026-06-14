import { useEffect, useMemo, useRef, useState } from 'react'
import { AttentionModel, type AnalyzeResult } from '../attention/attentionModel'
import { sliceAttention } from '../attention/slice'
import { LayerHeadSelector } from '../ui/LayerHeadSelector'
import { AttentionHeatmap } from '../ui/AttentionHeatmap'

export function Internals() {
  const [model, setModel] = useState<AttentionModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [layer, setLayer] = useState(0)
  const [head, setHead] = useState(0)

  useEffect(() => {
    let alive = true
    AttentionModel.create()
      .then((m) => { if (alive) setModel(m) })
      .catch((e) => { if (alive) setError(`Failed to load attention model: ${e?.message ?? e}`) })
    return () => { alive = false }
  }, [])

  const run = useRef(async (_t: string) => {})
  run.current = async (text: string) => {
    if (!model || !text.trim()) { setResult(null); return }
    try { setResult(await model.analyze(text)) }
    catch (e: any) { setError(`Analysis failed: ${e?.message ?? e}`) }
  }

  const matrix = useMemo(
    () => (result ? sliceAttention(result.data, result.dims, layer, head) : null),
    [result, layer, head],
  )

  return (
    <main className="flex flex-1 flex-col gap-4 overflow-y-auto bg-gray-950 p-4 text-gray-100">
      <div>
        <h1 className="text-lg font-semibold">Stage 2 · Attention</h1>
        <p className="text-xs text-gray-400">
          Type a sentence to see which tokens attend to which, read from the model's real internals.
          Each row sums to ~1 (a token distributes its attention across all tokens).
        </p>
      </div>
      {error ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      ) : (
        <>
          <input
            placeholder={model ? 'Type a sentence to see its attention…' : 'Loading attention model…'}
            disabled={!model}
            onChange={(e) => void run.current(e.target.value)}
            className="w-full rounded bg-gray-800 p-2 text-sm outline-none"
          />
          {result && (
            <>
              <LayerHeadSelector
                layers={result.dims.layers}
                heads={result.dims.heads}
                layer={layer}
                head={head}
                onLayer={setLayer}
                onHead={setHead}
              />
              {matrix && <AttentionHeatmap tokens={result.tokens} matrix={matrix} />}
            </>
          )}
        </>
      )}
    </main>
  )
}
