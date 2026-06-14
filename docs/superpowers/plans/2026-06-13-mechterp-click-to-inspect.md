# MechTerp Stage 1 Click-to-Inspect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users hover (desktop) / tap (mobile) a reference point in the Stage 1 cloud to highlight it and click it to focus — showing its full text, emotion, and its own nearest neighbors in the side panel, with the point haloed in 3D.

**Architecture:** A pure `nearestPointToCursor` does screen-space selection; a `PointPicker` component inside the Canvas projects points to pixels each pointer event (recenter-aware) and fires `onPickPoint`. The `Embeddings` route owns a single `focusedIndex` — typing focuses the live point (today's flow), clicking focuses a reference point (its neighbors via `store.knn(point.vec, K)`). An `InspectedCard` shows the focused point above the neighbor list. No reliance on three's flaky `Points.raycast`.

**Tech Stack:** React 19 + TS + Tailwind v3 · three + @react-three/fiber (`useThree`) + drei · Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-13-mechterp-click-to-inspect-design.md`.

> **Note on identity:** "index" = the array index into `points` (from `store.all()`). Points are stored in id order so index === point id, but the picker and focus use the **array index** throughout for safety.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/scene/picking.ts` | Pure `nearestPointToCursor(projected, cursor, radiusPx)` |
| `src/scene/picking.test.ts` | Tests for the pure picker |
| `src/ui/InspectedCard.tsx` | Focused point's emotion + text + ✕ clear |
| `src/ui/InspectedCard.test.tsx` | Tests for the card |
| `src/scene/Scene.tsx` | + `PointPicker`, hover/focus highlights, `focusedIndex`/`onPickPoint` props |
| `src/scene/Scene.test.tsx` | + `useThree` to the fiber mock so `PointPicker` renders |
| `src/routes/Embeddings.tsx` | + `focusedIndex` state, `onPickPoint`, `InspectedCard` wiring |
| `src/routes/Embeddings.test.tsx` | mock `Scene` to exercise `onPickPoint` |

---

## Task 1: Pure screen-space picker (TDD)

**Files:**
- Create: `src/scene/picking.ts`, `src/scene/picking.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/scene/picking.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { nearestPointToCursor } from './picking'

const P = [
  { id: 0, x: 10, y: 10 },
  { id: 1, x: 100, y: 100 },
  { id: 2, x: 12, y: 11 },
]

describe('nearestPointToCursor', () => {
  it('returns the nearest point within the radius', () => {
    // cursor at (11,10): point 0 is ~1px away, point 2 is ~1.4px away
    expect(nearestPointToCursor(P, { x: 11, y: 10 }, 14)).toBe(0)
  })
  it('returns the nearest even when several are within the radius', () => {
    expect(nearestPointToCursor(P, { x: 12, y: 11 }, 14)).toBe(2)
  })
  it('returns null when all points are beyond the radius', () => {
    expect(nearestPointToCursor(P, { x: 500, y: 500 }, 14)).toBeNull()
  })
  it('returns null for empty input', () => {
    expect(nearestPointToCursor([], { x: 0, y: 0 }, 14)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- picking`
Expected: FAIL — `./picking` not found.

- [ ] **Step 3: Implement**

Create `src/scene/picking.ts`:
```ts
export interface ProjectedPoint {
  index: number
  x: number
  y: number
}

/** Index of the projected point nearest the cursor within radiusPx, or null. */
export function nearestPointToCursor(
  projected: { index?: number; id?: number; x: number; y: number }[],
  cursor: { x: number; y: number },
  radiusPx: number,
): number | null {
  let best: number | null = null
  let bestD = Infinity
  for (const p of projected) {
    const key = (p.index ?? p.id) as number
    const dx = p.x - cursor.x
    const dy = p.y - cursor.y
    const d = dx * dx + dy * dy
    if (d < bestD) { bestD = d; best = key }
  }
  return bestD <= radiusPx * radiusPx ? best : null
}
```
(The test data uses `id`; runtime callers pass `index`. Accepting either keeps the function reusable and the test honest.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- picking`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/scene/picking.ts src/scene/picking.test.ts
git commit -m "feat: pure screen-space nearest-point picker"
```

---

## Task 2: InspectedCard (TDD)

**Files:**
- Create: `src/ui/InspectedCard.tsx`, `src/ui/InspectedCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/InspectedCard.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { InspectedCard } from './InspectedCard'
import type { Point } from '../types'

const point: Point = { id: 5, text: 'I am so relieved', emotion: 'relief', xyz: [0, 0, 0], vec: Float32Array.from([1, 0]) }

describe('InspectedCard', () => {
  it('shows the point text and emotion', () => {
    const { getByText } = render(<InspectedCard point={point} onClear={() => {}} />)
    expect(getByText('I am so relieved')).toBeTruthy()
    expect(getByText('relief')).toBeTruthy()
  })
  it('calls onClear when the clear button is clicked', () => {
    const onClear = vi.fn()
    const { getByRole } = render(<InspectedCard point={point} onClear={onClear} />)
    fireEvent.click(getByRole('button', { name: /clear inspection/i }))
    expect(onClear).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- InspectedCard`
Expected: FAIL — `./InspectedCard` not found.

- [ ] **Step 3: Implement**

Create `src/ui/InspectedCard.tsx`:
```tsx
import type { Point } from '../types'
import { emotionColor } from '../scene/colors'

export function InspectedCard({ point, onClear }: { point: Point; onClear: () => void }) {
  return (
    <div className="mb-3 rounded-lg border border-gray-700 bg-gray-800/80 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-gray-500">inspecting</span>
        <button onClick={onClear} aria-label="clear inspection" className="-mt-1 text-gray-400 hover:text-white">
          ✕
        </button>
      </div>
      <span className="font-medium" style={{ color: emotionColor(point.emotion) }}>{point.emotion}</span>
      <p className="mt-1 text-gray-200">{point.text}</p>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- InspectedCard`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/InspectedCard.tsx src/ui/InspectedCard.test.tsx
git commit -m "feat: InspectedCard for a focused reference point"
```

---

## Task 3: Scene — PointPicker + highlights + props

This adds the in-Canvas picker and the hover/focus visuals. The `<points>` cloud rendering is unchanged; picking is screen-space. Because `PointPicker` calls `useThree`, the Scene test's `@react-three/fiber` mock must provide it.

**Files:**
- Modify: `src/scene/Scene.tsx` (full new contents below)
- Modify: `src/scene/Scene.test.tsx` (add `useThree` to the fiber mock; add a trail-render assertion stays green)

- [ ] **Step 1: Update the Scene test's fiber mock and add a focus-prop smoke assertion**

Replace the two `vi.mock(...)` lines and the test body in `src/scene/Scene.test.tsx` so the file reads:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Stub the WebGL canvas + useThree so jsdom can render children (incl. PointPicker) without a GPU.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
  useThree: () => ({
    camera: {},
    size: { width: 100, height: 100 },
    gl: {
      domElement: {
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        style: {},
      },
    },
  }),
}))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Line: () => null,
  Text: () => null,
  Billboard: ({ children }: any) => children,
  Html: ({ children }: any) => children,
}))

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

  it('renders the drift trail (>1 point) and a focused-point halo without throwing', () => {
    const { getByTestId } = render(
      <Scene
        points={pts}
        centroids={[]}
        live={[2, 2, 2] as XYZ}
        trail={[[0, 0, 0], [1, 1, 1], [2, 2, 2]]}
        focusedIndex={0}
        onPickPoint={() => {}}
      />,
    )
    expect(getByTestId('canvas')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm run test -- scene/Scene`
Expected: FAIL — `Scene` doesn't accept `focusedIndex`/`onPickPoint` yet (TS error) or `useThree` unused causes no failure; the new test referencing `focusedIndex` fails to type-check / the picker isn't present. (If it happens to pass because props are ignored, Step 3 still required — proceed.)

- [ ] **Step 3: Replace `src/scene/Scene.tsx` entirely with:**

```tsx
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Point, XYZ } from '../types'
import { emotionColor } from './colors'
import { nearestPointToCursor } from './picking'

const PICK_RADIUS_PX = 14

interface Props {
  points: Point[]
  centroids: { emotion: string; xyz: XYZ }[]
  live: XYZ | null
  trail: XYZ[]
  focusedIndex?: number | null
  onPickPoint?: (index: number | null) => void
}

/** Bounding-box center of the cloud — used to recenter so orbit/zoom pivot on the data. */
function cloudCenter(points: Point[]): XYZ {
  if (!points.length) return [0, 0, 0]
  let minx = Infinity, miny = Infinity, minz = Infinity
  let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity
  for (const p of points) {
    const [x, y, z] = p.xyz
    if (x < minx) minx = x; if (x > maxx) maxx = x
    if (y < miny) miny = y; if (y > maxy) maxy = y
    if (z < minz) minz = z; if (z > maxz) maxz = z
  }
  return [(minx + maxx) / 2, (miny + maxy) / 2, (minz + maxz) / 2]
}

/** Screen-space picker: projects recentered points to pixels each pointer event and reports the
 *  nearest under the cursor. Lives inside the Canvas for useThree access. Renders nothing. */
function PointPicker({
  points,
  center,
  onHover,
  onPick,
}: {
  points: Point[]
  center: XYZ
  onHover: (i: number | null) => void
  onPick: (i: number | null) => void
}) {
  const { camera, gl, size } = useThree()
  const base = useMemo(
    () => points.map((p) => new THREE.Vector3(p.xyz[0] - center[0], p.xyz[1] - center[1], p.xyz[2] - center[2])),
    [points, center],
  )
  // Keep callbacks in refs so changing them doesn't re-attach DOM listeners every render.
  const onHoverRef = useRef(onHover); onHoverRef.current = onHover
  const onPickRef = useRef(onPick); onPickRef.current = onPick

  useEffect(() => {
    const el = gl.domElement as HTMLElement
    const scratch = new THREE.Vector3()
    const project = () =>
      base.map((b, i) => {
        scratch.copy(b).project(camera)
        return { index: i, x: (scratch.x * 0.5 + 0.5) * size.width, y: (-scratch.y * 0.5 + 0.5) * size.height }
      })
    const toCursor = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    let downAt: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      const i = nearestPointToCursor(project(), toCursor(e), PICK_RADIUS_PX)
      onHoverRef.current(i)
      el.style.cursor = i != null ? 'pointer' : ''
    }
    const onDown = (e: PointerEvent) => { downAt = toCursor(e) }
    const onUp = (e: PointerEvent) => {
      const up = toCursor(e)
      if (downAt && Math.hypot(up.x - downAt.x, up.y - downAt.y) < 6) {
        // a tap/click (not a drag) → pick (null when on empty space, which clears focus)
        onPickRef.current(nearestPointToCursor(project(), up, PICK_RADIUS_PX))
      }
      downAt = null
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.style.cursor = ''
    }
  }, [base, camera, gl, size])

  return null
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
      <pointsMaterial size={0.06} vertexColors sizeAttenuation />
    </points>
  )
}

function Centroid({
  emotion,
  xyz,
  active,
  onActivate,
}: {
  emotion: string
  xyz: XYZ
  active: boolean
  onActivate: (e: string | null) => void
}) {
  const color = emotionColor(emotion)
  return (
    <group position={xyz}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); onActivate(emotion) }}
        onPointerOut={() => onActivate(null)}
        onPointerDown={(e) => { e.stopPropagation(); onActivate(emotion) }}
      >
        <sphereGeometry args={[active ? 0.18 : 0.11, 16, 16]} />
        <meshBasicMaterial color={color} wireframe={!active} transparent opacity={active ? 0.6 : 1} />
      </mesh>
      {active && (
        <Billboard>
          <Text fontSize={0.18} color={color} anchorX="center" anchorY="bottom" position={[0, 0.24, 0]} outlineWidth={0.012} outlineColor="#000000" renderOrder={10}>
            {emotion}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function LivePoint({ live, trail }: { live: XYZ | null; trail: XYZ[] }) {
  return (
    <group>
      {trail.length > 1 && (
        <Line points={trail} color="#ffffff" lineWidth={1.5} transparent opacity={0.45} />
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

export function Scene({ points, centroids, live, trail, focusedIndex = null, onPickPoint = () => {} }: Props) {
  const center = useMemo(() => cloudCenter(points), [points])
  const recenter: XYZ = [-center[0], -center[1], -center[2]]
  const [activeEmotion, setActiveEmotion] = useState<string | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 50 }}
      dpr={[1, 2]}
      onPointerMissed={() => setActiveEmotion(null)}
    >
      <ambientLight intensity={0.9} />
      <PointPicker points={points} center={center} onHover={setHovered} onPick={onPickPoint} />
      <group position={recenter}>
        <ReferenceCloud points={points} />
        {centroids.map((c) => (
          <Centroid
            key={c.emotion}
            emotion={c.emotion}
            xyz={c.xyz}
            active={activeEmotion === c.emotion}
            onActivate={setActiveEmotion}
          />
        ))}
        <LivePoint live={live} trail={trail} />
        {hovered != null && points[hovered] && (
          <mesh position={points[hovered].xyz}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        )}
        {focusedIndex != null && points[focusedIndex] && (
          <mesh position={points[focusedIndex].xyz}>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshBasicMaterial color="#ffffff" wireframe />
          </mesh>
        )}
      </group>
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        zoomSpeed={0.5}
        rotateSpeed={0.6}
        panSpeed={0.6}
        enableDamping
        dampingFactor={0.12}
        minDistance={2}
        maxDistance={30}
      />
    </Canvas>
  )
}
```

- [ ] **Step 4: Run tests + build**

Run: `npm run test -- scene/Scene` (2 tests pass), then full `npm run test` (all green), then `npm run build` (`✓ built`, no type errors).

- [ ] **Step 5: Commit**

```bash
git add src/scene/Scene.tsx src/scene/Scene.test.tsx
git commit -m "feat(scene): screen-space PointPicker with hover + focus highlights"
```

---

## Task 4: Embeddings — focus state, onPickPoint, InspectedCard

**Files:**
- Modify: `src/routes/Embeddings.tsx`
- Modify: `src/routes/Embeddings.test.tsx`

- [ ] **Step 1: Update the Embeddings test to mock Scene and add a click-to-inspect test**

Replace the entire contents of `src/routes/Embeddings.test.tsx` with:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../embedder/embedder', () => ({
  Embedder: { create: async () => ({ embed: async () => ({ vector: Float32Array.from([1, 0]) }) }) },
}))
vi.mock('../vectorStore/vectorStore', () => ({
  VectorStore: {
    fromUrl: async () => ({
      knn: () => [{ id: 1, text: 'neighbor-text', emotion: 'joy', xyz: [0, 0, 0], distance: 0.1 }],
      centroids: () => [],
      all: () => [{ id: 1, text: 'point-zero-text', emotion: 'relief', xyz: [0, 0, 0], vec: Float32Array.from([1, 0]) }],
      count: () => 1,
    }),
  },
}))
// Fully stub the 3D Scene; expose its onPickPoint via a button so we can test focus wiring.
vi.mock('../scene/Scene', () => ({
  Scene: ({ onPickPoint }: { onPickPoint?: (i: number | null) => void }) => (
    <button onClick={() => onPickPoint && onPickPoint(0)}>pick-point-0</button>
  ),
}))

import Embeddings from './Embeddings'

describe('Embeddings (Stage 1)', () => {
  it('embeds typed text and shows a nearest neighbor', async () => {
    const { getByPlaceholderText, findByText } = render(<Embeddings />)
    await waitFor(() => getByPlaceholderText(/type a sentence/i))
    fireEvent.change(getByPlaceholderText(/type a sentence/i), { target: { value: 'I am grateful' } })
    expect(await findByText('neighbor-text')).toBeTruthy()
  })

  it('clicking a point focuses it: shows its text/emotion and its neighbors', async () => {
    const { getByText, findByText } = render(<Embeddings />)
    await waitFor(() => getByText('pick-point-0'))
    fireEvent.click(getByText('pick-point-0'))
    expect(await findByText('point-zero-text')).toBeTruthy() // inspected card text
    expect(await findByText('relief')).toBeTruthy()          // inspected card emotion
    expect(await findByText('neighbor-text')).toBeTruthy()   // that point's neighbors
  })
})
```

- [ ] **Step 2: Run it to confirm the new test fails**

Run: `npm run test -- routes/Embeddings`
Expected: FAIL — the second test can't find `point-zero-text` (no InspectedCard / onPickPoint wiring yet).

- [ ] **Step 3: Add the focus state, handler, and InspectedCard to `src/routes/Embeddings.tsx`**

Edit 1 — add the import (after the `BottomSheet` import, line 10):
```tsx
import { InspectedCard } from '../ui/InspectedCard'
```

Edit 2 — add focus state (after the `trail` state, line 23):
```tsx
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
```

Edit 3 — typing clears point-focus. In `recompute.current`, change the empty-sentence line and add `setFocusedIndex(null)` for the typed path. Replace:
```tsx
    if (!sentence) { setLive(null); setNeighbors([]); return }
    const { vector } = await embedder.embed(sentence)
    const nbrs = store.knn(vector, K)
    const xyz = placeLivePoint(nbrs)
    setNeighbors(nbrs)
```
with:
```tsx
    if (!sentence) { setLive(null); setNeighbors([]); setFocusedIndex(null); return }
    const { vector } = await embedder.embed(sentence)
    const nbrs = store.knn(vector, K)
    const xyz = placeLivePoint(nbrs)
    setFocusedIndex(null)
    setNeighbors(nbrs)
```

Edit 4 — add the pick handler (after `onToggle`, before the `return`):
```tsx
  const onPickPoint = (index: number | null) => {
    if (index == null || !store) { setFocusedIndex(null); void recompute.current(tokens); return }
    const p = points[index]
    if (!p) return
    setFocusedIndex(index)
    setNeighbors(store.knn(p.vec, K))
  }
```

Edit 5 — pass the new props to `<Scene>`. Replace:
```tsx
        <Scene points={points} centroids={centroids} live={live} trail={trail} />
```
with:
```tsx
        <Scene points={points} centroids={centroids} live={live} trail={trail} focusedIndex={focusedIndex} onPickPoint={onPickPoint} />
```

Edit 6 — render the InspectedCard above the NeighborPanel. Replace:
```tsx
          <div className="my-3 border-t border-gray-800" />
          <NeighborPanel neighbors={neighbors} />
```
with:
```tsx
          <div className="my-3 border-t border-gray-800" />
          {focusedIndex != null && points[focusedIndex] && (
            <InspectedCard point={points[focusedIndex]} onClear={() => onPickPoint(null)} />
          )}
          <NeighborPanel neighbors={neighbors} />
```

- [ ] **Step 4: Run tests + build**

Run: `npm run test -- routes/Embeddings` (2 tests pass), then full `npm run test` (all green), then `npm run build` (`✓ built`, no type errors).

- [ ] **Step 5: Commit**

```bash
git add src/routes/Embeddings.tsx src/routes/Embeddings.test.tsx
git commit -m "feat: click-to-inspect focus wiring in Stage 1 explorer"
```

---

## Task 5: Verify in-browser (desktop + mobile) and deploy

**Files:** none (verification + deploy)

- [ ] **Step 1: Full suite + build**

Run: `npm run test` (all green) and `npm run build` (`✓ built`).

- [ ] **Step 2: Start preview and verify picking in a real browser**

Run: `npm run preview`. Drive a browser (Playwright if available) to `/embeddings`, wait for the cloud to load, then verify (record screenshots):
- **Desktop hover:** moving the cursor over the cloud highlights the nearest point and shows `cursor: pointer`; moving to empty space clears it.
- **Desktop click:** clicking a point shows the InspectedCard (its text + emotion) above the neighbor list, the neighbor list updates to that point's neighbors, and the point is haloed.
- **Clear:** the card's ✕ (and clicking empty space) clears focus back to the typed state.
- **Mobile (390px):** tapping a point opens the InspectedCard; tapping empty clears.
To programmatically confirm a pick fires without pixel-perfect aim, you can dispatch pointer events across a grid over the canvas and assert an element containing the inspected text appears (the picker uses real screen-space projection, so a grid sweep will land on points).

- [ ] **Step 3: Deploy and confirm on production**

Run: `npx --yes vercel --prod --yes`. Then on `https://mechterp.vercel.app/embeddings`, confirm clicking a point opens the InspectedCard with neighbors.

- [ ] **Step 4: Commit any fixes found during verification**

```bash
git add -A
git commit -m "fix: click-to-inspect adjustments from browser verification"
```
(Skip if no fixes were needed. If the pick radius felt off, adjust `PICK_RADIUS_PX` in `src/scene/Scene.tsx` and note the chosen value.)

---

## Self-Review (completed by plan author)

**Spec coverage:** screen-space pure picker (Task 1), inspected-point card (Task 2), in-Canvas `PointPicker` with recenter-aware projection + hover highlight + focus halo + `focusedIndex`/`onPickPoint` props (Task 3), single-focus wiring in Embeddings — typing clears point-focus, clicking sets it with `store.knn(point.vec, K)`, empty-click clears, InspectedCard above NeighborPanel (Task 4), in-browser desktop+mobile gate and deploy (Task 5). All spec sections map to a task. Centroid behavior and Stage 2 are untouched (out of scope, honored).

**Placeholder scan:** every code step shows complete file contents or exact old→new edits with anchors; no "TBD"/"handle edge cases" gaps. Task 5's grid-sweep verification is a concrete technique, not a placeholder.

**Type/name consistency:** `nearestPointToCursor(projected, cursor, radiusPx)` defined in Task 1, imported in Task 3. `InspectedCard({ point, onClear })` defined in Task 2, used in Task 4. Scene's new props `focusedIndex?: number | null` and `onPickPoint?: (index: number | null) => void` are defined in Task 3 and passed in Task 4. `focusedIndex`/`points[focusedIndex]` indexing is consistent (array index throughout). `PICK_RADIUS_PX` defined once in Scene. The Scene fiber-mock `useThree` addition (Task 3) is required because `PointPicker` calls `useThree`.
