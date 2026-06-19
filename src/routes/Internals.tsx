import { useEffect, useMemo, useRef, useState } from 'react'
import { AttentionModel, type AnalyzeResult } from '../attention/attentionModel'
import { sliceAttention } from '../attention/slice'
import { LayerHeadSelector } from '../ui/LayerHeadSelector'
import { AttentionHeatmap } from '../ui/AttentionHeatmap'
import { ConceptNote } from '../ui/ConceptNote'

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
    <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
      <header className="shrink-0">
        <span className="readout text-brass">stage 02 · self-attention</span>
        <h1 className="mt-1 font-display text-2xl font-medium text-paper">Attention Field</h1>
        <p className="mt-1.5 max-w-prose font-mono text-[13px] leading-relaxed text-paper/70">
          Read the model's real self-attention — which tokens reach for which, head by head, layer by layer.
        </p>
      </header>

      {error ? (
        <div className="plate flex items-start gap-3 border-red-500/40 bg-red-500/5 p-4">
          <span className="readout mt-0.5 text-red-400">err</span>
          <p className="font-mono text-sm text-red-200">{error}</p>
        </div>
      ) : (
        <>
          <ConceptNote>
            <p>
              Before all-MiniLM turns a sentence into an embedding, every token mixes in information
              from the others — <span className="text-brass">attention</span> decides how much. Each cell
              (row <span className="text-brass">i</span> → column <span className="text-brass">j</span>)
              is how strongly token <em>i</em> pulls from token <em>j</em>. Brighter is stronger, and every
              row sums to ~1.
            </p>
            <p>
              A <span className="text-brass">head</span> is one independent attention pattern. This model has
              6 layers × 12 heads = 72 of them, each learning a different relationship — a word leaning on the
              next, or every token attending to <code className="text-paper">[CLS]</code> /{' '}
              <code className="text-paper">[SEP]</code>. Switch layer &amp; head to compare.
            </p>
            <p>
              <code className="text-paper">[CLS]</code> and <code className="text-paper">[SEP]</code> mark the
              start and end of the sentence. The <code className="text-paper">[CLS]</code> vector is what becomes
              the sentence embedding you explored in Stage&nbsp;1 — so these patterns are literally how that
              point gets built.
            </p>
          </ConceptNote>

          <input
            placeholder={model ? 'Type a sentence to chart its attention…' : 'Calibrating attention model…'}
            disabled={!model}
            onChange={(e) => void run.current(e.target.value)}
            className="w-full shrink-0 border border-ink-700 bg-ink-850 px-3 py-2.5 font-mono text-sm text-paper outline-none transition-colors placeholder:text-ink-500 focus:border-brass/60 disabled:opacity-60"
          />

          {result ? (
            <div className="flex flex-col gap-3">
              <LayerHeadSelector
                layers={result.dims.layers}
                heads={result.dims.heads}
                layer={layer}
                head={head}
                onLayer={setLayer}
                onHead={setHead}
              />
              <div className="flex items-center gap-2 readout text-ink-400">
                <span className="h-1.5 w-1.5 rounded-full bg-brass" />
                layer {layer} · head {head} · {result.tokens.length} tokens
              </div>
              <div className="plate max-h-[62vh] overflow-auto p-2">
                {matrix && <AttentionHeatmap tokens={result.tokens} matrix={matrix} />}
              </div>
            </div>
          ) : (
            <div className="plate flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="readout text-ink-400">{model ? 'awaiting input' : 'standby'}</span>
              <p className="max-w-xs font-mono text-xs text-ink-400">
                {model
                  ? 'Type a sentence above to render its attention field.'
                  : 'Loading the model from cache — first visit downloads ~23 MB.'}
              </p>
            </div>
          )}
        </>
      )}
    </main>
  )
}
