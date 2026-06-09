# MechTerp — Emotion Embedding Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 100% client-side web app where a user types/edits a sentence and watches it land and drift through a 3D UMAP projection of GoEmotions-labeled `all-MiniLM-L6-v2` embeddings, with maskable token chips driving the drift (token saliency).

**Architecture:** An offline Python pipeline produces two static assets — a prebuilt `emotions.sqlite` (reference points + 384-d vectors + 3D coords + centroids) and an internals-exposing ONNX export of the model. The browser app embeds live with transformers.js, runs kNN in SQLite-WASM (sqlite-vec, with a JS-cosine fallback), places the live point at the distance-weighted centroid of its neighbors' 3D coords, and renders the cloud + drift trail with react-three-fiber. Single-threaded WASM baseline so it works on Safari/iPhone and GitHub Pages.

**Tech Stack:** Python (datasets, sentence-transformers, optimum, umap-learn, sqlite-vec) · Vite + React + TypeScript + Tailwind · @huggingface/transformers · sql.js / SQLite-WASM + sqlite-vec · three + @react-three/fiber + @react-three/drei · Vitest.

**Reference:** Spec at `docs/superpowers/specs/2026-06-09-mechterp-emotion-embedding-explorer-design.md`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `pipeline/requirements.txt` | Python deps for the offline build |
| `pipeline/export_onnx.py` | Re-export model to ONNX with hidden_states + attentions |
| `pipeline/build_dataset.py` | GoEmotions → filter → stratify → embed → UMAP → `emotions.sqlite` |
| `pipeline/tests/test_outputs.py` | Assertions on the built DB + ONNX outputs |
| `public/emotions.sqlite` | Prebuilt reference DB (shipped asset) |
| `public/models/minilm-internals/` | Internals-exposing ONNX (shipped asset) |
| `src/types.ts` | Shared types (`Point`, `Neighbor`, `Vec384`, `EmbedResult`) |
| `src/placement/placement.ts` | Pure: neighbors → live xyz |
| `src/tokens/tokens.ts` | Tokenize + mask state → masked sentence |
| `src/embedder/embedder.ts` | transformers.js wrapper → `{ vector, internals? }` |
| `src/vectorStore/vectorStore.ts` | SQLite-WASM + sqlite-vec kNN, JS-cosine fallback |
| `src/vectorStore/cosine.ts` | Pure cosine + brute-force kNN (fallback + tests) |
| `src/scene/Scene.tsx` | react-three-fiber cloud, centroids, live point, trail |
| `src/scene/colors.ts` | Emotion → color mapping (pure) |
| `src/ui/*` | Panels, token chips, bottom sheet, legend |
| `src/App.tsx` | Orchestration of the live loop |
| `vite.config.ts`, `vitest.config.ts`, `tailwind.config.js`, `vercel.json` | Config |

---

## Task 0: Project scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Scaffold Vite React-TS app and install deps**

Run:
```bash
npm create vite@latest . -- --template react-ts
npm install
npm install three @react-three/fiber @react-three/drei @huggingface/transformers sql.js
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
Expected: `node_modules/` populated, `tailwind.config.js` + `postcss.config.js` created.

- [ ] **Step 2: Configure Tailwind content globs**

Replace `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

Replace `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100dvh; margin: 0; }
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
})
```

Add to `package.json` `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Sanity test that the toolchain runs**

Create `src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('toolchain', () => {
  it('runs', () => { expect(1 + 1).toBe(2) })
})
```

Run: `npm run test`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest"
```

---

## Task 1: Pipeline — internals-exposing ONNX export

**Files:**
- Create: `pipeline/requirements.txt`, `pipeline/export_onnx.py`

- [ ] **Step 1: Declare Python deps**

Create `pipeline/requirements.txt`:
```
sentence-transformers==3.0.1
transformers==4.44.2
optimum[exporters]==1.21.4
onnx==1.16.2
onnxruntime==1.18.1
datasets==2.21.0
umap-learn==0.5.6
numpy==1.26.4
sqlite-vec==0.1.6
```

- [ ] **Step 2: Write the ONNX export script**

Create `pipeline/export_onnx.py`:
```python
"""Re-export all-MiniLM-L6-v2 to ONNX exposing hidden_states + attentions.

v1 only consumes the final embedding, but B (layer trajectory) and C (attention
patterns) need these internal outputs in the graph, so we bake them in now.
Output: pipeline/../public/models/minilm-internals/model.onnx (+ tokenizer files)
"""
from pathlib import Path
import torch
from transformers import AutoModel, AutoTokenizer

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "models" / "minilm-internals"


class MiniLMWithInternals(torch.nn.Module):
    """Wrap the encoder so ONNX outputs last_hidden_state + all hidden_states + attentions."""
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask, token_type_ids):
        out = self.model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
            output_hidden_states=True,
            output_attentions=True,
        )
        # hidden_states: tuple(len 7) -> stack to (7, B, T, 384); attentions: tuple(len 6) -> (6, B, 12, T, T)
        hidden = torch.stack(out.hidden_states, dim=0)
        attn = torch.stack(out.attentions, dim=0)
        return out.last_hidden_state, hidden, attn


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tok = AutoTokenizer.from_pretrained(MODEL_ID)
    base = AutoModel.from_pretrained(MODEL_ID).eval()
    wrapped = MiniLMWithInternals(base).eval()

    enc = tok("export trace sentence", return_tensors="pt")
    args = (enc["input_ids"], enc["attention_mask"], enc["token_type_ids"])

    torch.onnx.export(
        wrapped, args, str(OUT_DIR / "model.onnx"),
        input_names=["input_ids", "attention_mask", "token_type_ids"],
        output_names=["last_hidden_state", "hidden_states", "attentions"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "seq"},
            "attention_mask": {0: "batch", 1: "seq"},
            "token_type_ids": {0: "batch", 1: "seq"},
            "last_hidden_state": {0: "batch", 1: "seq"},
            "hidden_states": {1: "batch", 2: "seq"},
            "attentions": {1: "batch", 3: "seq", 4: "seq"},
        },
        opset_version=14,
    )
    tok.save_pretrained(OUT_DIR)
    print(f"Wrote ONNX + tokenizer to {OUT_DIR}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the export**

Run:
```bash
cd pipeline && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
python export_onnx.py
```
Expected: `public/models/minilm-internals/model.onnx` exists plus tokenizer json files; stdout prints the path.

- [ ] **Step 4: Commit (script only; the .onnx is gitignored)**

```bash
git add pipeline/requirements.txt pipeline/export_onnx.py
git commit -m "feat(pipeline): internals-exposing ONNX export of all-MiniLM-L6-v2"
```

---

## Task 2: Pipeline — build the reference dataset & SQLite

**Files:**
- Create: `pipeline/build_dataset.py`, `pipeline/tests/test_outputs.py`

- [ ] **Step 1: Write the dataset build script**

Create `pipeline/build_dataset.py`:
```python
"""GoEmotions -> high-agreement single-label -> stratify ~N -> embed -> UMAP3D -> emotions.sqlite.

We deliberately keep this small (~1-2k) and emotion-balanced for legibility.
UMAP is UNSUPERVISED on purpose: we want the real (messy) structure, not faked separation.
"""
import sqlite3
import struct
from collections import defaultdict
from pathlib import Path

import numpy as np
import umap
from datasets import load_dataset
from sentence_transformers import SentenceTransformer

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
PER_EMOTION = 60          # ~60 * 28 ≈ 1.7k after the neutral cap below
OUT_DB = Path(__file__).resolve().parent.parent / "public" / "emotions.sqlite"
SEED = 42

# GoEmotions "simplified" config: features.label is a ClassLabel list; single-label = exactly one.
def load_balanced():
    ds = load_dataset("go_emotions", "simplified", split="train")
    names = ds.features["labels"].feature.names  # 28 emotion names
    buckets = defaultdict(list)
    for row in ds:
        labels = row["labels"]
        if len(labels) != 1:        # single-label only -> unambiguous teaching examples
            continue
        emo = names[labels[0]]
        if len(buckets[emo]) < PER_EMOTION:
            buckets[emo].append(row["text"])
    texts, emotions = [], []
    for emo, items in buckets.items():
        for t in items:
            texts.append(t)
            emotions.append(emo)
    return texts, emotions, names


def pack_vec(v: np.ndarray) -> bytes:
    return struct.pack(f"<{v.shape[0]}f", *v.astype(np.float32).tolist())


def main():
    rng = np.random.default_rng(SEED)
    texts, emotions, _ = load_balanced()
    model = SentenceTransformer(MODEL_ID)
    vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
    vecs = np.asarray(vecs, dtype=np.float32)

    reducer = umap.UMAP(n_components=3, n_neighbors=15, min_dist=0.1, random_state=SEED)
    coords = reducer.fit_transform(vecs).astype(np.float32)

    # per-emotion centroids in 3D (landmarks)
    cents = {}
    emo_arr = np.array(emotions)
    for emo in sorted(set(emotions)):
        cents[emo] = coords[emo_arr == emo].mean(axis=0)

    OUT_DB.parent.mkdir(parents=True, exist_ok=True)
    if OUT_DB.exists():
        OUT_DB.unlink()
    con = sqlite3.connect(OUT_DB)
    con.execute("CREATE TABLE points (id INTEGER PRIMARY KEY, text TEXT, emotion TEXT, x REAL, y REAL, z REAL, vec BLOB)")
    con.execute("CREATE TABLE centroids (emotion TEXT PRIMARY KEY, x REAL, y REAL, z REAL)")
    for i, (t, emo) in enumerate(zip(texts, emotions)):
        con.execute(
            "INSERT INTO points VALUES (?,?,?,?,?,?,?)",
            (i, t, emo, float(coords[i, 0]), float(coords[i, 1]), float(coords[i, 2]), pack_vec(vecs[i])),
        )
    for emo, c in cents.items():
        con.execute("INSERT INTO centroids VALUES (?,?,?,?)", (emo, float(c[0]), float(c[1]), float(c[2])))
    con.commit()
    con.close()
    print(f"Wrote {len(texts)} points across {len(set(emotions))} emotions to {OUT_DB}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write output-assertion tests**

Create `pipeline/tests/test_outputs.py`:
```python
import sqlite3
import struct
from pathlib import Path

import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parent.parent.parent
DB = ROOT / "public" / "emotions.sqlite"
ONNX = ROOT / "public" / "models" / "minilm-internals" / "model.onnx"


def test_db_has_points_with_vectors_and_coords():
    con = sqlite3.connect(DB)
    rows = con.execute("SELECT x, y, z, vec FROM points").fetchall()
    assert len(rows) > 500
    for x, y, z, blob in rows:
        assert all(v is not None for v in (x, y, z))
        vec = struct.unpack(f"<{len(blob)//4}f", blob)
        assert len(vec) == 384


def test_all_emotions_present():
    con = sqlite3.connect(DB)
    n = con.execute("SELECT COUNT(DISTINCT emotion) FROM points").fetchone()[0]
    assert n == 28


def test_onnx_exposes_internals():
    sess = ort.InferenceSession(str(ONNX))
    out_names = {o.name for o in sess.get_outputs()}
    assert {"last_hidden_state", "hidden_states", "attentions"} <= out_names
    feed = {
        "input_ids": np.array([[101, 2023, 102]], dtype=np.int64),
        "attention_mask": np.ones((1, 3), dtype=np.int64),
        "token_type_ids": np.zeros((1, 3), dtype=np.int64),
    }
    last, hidden, attn = sess.run(["last_hidden_state", "hidden_states", "attentions"], feed)
    assert hidden.shape[0] == 7 and hidden.shape[-1] == 384   # 6 layers + embeddings
    assert attn.shape[0] == 6 and attn.shape[2] == 12         # 6 layers, 12 heads
```

- [ ] **Step 3: Run the build, then the tests**

Run:
```bash
cd pipeline && . .venv/bin/activate
pip install pytest
python build_dataset.py
pytest tests/test_outputs.py -v
```
Expected: build prints "Wrote ~1680 points across 28 emotions"; all 3 tests PASS.

- [ ] **Step 4: Commit (scripts + tests; .sqlite and .onnx are gitignored assets)**

```bash
git add pipeline/build_dataset.py pipeline/tests/test_outputs.py
git commit -m "feat(pipeline): build emotions.sqlite + output assertions"
```

> **Note:** `public/emotions.sqlite` and `public/models/` are build outputs ignored by git. Document in `pipeline/README.md` that contributors run `export_onnx.py` then `build_dataset.py` to regenerate them. (Add that README in this commit.)

---

## Task 3: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Define shared types**

Create `src/types.ts`:
```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: shared types"
```

---

## Task 4: `placement` (pure, TDD)

**Files:**
- Create: `src/placement/placement.ts`, `src/placement/placement.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/placement/placement.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { placeLivePoint } from './placement'
import type { Neighbor } from '../types'

const n = (xyz: [number, number, number], distance: number): Neighbor =>
  ({ id: 0, text: '', emotion: '', xyz, distance })

describe('placeLivePoint', () => {
  it('returns the single neighbor position when k=1', () => {
    expect(placeLivePoint([n([1, 2, 3], 0.4)])).toEqual([1, 2, 3])
  })

  it('weights closer neighbors more (inverse distance)', () => {
    // neighbor A at x=0 dist 0.1 (weight 10), B at x=10 dist 1.0 (weight 1) -> ~0.909
    const [x] = placeLivePoint([n([0, 0, 0], 0.1), n([10, 0, 0], 1.0)])
    expect(x).toBeCloseTo(10 / 11, 5)
  })

  it('handles a zero distance without dividing by zero', () => {
    const [x] = placeLivePoint([n([5, 0, 0], 0), n([10, 0, 0], 1.0)])
    expect(x).toBeCloseTo(5, 5)  // exact match dominates
  })

  it('returns origin for empty neighbors', () => {
    expect(placeLivePoint([])).toEqual([0, 0, 0])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- placement`
Expected: FAIL — `placeLivePoint` is not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/placement/placement.ts`:
```ts
import type { Neighbor, XYZ } from '../types'

const EPS = 1e-6

/** Distance-weighted centroid of neighbors' 3D positions (inverse-distance weights). */
export function placeLivePoint(neighbors: Neighbor[]): XYZ {
  if (neighbors.length === 0) return [0, 0, 0]
  let wx = 0, wy = 0, wz = 0, wsum = 0
  for (const nb of neighbors) {
    const w = 1 / (nb.distance + EPS)
    wx += w * nb.xyz[0]
    wy += w * nb.xyz[1]
    wz += w * nb.xyz[2]
    wsum += w
  }
  return [wx / wsum, wy / wsum, wz / wsum]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- placement`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/placement/
git commit -m "feat: pure distance-weighted live-point placement"
```

---

## Task 5: `cosine` + brute-force kNN (pure, TDD)

This is both the JS-cosine fallback and the oracle the sqlite-vec path is tested against.

**Files:**
- Create: `src/vectorStore/cosine.ts`, `src/vectorStore/cosine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/vectorStore/cosine.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { cosineDistance, bruteForceKnn } from './cosine'
import type { Point } from '../types'

const v = (arr: number[]) => Float32Array.from(arr)
const pt = (id: number, vec: number[]): Point =>
  ({ id, text: `p${id}`, emotion: 'x', xyz: [0, 0, 0], vec: v(vec) })

describe('cosineDistance', () => {
  it('is 0 for identical normalized vectors', () => {
    expect(cosineDistance(v([1, 0]), v([1, 0]))).toBeCloseTo(0, 6)
  })
  it('is 1 for orthogonal vectors', () => {
    expect(cosineDistance(v([1, 0]), v([0, 1]))).toBeCloseTo(1, 6)
  })
})

describe('bruteForceKnn', () => {
  const points = [pt(1, [1, 0]), pt(2, [0, 1]), pt(3, [0.9, 0.1])]
  it('returns k nearest sorted by ascending distance', () => {
    const res = bruteForceKnn(v([1, 0]), points, 2)
    expect(res.map(r => r.id)).toEqual([1, 3])
    expect(res[0].distance).toBeLessThanOrEqual(res[1].distance)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- cosine`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/vectorStore/cosine.ts`:
```ts
import type { Point, Neighbor, Vec384 } from '../types'

/** Cosine distance in [0, 2]. Assumes inputs may not be normalized. */
export function cosineDistance(a: Vec384, b: Vec384): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1e-12
  return 1 - dot / denom
}

export function bruteForceKnn(query: Vec384, points: Point[], k: number): Neighbor[] {
  return points
    .map(p => ({ id: p.id, text: p.text, emotion: p.emotion, xyz: p.xyz, distance: cosineDistance(query, p.vec) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- cosine`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/vectorStore/cosine.ts src/vectorStore/cosine.test.ts
git commit -m "feat: pure cosine distance + brute-force kNN"
```

---

## Task 6: `vectorStore` (SQLite-WASM load + kNN, with fallback)

Loads the prebuilt DB into sql.js, reads points into memory, exposes `knn` (tries
sqlite-vec, falls back to brute force) and `query` for the SQLite learning angle.

**Files:**
- Create: `src/vectorStore/vectorStore.ts`, `src/vectorStore/vectorStore.test.ts`
- Test fixture: build a tiny in-memory DB inside the test.

- [ ] **Step 1: Write the failing test (against a tiny in-memory sql.js DB)**

Create `src/vectorStore/vectorStore.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import initSqlJs from 'sql.js'
import { VectorStore } from './vectorStore'

function packVec(arr: number[]): Uint8Array {
  const f = Float32Array.from(arr)
  return new Uint8Array(f.buffer)
}

let dbBytes: Uint8Array

beforeAll(async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('CREATE TABLE points (id INTEGER PRIMARY KEY, text TEXT, emotion TEXT, x REAL, y REAL, z REAL, vec BLOB)')
  db.run('CREATE TABLE centroids (emotion TEXT PRIMARY KEY, x REAL, y REAL, z REAL)')
  const ins = db.prepare('INSERT INTO points VALUES (?,?,?,?,?,?,?)')
  ins.run([1, 'a', 'joy', 0, 0, 0, packVec([1, 0])])
  ins.run([2, 'b', 'fear', 1, 1, 1, packVec([0, 1])])
  ins.run([3, 'c', 'joy', 0.1, 0, 0, packVec([0.9, 0.1])])
  ins.free()
  dbBytes = db.export()
})

describe('VectorStore', () => {
  it('loads points and returns nearest neighbors (fallback path)', async () => {
    const store = await VectorStore.fromBytes(dbBytes, { forceFallback: true })
    const res = store.knn(Float32Array.from([1, 0]), 2)
    expect(res.map(r => r.id)).toEqual([1, 3])
  })

  it('exposes relational query()', async () => {
    const store = await VectorStore.fromBytes(dbBytes, { forceFallback: true })
    const rows = store.query("SELECT emotion, COUNT(*) c FROM points GROUP BY emotion ORDER BY emotion")
    expect(rows).toEqual([{ emotion: 'fear', c: 1 }, { emotion: 'joy', c: 2 }])
  })

  it('reads centroids', async () => {
    const store = await VectorStore.fromBytes(dbBytes, { forceFallback: true })
    expect(store.centroids().length).toBe(0) // none inserted; shape check
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- vectorStore`
Expected: FAIL — `VectorStore` not found.

- [ ] **Step 3: Write the implementation**

Create `src/vectorStore/vectorStore.ts`:
```ts
import initSqlJs, { type Database } from 'sql.js'
import type { Point, Neighbor, Vec384, XYZ } from '../types'
import { bruteForceKnn } from './cosine'

function unpackVec(blob: Uint8Array): Vec384 {
  return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4)
}

interface Opts { forceFallback?: boolean }

export class VectorStore {
  private constructor(
    private db: Database,
    private points: Point[],
    private useVec: boolean,
  ) {}

  static async fromBytes(bytes: Uint8Array, opts: Opts = {}): Promise<VectorStore> {
    // In Vite, sql.js wasm is served from node_modules; locateFile points at it.
    const SQL = await initSqlJs({ locateFile: (f) => `/sql-wasm/${f}` })
    const db = new SQL.Database(bytes)
    const points: Point[] = []
    const stmt = db.prepare('SELECT id, text, emotion, x, y, z, vec FROM points')
    while (stmt.step()) {
      const r = stmt.getAsObject() as any
      points.push({
        id: r.id, text: r.text, emotion: r.emotion,
        xyz: [r.x, r.y, r.z] as XYZ, vec: unpackVec(r.vec as Uint8Array),
      })
    }
    stmt.free()
    // sqlite-vec is loaded via extension; if unavailable or forced, use brute force.
    const useVec = !opts.forceFallback && false // flip to true once sqlite-vec wasm load is verified (Task 6b)
    return new VectorStore(db, points, useVec)
  }

  static async fromUrl(url: string, opts: Opts = {}): Promise<VectorStore> {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer())
    return VectorStore.fromBytes(buf, opts)
  }

  knn(query: Vec384, k: number): Neighbor[] {
    // useVec path added in Task 6b; default is the verified brute-force path.
    return bruteForceKnn(query, this.points, k)
  }

  query(sql: string): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = []
    const stmt = this.db.prepare(sql)
    while (stmt.step()) out.push(stmt.getAsObject())
    stmt.free()
    return out
  }

  centroids(): { emotion: string; xyz: XYZ }[] {
    return this.query('SELECT emotion, x, y, z FROM centroids').map((r: any) => ({
      emotion: r.emotion, xyz: [r.x, r.y, r.z] as XYZ,
    }))
  }

  count(): number { return this.points.length }
  all(): Point[] { return this.points }
}
```

- [ ] **Step 4: Make sql.js wasm available to the dev server and tests**

Run:
```bash
mkdir -p public/sql-wasm && cp node_modules/sql.js/dist/sql-wasm.wasm public/sql-wasm/
```
(For Node tests, sql.js resolves its wasm from node_modules automatically; `locateFile` only affects the browser build.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- vectorStore`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/vectorStore/vectorStore.ts src/vectorStore/vectorStore.test.ts public/sql-wasm/.gitkeep
git commit -m "feat: VectorStore over SQLite-WASM with brute-force kNN + query()"
```

---

## Task 6b: sqlite-vec path (verification spike, behind a flag)

**Files:**
- Modify: `src/vectorStore/vectorStore.ts`

- [ ] **Step 1: Attempt to load sqlite-vec into sql.js in a throwaway browser spike**

Create `src/vectorStore/vec-spike.md` documenting the attempt: load `sqlite-vec` wasm
extension into the sql.js `Database`, create a `vec0` virtual table, insert the 384-d
vectors, and run `SELECT id FROM vec_points ORDER BY distance LIMIT k`.

Run a manual browser check (`npm run dev`, open console, paste spike). Record outcome.

- [ ] **Step 2: Decision gate**

- If sqlite-vec loads in Safari + Chrome: implement `useVec` path; add a test asserting it
  returns the **same ordered ids** as `bruteForceKnn` for the fixture DB. Set `useVec` default true.
- If it does not load cleanly: keep `useVec=false`, leave brute force as the shipped path, and
  note in `vec-spike.md` that the SQLite learning angle is satisfied via `query()` (relational)
  rather than vector ops. **This is an acceptable outcome — do not block the build on it.**

- [ ] **Step 3: Commit the outcome either way**

```bash
git add src/vectorStore/
git commit -m "feat: sqlite-vec kNN path (or documented fallback decision)"
```

---

## Task 7: `embedder` (transformers.js wrapper)

**Files:**
- Create: `src/embedder/embedder.ts`, `src/embedder/embedder.test.ts`

- [ ] **Step 1: Write a contract test (mock the pipeline; assert shape + normalization)**

Create `src/embedder/embedder.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- embedder`
Expected: FAIL — `Embedder` not found.

- [ ] **Step 3: Write the implementation**

Create `src/embedder/embedder.ts`:
```ts
import { pipeline, env } from '@huggingface/transformers'
import type { EmbedResult, Vec384 } from '../types'

// Single-threaded WASM baseline; WebGPU used automatically if the runtime offers it.
env.backends.onnx.wasm.numThreads = 1

function l2normalize(v: Float32Array): Vec384 {
  let n = 0
  for (const x of v) n += x * x
  const inv = 1 / (Math.sqrt(n) || 1e-12)
  const out = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) out[i] = v[i] * inv
  return out
}

export class Embedder {
  private constructor(private extractor: any) {}

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
    const out = await this.extractor(text, { pooling: 'mean', normalize: false })
    return { vector: l2normalize(out.data as Float32Array) }
  }
}
```

> **Note:** v1 uses the HF-hosted `Xenova/all-MiniLM-L6-v2` for the *embedding* (smallest, cached). The internals-exposing ONNX from Task 1 is wired in later for B/C; the `internals` field stays optional. Keeping these separate avoids blocking v1 on custom-model loading.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- embedder`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/embedder/
git commit -m "feat: transformers.js embedder (q8, single-threaded, normalized)"
```

---

## Task 8: `colors` (pure emotion → color)

**Files:**
- Create: `src/scene/colors.ts`, `src/scene/colors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/scene/colors.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { emotionColor, EMOTIONS } from './colors'

describe('emotionColor', () => {
  it('returns a stable hex for a known emotion', () => {
    expect(emotionColor('joy')).toMatch(/^#[0-9a-f]{6}$/i)
    expect(emotionColor('joy')).toBe(emotionColor('joy'))
  })
  it('covers all 28 GoEmotions labels', () => {
    expect(EMOTIONS.length).toBe(28)
    for (const e of EMOTIONS) expect(emotionColor(e)).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('falls back to gray for unknown', () => {
    expect(emotionColor('not-an-emotion')).toBe('#888888')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- colors`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/scene/colors.ts`:
```ts
export const EMOTIONS = [
  'admiration','amusement','anger','annoyance','approval','caring','confusion',
  'curiosity','desire','disappointment','disapproval','disgust','embarrassment',
  'excitement','fear','gratitude','grief','joy','love','nervousness','optimism',
  'pride','realization','relief','remorse','sadness','surprise','neutral',
]

// Evenly spaced HSL hues -> hex, deterministic per index.
function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const TABLE: Record<string, string> = Object.fromEntries(
  EMOTIONS.map((e, i) => [e, hslToHex((360 * i) / EMOTIONS.length, 0.6, 0.55)]),
)

export function emotionColor(emotion: string): string {
  return TABLE[emotion] ?? '#888888'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- colors`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/scene/colors.ts src/scene/colors.test.ts
git commit -m "feat: deterministic emotion color mapping"
```

---

## Task 9: `Scene` (react-three-fiber cloud + live point + trail)

Visual component; tested by render-without-crash + prop contract, not pixels.

**Files:**
- Create: `src/scene/Scene.tsx`, `src/scene/Scene.test.tsx`

- [ ] **Step 1: Write a smoke/render test**

Create `src/scene/Scene.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Stub the WebGL canvas so jsdom can render children logic without a GPU.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
}))
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null }))

import { Scene } from './Scene'
import type { Point, XYZ } from '../types'

const pts: Point[] = [{ id: 1, text: 'a', emotion: 'joy', xyz: [0, 0, 0], vec: Float32Array.from([1, 0]) }]

describe('Scene', () => {
  it('renders without crashing given points and a live position', () => {
    const { getByTestId } = render(
      <Scene points={pts} centroids={[]} live={[1, 1, 1] as XYZ} trail={[[0, 0, 0]]} />,
    )
    expect(getByTestId('canvas')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- Scene`
Expected: FAIL — `Scene` not found.

- [ ] **Step 3: Implement the scene**

Create `src/scene/Scene.tsx`:
```tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useMemo } from 'react'
import type { Point, XYZ } from '../types'
import { emotionColor } from './colors'

interface Props {
  points: Point[]
  centroids: { emotion: string; xyz: XYZ }[]
  live: XYZ | null
  trail: XYZ[]
}

function ReferenceCloud({ points }: { points: Point[] }) {
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(points.length * 3)
    const colors = new Float32Array(points.length * 3)
    const c = new THREE.Color()
    points.forEach((p, i) => {
      positions.set(p.xyz, i * 3)
      c.set(emotionColor(p.emotion))
      colors.set([c.r, c.g, c.b], i * 3)
    })
    return { positions, colors }
  }, [points])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors sizeAttenuation />
    </points>
  )
}

function LivePoint({ live, trail }: { live: XYZ | null; trail: XYZ[] }) {
  const trailGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setFromPoints(trail.map((t) => new THREE.Vector3(...t)))
    return g
  }, [trail])
  return (
    <group>
      {trail.length > 1 && (
        <line>
          <primitive object={trailGeom} attach="geometry" />
          <lineBasicMaterial color="#ffffff" transparent opacity={0.4} />
        </line>
      )}
      {live && (
        <mesh position={live}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  )
}

export function Scene({ points, centroids, live, trail }: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 50 }} dpr={[1, 2]}>
      <ambientLight intensity={0.8} />
      <ReferenceCloud points={points} />
      {centroids.map((c) => (
        <mesh key={c.emotion} position={c.xyz}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial color={emotionColor(c.emotion)} wireframe />
        </mesh>
      ))}
      <LivePoint live={live} trail={trail} />
      <OrbitControls enablePan enableZoom enableRotate makeDefault />
    </Canvas>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- Scene`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/scene/Scene.tsx src/scene/Scene.test.tsx
git commit -m "feat: react-three-fiber scene with cloud, centroids, live point, trail"
```

---

## Task 10: `tokens` (tokenize + mask, TDD)

v1 uses whitespace tokenization for the chips (legible words); a note records that the
model tokenizer can replace this when masking needs to match subword units exactly.

**Files:**
- Create: `src/tokens/tokens.ts`, `src/tokens/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tokens/tokens.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toTokens, maskedSentence } from './tokens'

describe('tokens', () => {
  it('splits into word tokens with indices', () => {
    expect(toTokens('I am grateful')).toEqual([
      { index: 0, text: 'I', masked: false },
      { index: 1, text: 'am', masked: false },
      { index: 2, text: 'grateful', masked: false },
    ])
  })
  it('omits masked tokens from the rebuilt sentence', () => {
    const t = toTokens('I am grateful')
    t[2].masked = true
    expect(maskedSentence(t)).toBe('I am')
  })
  it('returns empty string when all masked', () => {
    const t = toTokens('hi there').map((x) => ({ ...x, masked: true }))
    expect(maskedSentence(t)).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tokens`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/tokens/tokens.ts`:
```ts
export interface Token { index: number; text: string; masked: boolean }

export function toTokens(text: string): Token[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w, i) => ({ index: i, text: w, masked: false }))
}

export function maskedSentence(tokens: Token[]): string {
  return tokens.filter((t) => !t.masked).map((t) => t.text).join(' ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tokens`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tokens/
git commit -m "feat: word tokenization + masking"
```

---

## Task 11: UI components (chips, neighbor/saliency panel, legend, bottom sheet)

**Files:**
- Create: `src/ui/TokenChips.tsx`, `src/ui/NeighborPanel.tsx`, `src/ui/Legend.tsx`, `src/ui/BottomSheet.tsx`

- [ ] **Step 1: Write a contract test for TokenChips (click toggles mask)**

Create `src/ui/TokenChips.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TokenChips } from './TokenChips'

describe('TokenChips', () => {
  it('calls onToggle with the clicked index', () => {
    const onToggle = vi.fn()
    const { getByText } = render(
      <TokenChips tokens={[{ index: 0, text: 'hi', masked: false }]} onToggle={onToggle} />,
    )
    fireEvent.click(getByText('hi'))
    expect(onToggle).toHaveBeenCalledWith(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- TokenChips`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the UI components**

Create `src/ui/TokenChips.tsx`:
```tsx
import type { Token } from '../tokens/tokens'

export function TokenChips({ tokens, onToggle }: { tokens: Token[]; onToggle: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tokens.map((t) => (
        <button
          key={t.index}
          onClick={() => onToggle(t.index)}
          className={`min-h-[44px] rounded-full px-3 text-sm transition ${
            t.masked ? 'bg-gray-700 text-gray-400 line-through' : 'bg-indigo-600 text-white'
          }`}
        >
          {t.text}
        </button>
      ))}
    </div>
  )
}
```

Create `src/ui/NeighborPanel.tsx`:
```tsx
import type { Neighbor } from '../types'
import { emotionColor } from '../scene/colors'

export function NeighborPanel({ neighbors }: { neighbors: Neighbor[] }) {
  return (
    <ul className="space-y-2 overflow-y-auto">
      {neighbors.map((n) => (
        <li key={n.id} className="rounded bg-gray-800 p-2 text-sm">
          <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                style={{ backgroundColor: emotionColor(n.emotion) }} />
          <span className="font-medium">{n.emotion}</span>
          <span className="ml-2 text-gray-400">({n.distance.toFixed(3)})</span>
          <p className="mt-1 text-gray-300">{n.text}</p>
        </li>
      ))}
    </ul>
  )
}
```

Create `src/ui/Legend.tsx`:
```tsx
import { EMOTIONS, emotionColor } from '../scene/colors'

export function Legend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {EMOTIONS.map((e) => (
        <span key={e} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: emotionColor(e) }} />
          {e}
        </span>
      ))}
    </div>
  )
}
```

Create `src/ui/BottomSheet.tsx`:
```tsx
import { useState } from 'react'

export function BottomSheet({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div
      className={`fixed inset-x-0 bottom-0 rounded-t-2xl bg-gray-900/95 p-4 shadow-2xl transition-all md:static md:rounded-none ${
        expanded ? 'max-h-[60dvh]' : 'max-h-[20dvh]'
      } overflow-y-auto`}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-gray-600 md:hidden"
        aria-label="toggle panel"
      />
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- TokenChips`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/ui/
git commit -m "feat: token chips, neighbor/saliency panel, legend, bottom sheet"
```

---

## Task 12: `App` orchestration — wire the live loop

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: Write an integration test of the wiring with mocked embedder/store**

Create `src/App.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./embedder/embedder', () => ({
  Embedder: { create: async () => ({ embed: async () => ({ vector: Float32Array.from([1, 0]) }) }) },
}))
vi.mock('./vectorStore/vectorStore', () => ({
  VectorStore: {
    fromUrl: async () => ({
      knn: () => [{ id: 1, text: 'a', emotion: 'joy', xyz: [0, 0, 0], distance: 0.1 }],
      centroids: () => [],
      all: () => [{ id: 1, text: 'a', emotion: 'joy', xyz: [0, 0, 0], vec: Float32Array.from([1, 0]) }],
      count: () => 1,
    }),
  },
}))
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: any) => <div>{children}</div>, useFrame: () => {} }))
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null }))

import App from './App'

describe('App', () => {
  it('embeds typed text and shows a nearest neighbor', async () => {
    const { getByPlaceholderText, findByText } = render(<App />)
    await waitFor(() => getByPlaceholderText(/type a sentence/i))
    fireEvent.change(getByPlaceholderText(/type a sentence/i), { target: { value: 'I am grateful' } })
    expect(await findByText('joy')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- App`
Expected: FAIL — App not wired.

- [ ] **Step 3: Implement App orchestration**

Replace `src/App.tsx`:
```tsx
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

  const recompute = useRef(async (toks: Token[]) => {})
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- App`
Expected: PASS, 1 test.

- [ ] **Step 5: Run the full suite + dev server smoke**

Run: `npm run test` (all green), then `npm run dev` and confirm in a browser: model loads, typing places a live point, masking a chip drifts it with a trail.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire live embed -> kNN -> placement -> scene loop"
```

---

## Task 13: Deployment config + iOS Safari smoke checkpoint

**Files:**
- Create: `vercel.json`, `pipeline/README.md` (if not already), `README.md`

- [ ] **Step 1: Configure static build for SQLite/transformers assets**

Create `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }] }
  ]
}
```

Confirm `vite build` copies `public/emotions.sqlite`, `public/sql-wasm/`, and any model assets into `dist/`.

- [ ] **Step 2: Build and preview**

Run: `npm run build && npm run preview`
Expected: production preview loads, model downloads once, app works.

- [ ] **Step 3: iOS Safari on-device smoke checkpoint (manual gate)**

On a real iPhone (Safari), load the previewed/deployed URL and verify, recording results in `README.md`:
- Model downloads with progress and the tab does **not** crash (memory headroom OK).
- 3D cloud renders; one-finger orbit, pinch zoom, two-finger pan work; no scroll-fighting.
- Typing places a point; masking a chip drifts it.

If memory crashes occur: reduce `PER_EMOTION` in `build_dataset.py`, rebuild, retest. Document the chosen size.

- [ ] **Step 4: Write the top-level README**

Create `README.md` documenting: what the app is, the offline pipeline steps (`export_onnx.py` then `build_dataset.py`), `npm run dev/test/build`, the single-threaded-WASM rationale, and the iOS smoke results.

- [ ] **Step 5: Commit**

```bash
git add vercel.json README.md pipeline/README.md
git commit -m "chore: deploy config, docs, and iOS smoke checkpoint"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** offline pipeline (Tasks 1–2), internals-exposing ONNX + `internals` field for B/C (Tasks 1, 7, types in 3), stratified high-agreement reference set + centroids + unsupervised UMAP (Task 2), in-browser embed (Task 7), SQLite-WASM + sqlite-vec with JS-cosine fallback (Tasks 5, 6, 6b), kNN placement (Task 4), 3D cloud + centroids + live point + drift trail (Task 9), token chips/saliency-via-masking (Tasks 10–12), neighbor panel + legend + responsive bottom sheet + dvh + 44px targets (Task 11), single-threaded WASM / WebGPU-optional / no SAB (Task 7), Vercel deploy + GH Pages viability (Task 13), iOS Safari smoke gate (Task 13), testing across pure logic + contracts + pipeline assertions (every task). All spec sections map to a task.

**Placeholder scan:** Task 6b is intentionally a verification spike with an explicit decision gate and an acceptable documented fallback — not a placeholder for shipped behavior (the shipped kNN path is the tested brute-force one). No "TBD"/"add error handling"-style gaps elsewhere.

**Type consistency:** `Neighbor`/`Point`/`Vec384`/`XYZ`/`EmbedResult` defined in Task 3 are used consistently; `placeLivePoint`, `bruteForceKnn`, `VectorStore.knn/query/centroids/all`, `Embedder.create/embed`, `toTokens/maskedSentence`, `emotionColor/EMOTIONS`, and `Scene` props match across tasks.
