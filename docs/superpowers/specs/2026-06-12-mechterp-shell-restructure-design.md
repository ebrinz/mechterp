# MechTerp — App Shell Restructure (Intro + Stages) Design

**Date:** 2026-06-12
**Status:** Approved design, ready for implementation planning
**Project root:** `/Users/crashy/Development/mechterp`

## Purpose

Reframe the live app from a single embedding explorer into a **guided introduction to
mechanistic interpretability** with a persistent nav and routed stages. This is the "MechTerp
intro" structure: an Intro landing, **Stage 1 — Embeddings** (the current explorer, moved onto
its own route), and **Stage 2 — Internals** (attention patterns), which ships here only as a
polished teaser. The real Stage 2 attention view is a **separate, follow-up spec/plan**.

This restructure is deliberately low-risk and mostly mechanical so the new structure goes live
quickly without bottlenecking on Stage 2's heavier engineering.

## Scope

### In scope
- `react-router-dom` (v7) routing with a shared layout.
- A slim persistent **NavHeader** (wordmark + Intro / Stage 1 / Stage 2 links, active state).
- **Intro** landing page (`/`).
- **Stage 1** (`/embeddings`): today's explorer moved as-is (logic unchanged; height adapts).
- **Stage 2** (`/internals`): a "coming soon" teaser (what's coming + a CSS/SVG attention-grid
  mock + back link) — intentional, not empty.
- Full mobile responsiveness for all new pieces.
- Vercel SPA rewrite so deep links / refresh work on sub-routes.

### Explicitly out of scope (separate next spec)
- The actual Stage 2 attention view: running the 90 MB internals ONNX in the browser
  (onnxruntime-web), WordPiece tokenization, attention-tensor extraction, heatmap/arc UI with
  layer+head selectors, and hosting the internals model (likely HF Hub).
- Re-introducing point-level hover inspection in Stage 1 (deferred earlier; revisit later as a
  robust click-to-inspect).

## Routes & navigation

| Route | Page | Desktop nav label | Mobile nav label |
|---|---|---|---|
| `/` | Intro landing | Intro | Intro |
| `/embeddings` | Stage 1 — the current explorer | Stage 1 · Embeddings | Stage 1 |
| `/internals` | Stage 2 — attention teaser | Stage 2 · Internals | Stage 2 |

**NavHeader:** `MechTerp` wordmark on the left (links to `/`); the three links on the right with
the active route highlighted. Slim (~52px) so Stage 1's 3D keeps its space. Labels shorten on
mobile (full "· Embeddings / · Internals" only at `md+`); each link is a ≥44px tap target; the
bar never wraps awkwardly. Wordmark text is literally **"MechTerp"**; the tagline
("An introduction to mechanistic interpretability") lives on the Intro page.

## Layout

A column shell: `NavHeader` (fixed ~52px) on top, route content fills the rest (`flex-1`).
Stage 1's current full-screen flex (3D + side panel / bottom sheet) becomes that `flex-1`
region — its outer container changes from `h-[100dvh]` to filling `flex-1` / `h-full`; nothing
else about the explorer changes.

## Page content

**Intro (`/`)** — centered landing, dark theme:
- `MechTerp` + tagline "An introduction to mechanistic interpretability."
- 2–3 sentences: explores how a small language model (`all-MiniLM-L6-v2`) represents and
  processes *emotion* (GoEmotions), starting from its black-box embeddings and working toward
  its internal mechanics.
- Two cards: **Stage 1 · Embedding Space →** (live link) and **Stage 2 · Internals** (badged
  "coming soon", links to the teaser).
- Cards stack to one column on mobile, side-by-side at `md+`; `dvh`-based; scrolls if short.

**Stage 1 (`/embeddings`)** — exactly today's explorer (embed → kNN → 3D drift + neighbor panel
+ centroid hover-reveal), unchanged, now beneath the header.

**Stage 2 (`/internals`)** — a teaser:
- Short "what's coming": attention patterns (which tokens attend to which, per layer/head) and
  layer trajectory, read from the model's exposed internals.
- A simple **CSS/SVG mock of an attention grid** as a visual placeholder (`max-w-full`, scales
  on mobile).
- A "← Back to Stage 1" link.

## Routing tech & deploy

- `react-router-dom` v7: `BrowserRouter` wrapping a layout route (`AppLayout` renders
  `NavHeader` + `<Outlet/>`), with child routes for the three pages.
- **Vercel SPA rewrite** in `vercel.json`: `"rewrites": [{ "source": "/(.*)", "destination":
  "/index.html" }]`. Vercel serves real files via filesystem priority first, so
  `emotions.sqlite`, `/sql-wasm/*`, and hashed assets are unaffected; only unmatched routes fall
  through to `index.html`.

## File structure

```
src/
├─ main.tsx              # wrap app in <BrowserRouter>
├─ AppLayout.tsx         # NavHeader + <Outlet/>  (new root; replaces App.tsx as root)
├─ ui/NavHeader.tsx      # persistent nav (responsive labels, active state)
├─ routes/
│  ├─ Intro.tsx          # landing (/)
│  ├─ Embeddings.tsx     # today's explorer, moved from App.tsx (height → flex-1)
│  └─ Internals.tsx      # Stage 2 teaser
└─ … (embedder/, vectorStore/, placement/, tokens/, scene/, ui/ unchanged)
```

`src/App.tsx`'s explorer logic moves verbatim into `src/routes/Embeddings.tsx` (only the outer
height class changes). `App.test.tsx` / `App.loaderror.test.tsx` adapt to the moved file.

## Testing

- **NavHeader:** renders the three links; highlights the active route.
- **Routing (MemoryRouter, heavy deps mocked):** `/` → Intro; `/embeddings` → explorer (the
  existing embed-text → neighbor assertion still passes against the moved component);
  `/internals` → teaser text present.
- **Intro / Internals:** render expected headings and links.
- Keep the existing pure-logic + module-contract tests untouched.
- **Manual/Playwright gate before deploy:** all three routes render at desktop **and** 390px
  mobile widths; Stage 1's 3D + bottom sheet still fit under the header on a phone; deep-link
  refresh on `/embeddings` and `/internals` works on the Vercel deploy.

## Verification & rollout
- `npm run test` green; `npm run build` type-checks.
- Playwright check of all three routes at 1280px and 390px; screenshot review.
- Deploy to Vercel; confirm deep-link refresh works (SPA rewrite).
- Stage 2 attention view proceeds as its own spec → plan afterward.
