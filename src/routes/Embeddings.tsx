import { useEffect, useMemo, useRef, useState } from 'react'
import { Embedder } from '../embedder/embedder'
import { VectorStore } from '../vectorStore/vectorStore'
import { placeLivePoint } from '../placement/placement'
import { toTokens, maskedSentence, type Token } from '../tokens/tokens'
import { Scene } from '../scene/Scene'
import { TokenChips } from '../ui/TokenChips'
import { NeighborPanel } from '../ui/NeighborPanel'
import { Legend } from '../ui/Legend'
import { BottomSheet } from '../ui/BottomSheet'
import { ConceptNote } from '../ui/ConceptNote'
import { InspectedCard } from '../ui/InspectedCard'
import type { Neighbor, Point, XYZ } from '../types'

const K = 8

export default function Embeddings() {
  const [embedder, setEmbedder] = useState<Embedder | null>(null)
  const [store, setStore] = useState<Awaited<ReturnType<typeof VectorStore.fromUrl>> | null>(null)
  const [modelMsg, setModelMsg] = useState('Loading model…')
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [neighbors, setNeighbors] = useState<Neighbor[]>([])
  const [live, setLive] = useState<XYZ | null>(null)
  const [trail, setTrail] = useState<XYZ[]>([])
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  // Load data and model INDEPENDENTLY so the cloud renders as soon as the reference DB is
  // ready (the model can keep loading), and so a failure in either surfaces an error instead
  // of an eternal spinner.
  useEffect(() => {
    let alive = true
    VectorStore.fromUrl('/emotions.sqlite')
      .then((s) => { if (alive) setStore(s) })
      .catch((e) => { if (alive) setError(`Failed to load data: ${e?.message ?? e}`) })
    Embedder.create((p) => { if (alive && p.progress) setModelMsg(`Loading model… ${Math.round(p.progress)}%`) })
      .then((e) => { if (alive) { setEmbedder(e); setModelMsg('') } })
      .catch((e) => { if (alive) setError(`Failed to load model: ${e?.message ?? e}`) })
    return () => { alive = false }
  }, [])

  const points: Point[] = useMemo(() => store?.all() ?? [], [store])
  const centroids = useMemo(() => store?.centroids() ?? [], [store])

  const recompute = useRef(async (_toks: Token[]) => {})
  recompute.current = async (toks: Token[]) => {
    if (!embedder || !store) return
    const sentence = maskedSentence(toks)
    if (!sentence) { setLive(null); setNeighbors([]); setFocusedIndex(null); return }
    const { vector } = await embedder.embed(sentence)
    const nbrs = store.knn(vector, K)
    const xyz = placeLivePoint(nbrs)
    setFocusedIndex(null)
    setNeighbors(nbrs)
    setLive(xyz)
    setTrail((t) => [...t.slice(-40), xyz])
  }

  const onText = (text: string) => {
    const toks = toTokens(text)
    setTokens(toks)
    void recompute.current(toks)
  }
  const onToggle = (i: number) => {
    setTokens((prev) => {
      const next = prev.map((t) => (t.index === i ? { ...t, masked: !t.masked } : t))
      void recompute.current(next)
      return next
    })
  }
  const onPickPoint = (index: number | null) => {
    if (index == null || !store) { setFocusedIndex(null); void recompute.current(tokens); return }
    const p = points[index]
    if (!p) return
    setFocusedIndex(index)
    setNeighbors(store.knn(p.vec, K))
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-ink-900 text-paper md:flex-row">
      <div className="relative min-w-0 flex-1">
        <Scene points={points} centroids={centroids} live={live} trail={trail} focusedIndex={focusedIndex} onPickPoint={onPickPoint} />
        {/* survey readout overlay, top-left of the plot */}
        <div className="pointer-events-none absolute left-3 top-3 hidden md:block">
          <span className="readout text-brass/70">stage 01 · embedding survey</span>
        </div>
        {(error || !store) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-950/70 p-6 text-center backdrop-blur-sm">
            {error ? (
              <>
                <span className="readout text-red-400">err</span>
                <p className="font-mono text-sm text-red-200">{error}</p>
                <p className="max-w-sm font-mono text-[11px] leading-relaxed text-ink-400">
                  Check the browser console. If you're running a dev server, restart it so the
                  data and wasm assets are served.
                </p>
              </>
            ) : (
              <>
                <span className="readout animate-fade-in">plotting reference survey…</span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="md:w-96 md:shrink-0">
        <BottomSheet>
          <ConceptNote>
            <p>
              Each dot is a real sentence from <span className="text-brass">GoEmotions</span>, embedded by
              all-MiniLM-L6-v2 into a 384-dimensional vector and projected to 3-D with{' '}
              <span className="text-brass">UMAP</span>. Nearby dots mean similar meaning; the large labelled
              dots are per-emotion <span className="text-brass">centroids</span> — the average spot for each
              emotion.
            </p>
            <p>
              Type a sentence and it's embedded the same way, then placed among its nearest neighbors. Mask a
              word (tap a chip) and the point <span className="text-brass">drifts</span> — how far it moves is
              how much that word mattered. That drift is saliency.
            </p>
            <p>
              Notice how messy it is: emotions don't form clean clusters. all-MiniLM encodes topic more strongly
              than feeling, and that overlap is the lesson — Stage&nbsp;2 opens the model to show why.
            </p>
          </ConceptNote>
          <div className="mt-3" />
          <span className="readout mb-1.5 block">input</span>
          <input
            placeholder={embedder ? 'Type a sentence to chart where it lands…' : 'Calibrating model…'}
            disabled={!embedder}
            onChange={(e) => onText(e.target.value)}
            className="w-full border border-ink-700 bg-ink-850 px-3 py-2.5 font-mono text-sm text-paper outline-none transition-colors placeholder:text-ink-500 focus:border-brass/60 disabled:opacity-60"
          />
          {!embedder && !error && <p className="mt-1.5 font-mono text-[11px] text-ink-400">{modelMsg}</p>}
          <div className="mt-3" />
          <TokenChips tokens={tokens} onToggle={onToggle} />
          <div className="rule-tick my-4" />
          {focusedIndex != null && points[focusedIndex] && (
            <InspectedCard point={points[focusedIndex]} onClear={() => onPickPoint(null)} />
          )}
          {neighbors.length > 0 && <span className="readout mb-2 block">nearest neighbors</span>}
          <NeighborPanel neighbors={neighbors} />
          <div className="rule-tick my-4" />
          <span className="readout mb-2 block">emotion index</span>
          <Legend />
        </BottomSheet>
      </div>
    </div>
  )
}
