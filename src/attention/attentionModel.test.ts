import { describe, it, expect, vi } from 'vitest'

vi.mock('onnxruntime-web', () => {
  class Tensor { type: string; data: any; dims: number[]; constructor(t: string, d: any, dims: number[]) { this.type = t; this.data = d; this.dims = dims } }
  return {
    env: { wasm: {} },
    Tensor,
    InferenceSession: {
      create: async () => ({
        outputNames: ['last_hidden_state', 'hidden_states', 'attentions'],
        run: async () => ({ attentions: { data: Float32Array.from({ length: 2 * 1 * 2 * 3 * 3 }, (_, i) => i), dims: [2, 1, 2, 3, 3] } }),
      }),
    },
  }
})
vi.mock('@huggingface/transformers', () => {
  const tok: any = async (_t: string) => ({ input_ids: { data: [101, 7, 102] }, attention_mask: { data: [1, 1, 1] } })
  tok.decode = (ids: number[]) => `tok${ids[0]}`
  return { AutoTokenizer: { from_pretrained: async () => tok } }
})

import { AttentionModel } from './attentionModel'

describe('AttentionModel', () => {
  it('analyze returns tokens (via decode), dims, and the raw attentions tensor', async () => {
    const m = await AttentionModel.create()
    const r = await m.analyze('hi')
    expect(r.dims).toEqual({ layers: 2, heads: 2, T: 3 })
    expect(r.data.length).toBe(2 * 1 * 2 * 3 * 3)
    expect(r.tokens).toEqual(['tok101', 'tok7', 'tok102'])
  })
})
