# MechTerp Stage 2 — Attention Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/internals` a real attention explorer — type a sentence, run `all-MiniLM-L6-v2` in the browser via onnxruntime-web, and show a token×token attention heatmap for a chosen layer (0–5) and head (0–11).

**Architecture:** A feasibility spike proves in-browser attention extraction first. Then: quantize the internals ONNX to int8 (~23 MB) served same-origin from `public/`; an `attention/` module loads it (onnxruntime-web) + tokenizer (transformers.js) and returns the raw `attentions` tensor; a pure `sliceAttention` cuts a T×T matrix; `LayerHeadSelector` + `AttentionHeatmap` render it; `Internals.tsx` wires it together.

**Tech Stack:** onnxruntime-web · @huggingface/transformers (tokenizer) · React 19 + TS + Tailwind · Vitest · Python onnxruntime.quantization (offline).

**Reference spec:** `docs/superpowers/specs/2026-06-14-mechterp-stage2-attention-design.md`.

> **Spec deviation (model hosting):** serve the quantized model **same-origin from `public/`** (committed, un-vercelignored) rather than HF Hub — chosen to avoid the HF CDN 429s this network repeatedly hits. Same-origin 23 MB is lean and reliable.

> **Spike-gated:** Task 1 must pass before Tasks 3–8. If it fails, stop and pivot to the preset-JSON fallback (revise the spec).

---

## File Structure

| Path | Responsibility |
|---|---|
| `scripts/copy-ort-wasm.mjs` | Copy onnxruntime-web wasm into `public/ort/` (predev/prebuild) |
| `pipeline/quantize_onnx.py` | int8-quantize the internals ONNX → `public/models/minilm-internals/model.q8.onnx` |
| `src/attention/slice.ts` (+test) | Pure: flat `attentions` tensor → T×T matrix |
| `src/attention/attentionModel.ts` (+test) | Load ONNX + tokenizer; `analyze(text)` |
| `src/ui/LayerHeadSelector.tsx` (+test) | Layer (0–5) + head (0–11) button rows |
| `src/ui/AttentionHeatmap.tsx` (+test) | token×token grid + labels + hover |
| `src/routes/Internals.tsx` | Wire input → analyze → slice → heatmap (replaces teaser) |

---

## Task 1: Feasibility spike (controller-run; gates everything)

**Goal:** prove we can extract attentions in the browser and record the exact onnxruntime-web setup. NOT a TDD task — exploratory; produces a short findings note. The existing **local** internals model (`public/models/minilm-internals/model.onnx`, 90 MB, already present) is used for the spike.

- [ ] **Step 1: Make onnxruntime-web wasm available.** Create `scripts/copy-ort-wasm.mjs`:
```js
import { mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/onnxruntime-web/dist')
const dest = resolve(root, 'public/ort')
mkdirSync(dest, { recursive: true })
for (const f of readdirSync(src)) {
  if (f.endsWith('.wasm') || f.endsWith('.mjs')) copyFileSync(resolve(src, f), resolve(dest, f))
}
console.log('copied onnxruntime-web wasm -> public/ort/')
```
Wire it into `package.json` scripts: add `"copy-ort-wasm": "node scripts/copy-ort-wasm.mjs"` and chain it into `predev` and `prebuild` (e.g. `"predev": "npm run copy-wasm && npm run copy-ort-wasm"`, same for `prebuild`). Add `public/ort/` to `.gitignore`.

- [ ] **Step 2: Write a throwaway spike component** at `src/routes/Internals.tsx` (temporary; replaced in Task 7). It loads onnxruntime-web, tokenizes a fixed sentence with transformers.js, runs the local model, and renders the attentions shape + a sample value into the DOM so Playwright can read it:
```tsx
import { useEffect, useState } from 'react'
import * as ort from 'onnxruntime-web'
import { AutoTokenizer } from '@huggingface/transformers'

ort.env.wasm.wasmPaths = '/ort/'

export function Internals() {
  const [out, setOut] = useState('running…')
  useEffect(() => {
    (async () => {
      try {
        const tok = await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2')
        const enc = await tok('I love you', { return_tensor: false })
        const ids = enc.input_ids as number[]
        const mask = enc.attention_mask as number[]
        const T = ids.length
        const big = (a: number[]) => BigInt64Array.from(a.map((n) => BigInt(n)))
        const session = await ort.InferenceSession.create('/models/minilm-internals/model.onnx')
        const feeds: Record<string, ort.Tensor> = {
          input_ids: new ort.Tensor('int64', big(ids), [1, T]),
          attention_mask: new ort.Tensor('int64', big(mask), [1, T]),
          token_type_ids: new ort.Tensor('int64', big(ids.map(() => 0)), [1, T]),
        }
        const res = await session.run(feeds)
        const att = res['attentions']
        setOut(`OK names=${session.outputNames.join(',')} attDims=${att.dims.join('x')} T=${T} sample=${(att.data as Float32Array)[0].toFixed(4)}`)
      } catch (e: any) {
        setOut('ERR: ' + (e?.message ?? String(e)))
      }
    })()
  }, [])
  return <main data-testid="spike" className="p-6 text-gray-100">{out}</main>
}
```

- [ ] **Step 3: Run it in a real browser.** `npm run dev` (or build+preview), navigate to `/internals` with Playwright, wait, read the `[data-testid=spike]` text.
Expected: `OK names=...attentions... attDims=6x1x12xTxT ...` with a finite sample value. Record:
- the exact output name for attentions,
- the attentions dims order,
- the input dtype/feed names that worked (int64 BigInt64Array, names `input_ids`/`attention_mask`/`token_type_ids`),
- the `ort.env.wasm.wasmPaths` setting that worked.

- [ ] **Step 4: Decision gate.**
- **Pass** (attentions extracted, plausible values, rows ~sum to 1 across last dim): proceed to Task 2; the recorded facts feed Tasks 3/7.
- **Fail** (can't load/run/extract after real effort): STOP. Document the blocker; pivot to the preset-JSON fallback and revise the spec with the human.

- [ ] **Step 5: Commit the spike scaffolding** (wasm copy script + temporary Internals + gitignore):
```bash
git add scripts/copy-ort-wasm.mjs package.json package-lock.json .gitignore src/routes/Internals.tsx
git commit -m "spike: extract attentions in-browser via onnxruntime-web (feasibility)"
```

---

## Task 2: Pure `sliceAttention` (TDD)

**Files:** Create `src/attention/slice.ts`, `src/attention/slice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/attention/slice.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { sliceAttention } from './slice'

// dims: layers=2, heads=2, T=2 → flat length 2*1*2*2*2 = 16
// layout [layer][batch=1][head][i][j]; value encodes layer*1000 + head*100 + i*10 + j
function makeData() {
  const L = 2, H = 2, T = 2
  const data = new Float32Array(L * 1 * H * T * T)
  let k = 0
  for (let l = 0; l < L; l++) for (let h = 0; h < H; h++) for (let i = 0; i < T; i++) for (let j = 0; j < T; j++)
    data[k++] = l * 1000 + h * 100 + i * 10 + j
  return data
}

describe('sliceAttention', () => {
  const data = makeData()
  const dims = { layers: 2, heads: 2, T: 2 }
  it('extracts the T×T matrix for a given layer/head', () => {
    expect(sliceAttention(data, dims, 0, 0)).toEqual([[0, 1], [10, 11]])
    expect(sliceAttention(data, dims, 1, 0)).toEqual([[1000, 1001], [1010, 1011]])
    expect(sliceAttention(data, dims, 0, 1)).toEqual([[100, 101], [110, 111]])
    expect(sliceAttention(data, dims, 1, 1)).toEqual([[1100, 1101], [1110, 1111]])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- attention/slice`
Expected: FAIL — `./slice` not found.

- [ ] **Step 3: Implement**

Create `src/attention/slice.ts`:
```ts
export interface AttentionDims { layers: number; heads: number; T: number }

/** Extract the T×T attention matrix for one (layer, head) from a flat [L,1,H,T,T] tensor. */
export function sliceAttention(data: Float32Array, dims: AttentionDims, layer: number, head: number): number[][] {
  const { heads, T } = dims
  const matrix: number[][] = []
  // index of element [layer][0][head][i][j] in a [L,1,H,T,T] row-major tensor:
  // (((layer * heads) + head) * T + i) * T + j
  for (let i = 0; i < T; i++) {
    const row: number[] = []
    for (let j = 0; j < T; j++) {
      row.push(data[(((layer * heads + head) * T) + i) * T + j])
    }
    matrix.push(row)
  }
  return matrix
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- attention/slice`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/attention/slice.ts src/attention/slice.test.ts
git commit -m "feat: pure sliceAttention (flat tensor -> T×T)"
```

---

## Task 3: `attentionModel` module

Wraps onnxruntime-web + tokenizer, per the Task-1 spike findings. (If the spike found different output names/dtypes, adjust the constants here to match — keep the public API.)

**Files:** Create `src/attention/attentionModel.ts`, `src/attention/attentionModel.test.ts`

- [ ] **Step 1: Write a contract test (onnxruntime-web + tokenizer mocked)**

Create `src/attention/attentionModel.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('onnxruntime-web', () => {
  class Tensor { type: string; data: any; dims: number[]; constructor(t: string, d: any, dims: number[]) { this.type = t; this.data = d; this.dims = dims } }
  return {
    env: { wasm: { wasmPaths: '' } },
    Tensor,
    InferenceSession: {
      create: async () => ({
        outputNames: ['last_hidden_state', 'hidden_states', 'attentions'],
        run: async () => ({ attentions: { data: Float32Array.from({ length: 2 * 1 * 2 * 3 * 3 }, (_, i) => i), dims: [2, 1, 2, 3, 3] } }),
      }),
    },
  }
})
vi.mock('@huggingface/transformers', () => ({
  AutoTokenizer: { from_pretrained: async () => async (_t: string) => ({ input_ids: [101, 7, 102], attention_mask: [1, 1, 1] }) },
}))

import { AttentionModel } from './attentionModel'

describe('AttentionModel', () => {
  it('analyze returns tokens, dims, and the raw attentions tensor', async () => {
    const m = await AttentionModel.create()
    const r = await m.analyze('hi')
    expect(r.dims).toEqual({ layers: 2, heads: 2, T: 3 })
    expect(r.data.length).toBe(2 * 1 * 2 * 3 * 3)
    expect(r.tokens.length).toBe(3)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- attentionModel`
Expected: FAIL — `./attentionModel` not found.

- [ ] **Step 3: Implement**

Create `src/attention/attentionModel.ts`:
```ts
import * as ort from 'onnxruntime-web'
import { AutoTokenizer } from '@huggingface/transformers'
import type { AttentionDims } from './slice'

ort.env.wasm.wasmPaths = '/ort/'

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
    const ids: number[] = Array.from(enc.input_ids as number[]).map(Number)
    const mask: number[] = Array.from(enc.attention_mask as number[]).map(Number)
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
    const tokens: string[] = (this.tokenizer.model?.convert_ids_to_tokens?.(ids))
      ?? (this.tokenizer.convert_ids_to_tokens?.(ids))
      ?? ids.map(String)
    return { tokens, dims: { layers, heads, T }, data: att.data as Float32Array }
  }
}
```
Note: the `tokens` line tries the transformers.js id→token method; the Task-1 spike confirms the exact call (adjust if the spike found a different accessor). If unavailable, it falls back to id strings — acceptable but the spike should confirm real token strings.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- attentionModel`
Expected: PASS. Then `npm run build`.
(If the `tokens` accessor differs, the mock returns ids→String fallback; that's fine for the contract test which only checks `tokens.length`.)

- [ ] **Step 5: Commit**

```bash
git add src/attention/attentionModel.ts src/attention/attentionModel.test.ts
git commit -m "feat: AttentionModel (onnxruntime-web + tokenizer) analyze()"
```

---

## Task 4: Quantize the model & serve it (offline + assets)

**Files:** Create `pipeline/quantize_onnx.py`; modify `.gitignore`, `.vercelignore`, `pipeline/README.md`

- [ ] **Step 1: Write the quantization script**

Create `pipeline/quantize_onnx.py`:
```python
"""int8-quantize the internals ONNX so it's small enough to ship same-origin (~90MB -> ~23MB)."""
from pathlib import Path
from onnxruntime.quantization import quantize_dynamic, QuantType

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "models" / "minilm-internals" / "model.onnx"
DST = ROOT / "public" / "models" / "minilm-internals" / "model.q8.onnx"


def main():
    quantize_dynamic(str(SRC), str(DST), weight_type=QuantType.QInt8)
    mb = DST.stat().st_size / 1e6
    print(f"Wrote {DST} ({mb:.1f} MB)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it** (uses the existing pipeline venv):
```bash
cd pipeline && . .venv/bin/activate && python quantize_onnx.py
```
Expected: `Wrote .../model.q8.onnx (~20-25 MB)`.

- [ ] **Step 3: Track the quantized model for deploy.** It must be committed (CI/Vercel can't regenerate it) and NOT vercel-ignored.
- In `.gitignore`, the line `public/models/` ignores everything. Add a negation so the quantized file (only) is tracked:
```
public/models/
!public/models/minilm-internals/
public/models/minilm-internals/*
!public/models/minilm-internals/model.q8.onnx
```
- In `.vercelignore`, remove (or narrow) the `public/models` exclusion so `model.q8.onnx` deploys. Replace the `public/models` line with explicit excludes of the big unquantized artifacts:
```
public/models/minilm-internals/model.onnx
public/models/minilm-internals/*.txt
```
(keeps the 90 MB `model.onnx`, vocab, etc. out; ships only `model.q8.onnx`.)

- [ ] **Step 4: Verify it's served + tracked**
```bash
git add public/models/minilm-internals/model.q8.onnx .gitignore .vercelignore
git ls-files public/models/minilm-internals/model.q8.onnx   # must list the file
du -h public/models/minilm-internals/model.q8.onnx
```
Expected: file listed; ~23 MB. Document the quantize step in `pipeline/README.md`.

- [ ] **Step 5: Commit**

```bash
git add pipeline/quantize_onnx.py pipeline/README.md public/models/minilm-internals/model.q8.onnx .gitignore .vercelignore
git commit -m "build: int8-quantize internals ONNX; serve model.q8.onnx same-origin"
```

---

## Task 5: `LayerHeadSelector` (TDD)

**Files:** Create `src/ui/LayerHeadSelector.tsx`, `src/ui/LayerHeadSelector.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/LayerHeadSelector.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { LayerHeadSelector } from './LayerHeadSelector'

describe('LayerHeadSelector', () => {
  it('renders layer and head buttons and reports clicks', () => {
    const onLayer = vi.fn(); const onHead = vi.fn()
    const { getByRole } = render(
      <LayerHeadSelector layers={6} heads={12} layer={0} head={0} onLayer={onLayer} onHead={onHead} />,
    )
    fireEvent.click(getByRole('button', { name: 'layer 3' }))
    expect(onLayer).toHaveBeenCalledWith(3)
    fireEvent.click(getByRole('button', { name: 'head 5' }))
    expect(onHead).toHaveBeenCalledWith(5)
  })
  it('marks the active layer/head with aria-pressed', () => {
    const { getByRole } = render(
      <LayerHeadSelector layers={6} heads={12} layer={2} head={4} onLayer={() => {}} onHead={() => {}} />,
    )
    expect(getByRole('button', { name: 'layer 2' }).getAttribute('aria-pressed')).toBe('true')
    expect(getByRole('button', { name: 'head 4' }).getAttribute('aria-pressed')).toBe('true')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- LayerHeadSelector`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/ui/LayerHeadSelector.tsx`:
```tsx
function Row({ count, value, onChange, label }: { count: number; value: number; onChange: (i: number) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 w-12 text-xs uppercase tracking-wide text-gray-500">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          aria-label={`${label} ${i}`}
          aria-pressed={value === i}
          onClick={() => onChange(i)}
          className={`min-h-[36px] min-w-[36px] rounded text-xs ${value === i ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'}`}
        >
          {i}
        </button>
      ))}
    </div>
  )
}

export function LayerHeadSelector({
  layers, heads, layer, head, onLayer, onHead,
}: {
  layers: number; heads: number; layer: number; head: number; onLayer: (i: number) => void; onHead: (i: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Row count={layers} value={layer} onChange={onLayer} label="layer" />
      <Row count={heads} value={head} onChange={onHead} label="head" />
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- LayerHeadSelector`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/LayerHeadSelector.tsx src/ui/LayerHeadSelector.test.tsx
git commit -m "feat: LayerHeadSelector (layer/head button rows)"
```

---

## Task 6: `AttentionHeatmap` (TDD)

**Files:** Create `src/ui/AttentionHeatmap.tsx`, `src/ui/AttentionHeatmap.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/AttentionHeatmap.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AttentionHeatmap } from './AttentionHeatmap'

describe('AttentionHeatmap', () => {
  const tokens = ['[CLS]', 'hi', '[SEP]']
  const matrix = [
    [0.8, 0.1, 0.1],
    [0.2, 0.7, 0.1],
    [0.3, 0.3, 0.4],
  ]
  it('renders a cell per matrix entry and labels the tokens', () => {
    const { getAllByTestId, getAllByText } = render(<AttentionHeatmap tokens={tokens} matrix={matrix} />)
    expect(getAllByTestId('att-cell').length).toBe(9)
    // each token appears at least once (row labels + column labels)
    expect(getAllByText('hi').length).toBeGreaterThanOrEqual(1)
  })
  it('encodes the weight in each cell title', () => {
    const { getAllByTestId } = render(<AttentionHeatmap tokens={tokens} matrix={matrix} />)
    const first = getAllByTestId('att-cell')[0]
    expect(first.getAttribute('title')).toMatch(/0\.80/)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- AttentionHeatmap`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/ui/AttentionHeatmap.tsx`:
```tsx
/** token×token attention grid. matrix[i][j] = attention from row token i to col token j (0..1). */
export function AttentionHeatmap({ tokens, matrix }: { tokens: string[]; matrix: number[][] }) {
  const T = tokens.length
  return (
    <div className="overflow-auto">
      <div
        className="grid gap-[1px]"
        style={{ gridTemplateColumns: `minmax(60px, auto) repeat(${T}, minmax(18px, 1fr))` }}
      >
        {/* header row: blank corner + column token labels */}
        <div />
        {tokens.map((t, j) => (
          <div key={`c${j}`} className="px-0.5 text-center text-[10px] text-gray-400" title={t}>
            <span className="inline-block max-w-[48px] truncate align-bottom">{t}</span>
          </div>
        ))}
        {/* body rows */}
        {matrix.map((row, i) => (
          <Row key={`r${i}`} token={tokens[i]} row={row} colTokens={tokens} />
        ))}
      </div>
    </div>
  )
}

function Row({ token, row, colTokens }: { token: string; row: number[]; colTokens: string[] }) {
  return (
    <>
      <div className="truncate pr-1 text-right text-[10px] leading-[18px] text-gray-400" title={token}>{token}</div>
      {row.map((v, j) => (
        <div
          key={j}
          data-testid="att-cell"
          title={`${token} → ${colTokens[j]}: ${v.toFixed(2)}`}
          className="h-[18px] w-full rounded-[1px]"
          style={{ backgroundColor: `rgba(129,140,248,${Math.max(0, Math.min(1, v)).toFixed(3)})` }}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- AttentionHeatmap`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/AttentionHeatmap.tsx src/ui/AttentionHeatmap.test.tsx
git commit -m "feat: AttentionHeatmap token×token grid"
```

---

## Task 7: Wire the real `Internals` route

Replace the spike (and the old teaser) with the real explorer.

**Files:** Modify `src/routes/Internals.tsx`; Create `src/routes/Internals.test.tsx`

- [ ] **Step 1: Write the integration test (mock the model + slice)**

Create `src/routes/Internals.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../attention/attentionModel', () => ({
  AttentionModel: {
    create: async () => ({
      analyze: async () => ({
        tokens: ['[CLS]', 'hi', '[SEP]'],
        dims: { layers: 6, heads: 12, T: 3 },
        data: Float32Array.from({ length: 6 * 1 * 12 * 3 * 3 }, () => 0.33),
      }),
    }),
  },
}))

import { Internals } from './Internals'

describe('Internals attention explorer', () => {
  it('analyzes typed text and renders the heatmap', async () => {
    const { getByPlaceholderText, getAllByTestId } = render(<MemoryRouter><Internals /></MemoryRouter>)
    await waitFor(() => expect((getByPlaceholderText(/type a sentence/i) as HTMLInputElement).disabled).toBe(false))
    fireEvent.change(getByPlaceholderText(/type a sentence/i), { target: { value: 'hi there' } })
    await waitFor(() => expect(getAllByTestId('att-cell').length).toBe(9))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- routes/Internals`
Expected: FAIL — current Internals is the spike/teaser, no heatmap.

- [ ] **Step 3: Implement the real route**

Replace `src/routes/Internals.tsx`:
```tsx
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
```

- [ ] **Step 4: Run tests + build**

Run: `npm run test -- routes/Internals` (passes), then full `npm run test` (all green; the AppLayout test still finds `Internals` — note it may have asserted "coming soon" previously, update that assertion if present to match the new heading "Stage 2 · Attention"). Then `npm run build`.

> If `src/AppLayout.test.tsx` asserts `/coming soon/i` at `/internals`, change that assertion to `getByText(/attention/i)` since the teaser is gone.

- [ ] **Step 5: Commit**

```bash
git add src/routes/Internals.tsx src/routes/Internals.test.tsx src/AppLayout.test.tsx
git commit -m "feat: Stage 2 attention explorer (input -> analyze -> selectors -> heatmap)"
```

---

## Task 8: Verify in-browser (desktop + mobile) and deploy

**Files:** none (verification + deploy)

- [ ] **Step 1: Full suite + build** — `npm run test` (green), `npm run build` (`✓ built`).

- [ ] **Step 2: Browser verify** — `npm run preview`; with Playwright on `/internals`:
- model loads (input enables); typing a sentence renders the heatmap with token labels (incl `[CLS]`/`[SEP]`).
- clicking different **layer** and **head** buttons changes the heatmap (assert a cell's title/value changes).
- hover a cell shows the `tok → tok: 0.NN` title.
- mobile (390px): selectors wrap, heatmap scrolls horizontally, readable.
Record screenshots at 1280px + 390px.

- [ ] **Step 3: Deploy + confirm production** — `npx --yes vercel --prod --yes`; on `https://mechterp.vercel.app/internals` confirm the model loads (same-origin `model.q8.onnx`) and the heatmap renders on a typed sentence.

- [ ] **Step 4: Commit any verification fixes** (skip if none):
```bash
git add -A
git commit -m "fix: stage 2 attention adjustments from browser verification"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** feasibility spike (Task 1) ✓; quantize int8 + serve (Task 4, deviating to same-origin per the noted reason) ✓; `attention/` module with `analyze` (Task 3) ✓; pure `sliceAttention` (Task 2) ✓; layer/head selectors (Task 5) ✓; token×token heatmap w/ labels + hover (Task 6) ✓; Internals route wiring + input + loading/error (Task 7) ✓; in-browser desktop+mobile verify + deploy (Task 8) ✓; onnxruntime-web wasm provisioning (Task 1 Step 1) ✓. Fallback path documented in spec; spike gate in Task 1 Step 4. Layer-trajectory/arcs/small-multiples correctly excluded.

**Placeholder scan:** every code step has complete contents; Task 1 is explicitly an exploratory spike (not a TDD placeholder) whose findings refine Tasks 3/7 constants. No "TBD"/"handle errors" gaps.

**Type/name consistency:** `AttentionDims {layers,heads,T}` defined in Task 2 (`slice.ts`), imported by Task 3. `sliceAttention(data, dims, layer, head)` used in Task 7. `AttentionModel.create()/analyze()` + `AnalyzeResult {tokens,dims,data}` defined Task 3, used Task 7 + mocked in Task 7's test. `LayerHeadSelector({layers,heads,layer,head,onLayer,onHead})` (Task 5) and `AttentionHeatmap({tokens,matrix})` (Task 6) match their Task-7 usage. `data-testid="att-cell"` consistent between Task 6 + Task 7 test. Model served at `/models/minilm-internals/model.q8.onnx` consistent between Task 3 (`MODEL_URL`) and Task 4 (output path + tracked file).
```
