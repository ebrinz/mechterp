# MechTerp — Emotion Embedding Explorer

A playground for *learning mechanistic interpretability*. This first UI is an in-browser
explorer for `all-MiniLM-L6-v2` sentence embeddings over the **GoEmotions** dataset: type a
sentence and watch where it lands — and **drifts** — in a 3D UMAP projection of
emotion-labeled embeddings. Mask individual words (token chips) and watch the live point
move through emotion-space; that drift *is* the saliency.

It runs **100% in the browser** — embedding (transformers.js), vector search (SQLite-WASM),
and the 3D scene (react-three-fiber) all client-side. No backend.

> **The teaching thesis:** `all-MiniLM-L6-v2` embeddings are dominated by topic, not emotion.
> Some emotions pull apart; most overlap in a messy central mass. We *show* that mess rather
> than fake clean clusters — "why don't emotions form neat balls?" is the question that pulls
> a learner toward the model's internals. The roadmap (layer trajectory, attention patterns)
> builds on exactly that pull; the ONNX export already exposes the internals they need.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

The app needs two prebuilt assets in `public/` (git-ignored — see **Data pipeline** below).
Without them the UI loads but the cloud is empty and embedding fails to fetch the model.

```bash
npm run test       # Vitest unit/contract/integration suite
npm run build      # tsc type-check + production build to dist/
npm run preview    # serve the production build locally
```

## Data pipeline (run once)

Builds the reference `emotions.sqlite` and the internals-exposing ONNX export. Do this on a
good network (downloads PyTorch, the model, and GoEmotions). See [`pipeline/README.md`](pipeline/README.md).

```bash
cd pipeline
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python export_onnx.py
python build_dataset.py
pytest tests/test_outputs.py -v
```

## Architecture

| Layer | What | Where |
|---|---|---|
| **Offline** | GoEmotions → filter/stratify → embed → UMAP → `emotions.sqlite`; internals-exposing ONNX | `pipeline/` |
| **Assets** | prebuilt DB + ONNX (git-ignored) | `public/` |
| **Runtime** | embed → kNN → place → render the live loop | `src/` |

Runtime modules (each one focused + independently tested):
`embedder/` (transformers.js, q8, single-thread) · `vectorStore/` (SQLite-WASM, brute-force
kNN + `query()`; see `vec-spike.md` for the sqlite-vec decision) · `placement/` (pure
distance-weighted live-point) · `tokens/` (chip masking) · `scene/` (r3f cloud, centroids,
live point, trail) · `ui/` (chips, neighbor/saliency panel, legend, responsive bottom sheet)
· `App.tsx` (orchestration).

## Safari / iPhone

Designed to run on Safari and look good on iPhone:
- **Single-threaded WASM baseline** (WebGPU used only if present) → no SharedArrayBuffer /
  no cross-origin-isolation headers needed → also keeps GitHub Pages viable.
- int8-quantized model, SQLite loaded in-memory (no OPFS), small reference set (~1–2k).
- Responsive: 3D cloud on top, controls in a draggable bottom sheet; `dvh` units; ≥44px
  touch targets; one-finger orbit / pinch zoom / two-finger pan.

### iOS smoke checkpoint (manual gate — pending)
On a real iPhone (Safari), load the deployed/preview URL and confirm: model downloads with
progress and the tab does **not** crash (memory headroom); 3D cloud renders and touch
controls work; typing places a point and masking a chip drifts it. If memory crashes, lower
`PER_EMOTION` in `pipeline/build_dataset.py`, rebuild, retest — record the chosen size here.

| Date | Device / iOS | Model load | Memory OK | Touch OK | Reference size | Notes |
|---|---|---|---|---|---|---|
| _pending_ | | | | | | |

## Deployment

Static build → **Vercel** (`vercel.json` sets COOP). GitHub Pages also works since we don't
require cross-origin isolation. Ensure `vite build` copies `public/emotions.sqlite`,
`public/sql-wasm/`, and `public/models/` into `dist/`.

## Spec & plan
- Design: [`docs/superpowers/specs/2026-06-09-mechterp-emotion-embedding-explorer-design.md`](docs/superpowers/specs/2026-06-09-mechterp-emotion-embedding-explorer-design.md)
- Plan: [`docs/superpowers/plans/2026-06-09-mechterp-emotion-embedding-explorer.md`](docs/superpowers/plans/2026-06-09-mechterp-emotion-embedding-explorer.md)
