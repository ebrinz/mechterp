import { useEffect, useMemo, useRef, useState } from 'react'
import { Embedder } from './embedder/embedder'
import { VectorStore } from './vectorStore/vectorStore'
import { placeLivePoint } from './placement/placement'
import { toTokens, maskedSentence, type Token } from './tokens/tokens'
import { Scene } from './scene/Scene'
import { TokenChips } from './ui/TokenChips'
import { NeighborPanel } from './ui/NeighborPanel'
import { Legend } from './ui/Legend'
import { BottomSheet } from './ui/BottomSheet'
import type { Neighbor, Point, XYZ } from './types'

const K = 8

export default function App() {
  const [embedder, setEmbedder] = useState<Embedder | null>(null)
  const [store, setStore] = useState<Awaited<ReturnType<typeof VectorStore.fromUrl>> | null>(null)
  const [loadMsg, setLoadMsg] = useState('Loading model & data…')
  const [tokens, setTokens] = useState<Token[]>([])
  const [neighbors, setNeighbors] = useState<Neighbor[]>([])
  const [live, setLive] = useState<XYZ | null>(null)
  const [trail, setTrail] = useState<XYZ[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [e, s] = await Promise.all([
        Embedder.create((p) => p.progress && setLoadMsg(`Loading model… ${Math.round(p.progress)}%`)),
        VectorStore.fromUrl('/emotions.sqlite'),
      ])
      if (!alive) return
      setEmbedder(e); setStore(s); setLoadMsg('')
    })()
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
    <div className="flex h-[100dvh] flex-col bg-gray-950 text-gray-100 md:flex-row">
      <div className="relative flex-1">
        <Scene points={points} centroids={centroids} live={live} trail={trail} />
        {loadMsg && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">{loadMsg}</div>
        )}
      </div>
      <div className="md:w-96">
        <BottomSheet>
          <input
            placeholder="Type a sentence to see where it lands…"
            disabled={!embedder}
            onChange={(e) => onText(e.target.value)}
            className="mb-3 w-full rounded bg-gray-800 p-2 text-sm outline-none"
          />
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
