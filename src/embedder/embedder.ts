import { pipeline, env } from '@huggingface/transformers'
import type { EmbedResult, Vec384 } from '../types'

// Single-threaded WASM baseline; WebGPU used automatically if the runtime offers it.
// env.backends.onnx is typed as Partial<onnxruntime-common Env>; wasm may be undefined
// at the type level even though the runtime always provides it, so we use optional chaining
// to satisfy the compiler while keeping the intent unchanged.
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1
}

function l2normalize(v: Float32Array): Vec384 {
  let n = 0
  for (const x of v) n += x * x
  const inv = 1 / (Math.sqrt(n) || 1e-12)
  const out = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) out[i] = v[i] * inv
  return out
}

export class Embedder {
  private extractor: Awaited<ReturnType<typeof pipeline>>
  private constructor(extractor: Awaited<ReturnType<typeof pipeline>>) {
    this.extractor = extractor
  }

  static async create(
    onProgress?: (p: { progress?: number; status?: string }) => void,
  ): Promise<Embedder> {
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      // quantized int8 weights -> small download, mobile-friendly
      dtype: 'q8',
      progress_callback: onProgress,
    })
    return new Embedder(extractor)
  }

  async embed(text: string): Promise<EmbedResult> {
    const out = await (this.extractor as (text: string, opts: unknown) => Promise<{ data: Float32Array }>)(
      text,
      { pooling: 'mean', normalize: false },
    )
    return { vector: l2normalize(out.data) }
  }
}
