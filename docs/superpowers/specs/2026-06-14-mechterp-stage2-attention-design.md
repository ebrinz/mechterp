# MechTerp — Stage 2: Attention Patterns Design

**Date:** 2026-06-14
**Status:** Approved design (Section 1 + approach approved; Section 2 folded in), ready for planning
**Project root:** `/Users/crashy/Development/mechterp`

## Purpose

Turn the Stage 2 `/internals` route from a teaser into a real **attention-pattern explorer**: type a
sentence, run `all-MiniLM-L6-v2` **in the browser**, and visualize its self-attention as a
**token × token heatmap** for a chosen layer (0–5) and head (0–11). This is the app's first
genuinely *mechanistic* view — cracking the model open to show which tokens attend to which.

## Scope

### In scope
- A feasibility spike that proves in-browser attention extraction works (gates everything).
- Quantize the internals ONNX (int8, ~23 MB) and host it + tokenizer on HF Hub.
- `attention/` runtime module: load the ONNX (`onnxruntime-web`) + tokenizer, `analyze(text)`.
- Pure `sliceAttention` helper (flat tensor → T×T matrix).
- Stage 2 UI: text input, layer + head selectors, token×token heatmap with token labels + hover,
  loading/error states. Replaces the current teaser.
- Mobile responsiveness.

### Out of scope (later specs)
- Layer-trajectory view (B), BertViz-style arcs (B-alt), head small-multiples (C).
- Any change to Stage 1 or the Intro/shell.

### Fallback (only if the spike fails)
- Precompute attention offline for a few preset sentences, ship as JSON, drop live typing. Not
  built unless the spike shows in-browser extraction is unviable.

## Approach (approved)

In-browser via `onnxruntime-web`, **spike-first**, model **quantized + HF-hosted**:
1. **Feasibility spike (Task 1, gates the rest):** load the internals ONNX in a browser, feed
   tokenized input (`input_ids`/`attention_mask`/`token_type_ids`), read the `attentions` output
   `[6,1,12,T,T]`. Confirm shapes + plausible values (rows ~sum to 1). Try `onnxruntime-web`
   directly; note whether transformers.js `AutoModel` + `output.attentions` also works.
2. **Tokenize** with transformers.js's tokenizer (tokenizer-only, from the exported
   `tokenizer.json`) so token labels (incl. `[CLS]`/`[SEP]`/`##` subwords) match the model.
3. **Quantize** to int8 (~90 → ~23 MB) and host on HF Hub (`ebrinz/minilm-internals`); fetched
   via HF CDN, browser-cached after first Stage-2 visit.

## Architecture & data flow

**Offline (pipeline addition):**
- `pipeline/quantize_and_upload.py` — `quantize_dynamic` the internals `model.onnx` → int8; then
  `hf upload` the quantized model + `tokenizer.json` + `tokenizer_config.json` + `config.json` to
  the HF repo. Documented in `pipeline/README.md`.

**Runtime — new `attention/` module (Stage-2 analog of `embedder/`), lazy-loaded:**
- `src/attention/attentionModel.ts` — `AttentionModel.create(onProgress?)` loads the
  `onnxruntime-web` `InferenceSession` (quantized ONNX from HF CDN) + the tokenizer; `analyze(text)
  → { tokens: string[]; dims: { layers: number; heads: number; T: number }; data: Float32Array }`
  where `data` is the raw `attentions` tensor `[layers,1,heads,T,T]`. No UI knowledge. Loads only
  when Stage 2 mounts (Stage 1 unaffected).
- `src/attention/slice.ts` — **pure** `sliceAttention(data, dims, layer, head) → number[][]` (T×T
  via flat-index math: `data[(((layer)*heads + head)*T + i)*T + j]`, batch dim = 1).

```
type sentence → tokenize → ids/mask/type
  → session.run → attentions Float32Array [6,1,12,T,T] + tokens
  → sliceAttention(data, dims, layer, head) → T×T → AttentionHeatmap
```

## UI (Stage 2 `/internals` becomes the attention explorer)

Layout under the existing NavHeader (Stage 2 active):
- **Top:** a text input ("Type a sentence to see its attention…"), disabled until the model loads
  (with a "Loading attention model… N%" hint and progress).
- **Selectors:** a **Layer** row (buttons 0–5) and a **Head** row (buttons 0–11); active ones
  highlighted. Default layer 0, head 0.
- **Heatmap:** a token×token grid. Cell (i,j) brightness = attention from token i (row) to token j
  (col), indigo ramp on the dark theme; tokens label both axes (rows on the left, columns rotated
  on top). Hover a cell → tooltip "`tok_i → tok_j: 0.NN`". Raw 0–1 values (rows sum to ~1); a
  small note explains rows sum to 1.
- **Brief explainer** line: what attention is + that this reads the model's real internals.
- Replaces the "coming soon" teaser entirely.

**Mobile:** selectors wrap as compact buttons; the heatmap is horizontally scrollable and capped to
fit width (cells shrink); very long inputs are accepted but the grid scrolls. `dvh`, ≥44px taps.

**Loading/errors:** model download shows progress; a fetch/load failure (e.g. HF CDN 429) surfaces
a real error + a Retry button — never an infinite spinner (reuse Stage 1's pattern).

## Components & files

**New:**
- `src/attention/attentionModel.ts` — ONNX + tokenizer loader; `analyze()`.
- `src/attention/slice.ts` + `src/attention/slice.test.ts` — pure T×T slicer.
- `src/ui/AttentionHeatmap.tsx` + test — renders a T×T matrix + token labels + hover.
- `src/ui/LayerHeadSelector.tsx` + test — layer/head button rows (controlled).
- `pipeline/quantize_and_upload.py` — quantize + HF upload (offline).

**Modified:**
- `src/routes/Internals.tsx` — becomes the attention explorer (state: model, text, tokens,
  attentions, layer, head, loading/error; wires `attentionModel` → `slice` → heatmap).

## Testing

- **`slice.test.ts`** (pure): correct T×T extraction for a known small `[L,1,H,T,T]` tensor; layer
  and head indexing distinct; bounds.
- **`AttentionHeatmap.test.tsx`**: given a 3×3 matrix + 3 tokens, renders the token labels and the
  right number of cells; a cell's title/aria reflects its value.
- **`LayerHeadSelector.test.tsx`**: renders 6 layer + 12 head buttons; clicking calls
  `onChange(layer/head)`; active highlighted.
- **`attentionModel`**: contract-tested with `onnxruntime-web` mocked (returns a fake `attentions`
  tensor) → `analyze` returns the expected `{tokens, dims, data}`; real model run is **not**
  unit-tested (no onnx in jsdom).
- **In-browser gate (Playwright) before deploy** — the real model run only works in a browser
  (hard-won lesson): on `npm run preview` and live, type a sentence → heatmap renders; changing
  layer/head changes it; hover shows a weight; mobile (390px) scrolls. Spike (Task 1) is the first
  proof of this.

## Verification & rollout
- Spike passes (attentions extracted in-browser) **before** UI build; if it fails, pivot to the
  preset fallback and revise this spec.
- `npm run test` green; `npm run build` type-checks.
- Playwright check (type → heatmap, selectors, hover, mobile) at 1280px + 390px.
- Deploy to Vercel; confirm on `https://mechterp.vercel.app/internals`.
- Quantized model hosted at HF `ebrinz/minilm-internals`; ~23 MB first-load download, then cached.
