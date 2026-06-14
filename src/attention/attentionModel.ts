import * as ort from 'onnxruntime-web'
import { AutoTokenizer } from '@huggingface/transformers'
import type { AttentionDims } from './slice'

// Prod serves /ort/* as static files; Vite dev blocks importing /public modules, so dev loads
// the version-matched runtime from the CDN. Single-threaded (no SharedArrayBuffer needed).
ort.env.wasm.wasmPaths = import.meta.env.DEV
  ? 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/'
  : '/ort/'
ort.env.wasm.numThreads = 1

const MODEL_URL = '/models/minilm-internals/model.q8.onnx'
const TOKENIZER_ID = 'Xenova/all-MiniLM-L6-v2'

export interface AnalyzeResult {
  tokens: string[]
  dims: AttentionDims
  data: Float32Array
}

export class AttentionModel {
  private session: ort.InferenceSession
  private tokenizer: any
  private constructor(session: ort.InferenceSession, tokenizer: any) {
    this.session = session
    this.tokenizer = tokenizer
  }

  static async create(): Promise<AttentionModel> {
    const [session, tokenizer] = await Promise.all([
      ort.InferenceSession.create(MODEL_URL),
      AutoTokenizer.from_pretrained(TOKENIZER_ID),
    ])
    return new AttentionModel(session, tokenizer)
  }

  async analyze(text: string): Promise<AnalyzeResult> {
    const enc = await this.tokenizer(text)
    const ids: number[] = Array.from((enc.input_ids.data ?? enc.input_ids) as Iterable<number>).map(Number)
    const mask: number[] = Array.from((enc.attention_mask.data ?? enc.attention_mask) as Iterable<number>).map(Number)
    const T = ids.length
    const big = (a: number[]) => BigInt64Array.from(a.map((n) => BigInt(n)))
    const feeds: Record<string, ort.Tensor> = {
      input_ids: new ort.Tensor('int64', big(ids), [1, T]),
      attention_mask: new ort.Tensor('int64', big(mask), [1, T]),
      token_type_ids: new ort.Tensor('int64', big(ids.map(() => 0)), [1, T]),
    }
    const res = await this.session.run(feeds)
    const att = res['attentions']
    const [layers, , heads] = att.dims as number[]
    const tokens: string[] = ids.map((id) => this.tokenizer.decode([id]))
    return { tokens, dims: { layers, heads, T }, data: att.data as Float32Array }
  }
}
