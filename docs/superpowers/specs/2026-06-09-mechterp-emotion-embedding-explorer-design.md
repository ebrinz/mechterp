# MechTerp — Emotion Embedding Explorer (v1)

**Date:** 2026-06-09
**Status:** Approved design, ready for implementation planning
**Project root:** `/Users/crashy/Development/mechterp`

## Purpose

The first UI of a playground for **learning mechanistic interpretability**. It is an
in-browser explorer for `all-MiniLM-L6-v2` sentence embeddings over the **GoEmotions**
dataset. The user types/edits a sentence and watches where it lands — and *drifts* — in a
3D projection of emotion-labeled embeddings.

This is deliberately **option B**: an embedding explorer that *foreshadows* mechanistic
interpretability. The black-box embedding cloud is the hook; instrumentation to peek
inside the model is designed in from the start so the deeper, more mechanistic views
(layer trajectory, attention patterns) are additive rather than a rewrite.

### The teaching thesis (read this first)

`all-MiniLM-L6-v2` embeddings are dominated by **topic/semantics**, not emotion. Emotion
is a real but relatively **weak** signal in that 384-d space. So the 3D cloud will show a
few emotions pulling apart (gratitude, love, amusement) and a large overlapping central
mass (neutral, approval, annoyance, …) that does **not** form clean separable clusters.

**We do not hide this. The messiness is the lesson.** "Why don't emotions form neat
balls?" is exactly the question that pushes a learner from black-box thinking toward
wanting the internals. We verify the real structure empirically in the precompute step
before trusting any claim about it.

## Scope

### In scope (v1)
- Offline Python pipeline that builds the reference dataset and a richer ONNX export.
- Static, 100% client-side web app: embed in-browser, store/search in-browser, render in-browser.
- Live "type → embed → kNN → place → drift trail" loop with maskable token chips (token saliency = the day-one internal view).
- Works in Safari and looks good on iPhone.

### Designed-in but NOT built in v1
- **B — Layer trajectory:** project each of the 6 layers' hidden states into the same 3D space and draw the input's path through depth (residual-stream intuition).
- **C — Attention patterns:** per-layer, per-head attention matrices over input tokens (BertViz-style; the canonical mech-interp view).

### Explicitly out of scope (v1)
- Any backend / API / server inference.
- Supervised UMAP, hard cluster boundaries (would imply false separability).
- Larger models, activation patching, training probes, cross-device save/share.

## Architecture

A 100% client-side static web app, split across three layers that mirror an
offline / asset / runtime boundary.

### ① Offline precompute pipeline (Python, run-once on the dev machine)
- Load GoEmotions; filter to **high rater-agreement, single-label** examples; **stratify
  ~1–2k** across the 28 emotions (prioritize emotion-balance + confidence over even
  manifold coverage — for a teaching tool, legibility beats volume).
- Embed each with `all-MiniLM-L6-v2` (the **same** model the browser runs, so live points
  land in the same space).
- **Unsupervised UMAP → 3D** coordinates. Compute **per-emotion centroids** as landmarks.
- Empirically inspect the projection — confirm what structure is real before the UI claims it.
- Write a prebuilt **`emotions.sqlite`**: `points(id, text, emotion, x, y, z, vec BLOB[384])`
  and `centroids(emotion, x, y, z)`. Shipped as a static asset.
- **Re-export `all-MiniLM-L6-v2` to ONNX with `output_hidden_states=True` and
  `output_attentions=True`** (via 🤗 optimum) — the forward-compat prerequisite for B and C.
  v1 only uses the final embedding, but the asset exists from day one so B/C need no asset regen.

### ② Runtime web app (browser)
- **Embedding:** `@huggingface/transformers` running `all-MiniLM-L6-v2` **int8-quantized**,
  **single-threaded WASM baseline**, WebGPU used only if present. Mean-pooled + normalized.
- **Storage + search:** **SQLite-WASM** loads `emotions.sqlite` **into memory** (no OPFS).
  Vector kNN done **in SQL via the `sqlite-vec` extension** — the deliberate
  "vector search in SQLite" learning vehicle. **Fallback:** vectors as BLOB → typed array →
  cosine in JS; identical UX; chosen automatically if the wasm extension won't load. The two
  paths are tested to agree.
- **3D viz:** **Three.js via react-three-fiber** — reference cloud, centroid landmarks,
  animated live point, fading drift trail.
- **App shell:** **Vite + React + TypeScript + Tailwind.**

### Deployment
Static build → **Vercel** (recommended; can set headers if ever needed). **GH Pages** is a
real fallback *because* we stay single-threaded / no cross-origin isolation.

### Why this split
The offline pipeline does the heavy, non-portable work (UMAP, dataset wrangling, ONNX
re-export) once; the browser only does light per-input work (one embed + one kNN). That is
what keeps it deployable as a static site and keeps B/C client-side.

## Components (module boundaries — each testable in isolation)

- **`embedder`** — wraps transformers.js. `embed(text) → { vector: Float32Array(384), internals?: { hiddenStates?, attentions? } }`. The `internals` field is unused in v1 but present in the shape so B/C are additive. Knows nothing about UI or DB.
- **`vectorStore`** — wraps SQLite-WASM + sqlite-vec. `init(dbUrl)`, `knn(vec, k) → [{id, text, emotion, xyz, distance}]`, plus `query(sql)` relational helpers for the SQLite learning angle. Knows nothing about embeddings or rendering.
- **`placement`** — pure function. `placeLivePoint(neighbors) → xyz` = distance-weighted centroid of the kNN's 3D coords. Pure ⇒ trivially unit-testable; the riskiest "is the math right" logic isolated.
- **`tokens`** — splits input into chips using the **model's tokenizer** (so masking matches what the model sees); owns mask state.
- **`scene`** (react-three-fiber) — renders cloud, centroid landmarks, live point, trail. Consumes plain data; no model/DB knowledge.
- **`ui`** — panels, responsive bottom-sheet, legend.
- **`App`** — orchestration: input → embedder → vectorStore → placement → scene.

## Core data flow (the live loop)

```
user edits text OR toggles a token chip
  ↓ tokens rebuilds the (masked) sentence
  ↓ embedder.embed(sentence) → 384-d vector
  ↓ vectorStore.knn(vector, k) → nearest reference points
  ↓ placement → live point xyz
  ↓ scene animates live point to xyz, pushes a fading trail segment
  ↓ panel: nearest neighbors + emotions + which token's removal moved the point most (saliency)
```

**Why kNN placement:** t-SNE/UMAP have no natural "project a new point" operation. We
precompute the layout offline for a fixed reference set, then place each live point at the
**distance-weighted centroid of its k nearest reference neighbors** in 384-d space. The
drift trail visualizes saliency directly: masking a token re-embeds, re-runs kNN, and moves
the point.

## UX & layout

**Desktop**
- **Center:** 3D cloud (orbit/zoom/pan). Reference points colored by emotion; labeled
  centroid landmarks; glowing live point with comet-trail. Soft per-emotion density/region
  shading is allowed; **hard boundaries are not** (false separability).
- **Bottom:** text input + **token chips** (click to mask/unmask → watch the drift).
- **Right panel:** nearest-neighbor list (text + emotion + distance), per-token saliency
  readout (e.g. "removing *grateful* moved the point 0.42 toward *neutral*"), emotion legend.
- **Trail controls:** clear trail; step back through prior positions to compare drifts.

**iPhone / portrait (same components, responsive via Tailwind breakpoints)**
- 3D cloud fills top ~60%; input + chips + neighbor/saliency panel become a **draggable
  bottom sheet** (peek → expand); legend collapsible; chips wrap.
- `dvh` (not `vh`) to dodge Safari toolbar-resize bug. Touch targets ≥44px.
- **Touch controls:** one-finger orbit, pinch zoom, two-finger pan; canvas captures
  gestures so they don't fight page scroll.

## Cross-browser & mobile (Safari + iPhone) — first-class constraints

- **WebGPU optional, never required;** single-threaded WASM is the baseline (transformers.js fallback).
- **No SharedArrayBuffer / no COOP-COEP requirement** — avoids cross-origin-isolation
  headers (which can otherwise block the model download) and keeps GH Pages viable.
- **iOS Safari per-tab memory is tight** and we stack model + SQLite-WASM + WebGL.
  Mitigations: small reference set (~1–2k), int8-quantized model, SQLite loaded in-memory
  (no OPFS), free transient buffers. **#1 thing we verify on a real iPhone early.**
- **Model download is a deliberate one-tap action** with a progress bar and a "~N MB" note,
  then aggressively browser-cached so repeat visits are instant.
- **3D on touch:** cap devicePixelRatio ~2; instanced/points material for 1–2k points.

## Error & edge handling
- Model still downloading → disabled input with progress.
- Empty / all-masked sentence → live point hidden, gentle hint.
- WebGPU absent → WASM fallback (slower; one-time note).
- `sqlite-vec` load failure → automatic JS-cosine fallback (logged, UX unchanged).

## Forward-compatibility for B and C (decided)
The static/no-backend architecture is **not** a roadblock for B or C. The real gate is the
**ONNX export**, handled offline in the pipeline. Two items baked in now:
1. **Pipeline emits the internals-exposing ONNX export from day one** (hidden_states +
   attentions) so B/C require no asset regen.
2. **`embedder` returns an optional `internals` field** — unused in v1, already in the shape.

For everything in the current B/C roadmap with this tiny model, client-side is sufficient.
A backend would only earn its place for genuinely large models, heavy on-demand compute
(activation patching/probes), or cross-device save/share — none of which are B or C.

## Testing strategy (scaled to where bugs hide)
- **Pure-logic unit (Vitest):** `placement` (distance-weighted centroid), `tokens` masking,
  cosine/kNN ranking, color-mapping. Deterministic, highest-value.
- **Module contract:** `vectorStore.knn` vs a tiny fixture DB returns expected ordered
  neighbors; `embedder` returns a 384-d normalized vector for a known string (tolerance);
  the sqlite-vec path and the JS-cosine fallback **agree**.
- **Pipeline assertions (Python):** every point has 3D coords + 384-d vector; all 28
  emotions present; the ONNX export actually emits hidden-states + attentions (guards the
  B/C prerequisite from silently regressing).
- **On-device smoke checkpoint:** explicit early iOS-Safari test (model load, memory, touch),
  documented as a gate **before** polish.
- **Light E2E (later, optional):** Playwright happy-path "type → point appears → mask token
  → point drifts." Minimal; not the v1 focus.

## Project structure
```
mechterp/
├─ pipeline/                  # Python, offline, run-once
│  ├─ build_dataset.py        # GoEmotions → filter → stratify → embed → UMAP → emotions.sqlite
│  ├─ export_onnx.py          # all-MiniLM re-export w/ hidden_states + attentions
│  └─ tests/                  # output assertions
├─ public/
│  ├─ emotions.sqlite         # prebuilt reference DB (shipped asset)
│  └─ models/                 # internals-exposing ONNX (or HF-hosted)
├─ src/
│  ├─ embedder/               # transformers.js wrapper → { vector, internals? }
│  ├─ vectorStore/            # SQLite-WASM + sqlite-vec; knn() + query()
│  ├─ placement/              # pure: neighbors → live xyz
│  ├─ tokens/                 # chip + mask state
│  ├─ scene/                  # react-three-fiber: cloud, centroids, live point, trail
│  ├─ ui/                     # panels, bottom-sheet, legend (responsive)
│  └─ App.tsx                 # orchestration
├─ docs/superpowers/specs/    # this design doc
└─ (Vite + TS + Tailwind config)
```

## Open verification items (resolve during implementation, not blockers)
- Confirm `sqlite-vec` loads as a wasm extension in Safari; otherwise default to JS-cosine.
- Confirm transformers.js runs the custom internals-exposing ONNX export and returns
  hidden-states/attentions in expected shapes (gates B/C, verified via the pipeline test).
- Measure real iPhone memory headroom with all three subsystems loaded.
- Pick exact reference-set size in [1k, 2k] after inspecting projection legibility.
