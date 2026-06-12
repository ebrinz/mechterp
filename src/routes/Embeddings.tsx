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
    if (!sentence) { setLive(null); setNeighbors([]); return }
    const { vector } = await embedder.embed(sentence)
    const nbrs = store.knn(vector, K)
    const xyz = placeLivePoint(nbrs)
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

  return (
    <div className="flex h-full flex-1 flex-col bg-gray-950 text-gray-100 md:flex-row">
      <div className="relative flex-1">
        <Scene points={points} centroids={centroids} live={live} trail={trail} />
        {(error || !store) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 p-6 text-center">
            {error ? (
              <>
                <p className="text-red-300">{error}</p>
                <p className="max-w-sm text-xs text-gray-400">
                  Check the browser console. If you're running a dev server, restart it so the
                  data and wasm assets are served.
                </p>
              </>
            ) : (
              <p>Loading reference cloud…</p>
            )}
          </div>
        )}
      </div>
      <div className="md:w-96">
        <BottomSheet>
          <input
            placeholder={embedder ? 'Type a sentence to see where it lands…' : 'Loading model…'}
            disabled={!embedder}
            onChange={(e) => onText(e.target.value)}
            className="w-full rounded bg-gray-800 p-2 text-sm outline-none"
          />
          {!embedder && !error && <p className="mb-3 mt-1 text-xs text-gray-400">{modelMsg}</p>}
          <div className="mb-3" />
          <TokenChips tokens={tokens} onToggle={onToggle} />
          <div className="my-3 border-t border-gray-800" />
          <NeighborPanel neighbors={neighbors} />
          <div className="my-3 border-t border-gray-800" />
          <Legend />
        </BottomSheet>
      </div>
    </div>
  )
}
