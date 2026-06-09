export type Vec384 = Float32Array  // length 384, L2-normalized
export type XYZ = [number, number, number]

export interface Point {
  id: number
  text: string
  emotion: string
  xyz: XYZ
  vec: Vec384
}

export interface Neighbor {
  id: number
  text: string
  emotion: string
  xyz: XYZ
  distance: number   // cosine distance in [0, 2]; smaller = closer
}

export interface EmbedResult {
  vector: Vec384
  internals?: {
    hiddenStates?: Float32Array[]   // per-layer, unused in v1
    attentions?: Float32Array[]     // per-layer, unused in v1
  }
}
