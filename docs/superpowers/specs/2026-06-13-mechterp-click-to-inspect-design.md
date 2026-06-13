# MechTerp — Stage 1 Click-to-Inspect Design

**Date:** 2026-06-13
**Status:** Approved design, ready for implementation planning
**Project root:** `/Users/crashy/Development/mechterp`

## Purpose

Let users **inspect individual reference points** in the Stage 1 embedding cloud (`/embeddings`):
hover (desktop) or tap (mobile) a point to see what it is, and click/tap it to focus on it —
showing its full text, emotion, and *its own* nearest neighbors. This replaces the deferred,
unreliable point-hover attempt (r3f never raycast the `<points>` object) with a robust
**screen-space** picker, and surfaces results in the existing side panel rather than a fragile
3D tooltip.

## Background (why the previous attempt failed)

The earlier hover used three.js `Points.raycast` via r3f pointer events with a world-space
`threshold`. Instrumentation proved the handler **never fired** for the `<points>` object
(while centroid `<mesh>` handlers fired fine). Rather than keep fighting `Points.raycast`, this
design picks in **screen space** (project points to pixels, choose the nearest to the cursor),
which is deterministic, matches what the user sees, and avoids three's Points-events quirks.

## Scope

### In scope
- Screen-space point picking inside the Stage 1 Scene (hover highlight on desktop; tap on mobile).
- A single **focus model**: the panel shows the neighborhood of one thing — the typed live point
  OR a clicked reference point (whichever was last).
- An **inspected-point card** (full text + emotion + clear) above the neighbor list when a point
  is focused; the focused point gets a halo in 3D.
- Clicking empty space clears point-focus back to the typed state.

### Out of scope
- Stage 2 internals/attention (separate spec).
- Centroid interaction changes (the existing hover-reveal labels stay as-is).
- Any change to the typed embed → kNN → drift-trail flow beyond the focus switch.

## Focus model

A single `focus` drives the side panel and the 3D highlight:
- **Typed focus** (unchanged): typing/masking → embed → live white point + `store.knn(vector, K)`
  neighbors + drift trail.
- **Point focus** (new): clicking/tapping reference point `id` → `focus = { kind: 'point', id }`;
  neighbors become `store.knn(points[id].vec, K)`; the panel shows an inspected-point card
  (the point's text + emotion); the point gets a halo.
- Switching: typing returns focus to typed (clears the point halo + inspected card); clicking
  empty space clears point-focus.

Mutually exclusive — "the cloud always shows the neighborhood of one thing."

## Picking (screen-space)

A picker lives **inside** the Canvas (needs `useThree` for `camera` + `size`). The reference
points are rendered inside a recentering group (`position = -cloudCenter`), so the picker
projects each point's **recentered** world position (`p.xyz - cloudCenter`) via `camera` to NDC,
converts to pixels, and selects the point whose pixel distance to the cursor is smallest within
a **~14px radius** (null if none).

- **Desktop:** pointer-move updates a hover highlight (+ `cursor: pointer` when over a point);
  click commits focus via `onPickPoint(id)`.
- **Mobile:** tap commits (no hover state).
- 1650 projections per event is trivially cheap; no throttling needed initially.

The selection math is a **pure function** (`nearestPointToCursor`), separated from the impure
projection so it can be unit-tested.

## Components & files

**New:**
- `src/scene/picking.ts` — pure `nearestPointToCursor(projected: {id:number;x:number;y:number}[], cursor:{x:number;y:number}, radiusPx:number): number | null`.
- `src/scene/picking.test.ts` — tests for the pure picker.
- `src/ui/InspectedCard.tsx` — renders a focused point's text + emotion + a ✕ that calls `onClear`.
- `src/ui/InspectedCard.test.tsx`.

**Modified:**
- `src/scene/Scene.tsx` — add an internal `PointPicker` child (uses `useThree`) that projects
  points, tracks hover, and fires `onPickPoint(id | null)`; render a halo on `focusedId` and a
  subtle highlight on the hovered point. New props: `focusedId: number | null`,
  `onPickPoint: (id: number | null) => void`.
- `src/routes/Embeddings.tsx` — own `focus` state; implement `onPickPoint`
  (`store.knn(points[id].vec, K)` → neighbors, set `focusedId`); render `InspectedCard` above
  `NeighborPanel` when point-focused; typing switches focus back; pass `focusedId`/`onPickPoint`
  to `Scene`.
- `src/routes/Embeddings.test.tsx` — mock `Scene` to expose an `onPickPoint` trigger so the focus
  wiring is testable without WebGL.

## Data flow

```
hover point (desktop)            → PointPicker projects → nearestPointToCursor → highlight (Scene-local)
click / tap point id             → Scene.onPickPoint(id)
   → Embeddings: focus = {kind:'point', id}; focusedId = id; neighbors = store.knn(points[id].vec, K)
   → Scene halos points[id]; panel shows InspectedCard(points[id]) + neighbor list
type a sentence                  → focus = typed; focusedId = null; live point + its neighbors (today's flow)
click empty space                → onPickPoint(null) → clear point-focus
```

## Testing

- **`picking.test.ts`** (pure): picks the nearest projected point within the radius; returns
  `null` when all are beyond the radius; handles empty input; ties resolve to the closest.
- **`InspectedCard.test.tsx`**: renders the given text + emotion; the ✕ calls `onClear`.
- **`Embeddings.test.tsx`**: with `Scene` mocked to expose an `onPickPoint(1)` trigger button,
  clicking it shows the inspected card (point's text/emotion) and that point's neighbors (mock
  `store.knn`); then typing switches the focus back to the typed neighbor.
- **In-browser gate (Playwright) before deploy** — real WebGL picking cannot run in jsdom (the
  hard lesson: r3f mocks can't validate picking/intrinsics). Verify on `npm run preview` and the
  live deploy: desktop **hover highlights** a point + `cursor:pointer`, **click** opens the
  inspected card with neighbors and halos the point; **mobile tap** does the same; clicking empty
  clears. Check at 1280px and 390px.

## Verification & rollout
- `npm run test` green; `npm run build` type-checks.
- Playwright check (desktop hover+click, mobile tap, empty-click clear) at 1280px and 390px.
- Deploy to Vercel; confirm on `https://mechterp.vercel.app/embeddings`.
