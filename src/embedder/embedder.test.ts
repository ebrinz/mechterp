import { describe, it, expect, vi } from 'vitest'

vi.mock('@huggingface/transformers', () => ({
  pipeline: async () => async (_t: string, _o: unknown) =>
    ({ data: Float32Array.from(Array.from({ length: 384 }, (_, i) => (i === 0 ? 3 : 0))) }),
  env: { allowLocalModels: true, backends: { onnx: { wasm: {} } } },
}))

import { Embedder } from './embedder'

describe('Embedder', () => {
  it('returns a 384-d L2-normalized vector', async () => {
    const e = await Embedder.create()
    const { vector } = await e.embed('hello')
    expect(vector.length).toBe(384)
    let norm = 0
    for (const v of vector) norm += v * v
    expect(Math.sqrt(norm)).toBeCloseTo(1, 5)
  })
})
