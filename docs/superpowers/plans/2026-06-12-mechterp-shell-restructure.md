# MechTerp App Shell Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing embedding explorer in a routed "MechTerp intro" shell — an Intro landing, Stage 1 (the current explorer moved onto `/embeddings`), and a Stage 2 (`/internals`) attention teaser — with a persistent responsive nav.

**Architecture:** Add `react-router-dom` v7. `main.tsx` wraps the app in `<BrowserRouter>`; a new `AppLayout` renders a slim `NavHeader` + `<Outlet/>`; three route pages live under `src/routes/`. The current `App.tsx` explorer moves verbatim into `src/routes/Embeddings.tsx` (only its outer height class changes). A Vercel SPA rewrite makes sub-route deep links/refresh work.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v3 · `react-router-dom` v7 · Vitest + @testing-library/react.

**Reference spec:** `docs/superpowers/specs/2026-06-12-mechterp-shell-restructure-design.md`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/main.tsx` | Mount app inside `<BrowserRouter>` |
| `src/AppLayout.tsx` | Column shell: `NavHeader` + `<Outlet/>`; defines the `<Routes>` |
| `src/ui/NavHeader.tsx` | Persistent nav: wordmark + 3 responsive links + active state |
| `src/routes/Intro.tsx` | Landing page `/` |
| `src/routes/Embeddings.tsx` | Stage 1 explorer (moved from `App.tsx`) |
| `src/routes/Internals.tsx` | Stage 2 attention teaser |
| `vercel.json` | Add SPA rewrite |
| `src/App.tsx` | Deleted (logic moved to `routes/Embeddings.tsx`) |

**Build order rationale:** install router → move explorer to a route (keep it working) → nav → layout+routes wiring → intro → teaser → deploy. The app stays green after every task.

---

## Task 1: Install react-router-dom

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

Run:
```bash
npm install react-router-dom@^7
```
Expected: `react-router-dom` appears in `package.json` dependencies; `npm ls react-router-dom` shows a v7.x version.

- [ ] **Step 2: Verify the toolchain still builds**

Run: `npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-router-dom v7"
```

---

## Task 2: Move the explorer into `routes/Embeddings.tsx`

The current `src/App.tsx` IS the explorer. Move it verbatim to `src/routes/Embeddings.tsx`, change only the outer height class (it will live inside the layout's `flex-1`, not the whole viewport), and rename the default export to `Embeddings`. Move its tests alongside.

**Files:**
- Create: `src/routes/Embeddings.tsx` (from `src/App.tsx`)
- Create: `src/routes/Embeddings.test.tsx` (from `src/App.test.tsx`)
- Create: `src/routes/Embeddings.loaderror.test.tsx` (from `src/App.loaderror.test.tsx`)
- Delete: `src/App.tsx`, `src/App.test.tsx`, `src/App.loaderror.test.tsx`

- [ ] **Step 1: Create `src/routes/Embeddings.tsx`**

Copy the entire current contents of `src/App.tsx` into `src/routes/Embeddings.tsx` with these exact changes:
1. Rename the component `export default function App()` → `export default function Embeddings()`.
2. Fix the relative imports (now one directory deeper): change every `'./xxx'` import to `'../xxx'`. Specifically:
```ts
import { Embedder } from '../embedder/embedder'
import { VectorStore } from '../vectorStore/vectorStore'
import { placeLivePoint } from '../placement/placement'
import { toTokens, maskedSentence, type Token } from '../tokens/tokens'
import { Scene } from '../scene/Scene'
import { TokenChips } from '../ui/TokenChips'
import { NeighborPanel } from '../ui/NeighborPanel'
import { Legend } from '../ui/Legend'
import { BottomSheet } from '../ui/BottomSheet'
import type { Neighbor, Point, XYZ } from '../types'
```
3. Change the outer container so it fills the layout region instead of the full viewport. Replace:
```tsx
    <div className="flex h-[100dvh] flex-col bg-gray-950 text-gray-100 md:flex-row">
```
with:
```tsx
    <div className="flex h-full flex-1 flex-col bg-gray-950 text-gray-100 md:flex-row">
```

- [ ] **Step 2: Create the two test files (moved + import paths fixed)**

Create `src/routes/Embeddings.test.tsx` — copy `src/App.test.tsx` and change the mock paths + import (one dir deeper):
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../embedder/embedder', () => ({
  Embedder: { create: async () => ({ embed: async () => ({ vector: Float32Array.from([1, 0]) }) }) },
}))
vi.mock('../vectorStore/vectorStore', () => ({
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
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Line: () => null,
  Text: () => null,
  Billboard: ({ children }: any) => children,
  Html: ({ children }: any) => children,
}))

import Embeddings from './Embeddings'

describe('Embeddings (Stage 1)', () => {
  it('embeds typed text and shows a nearest neighbor', async () => {
    const { getByPlaceholderText, findByText } = render(<Embeddings />)
    await waitFor(() => getByPlaceholderText(/type a sentence/i))
    fireEvent.change(getByPlaceholderText(/type a sentence/i), { target: { value: 'I am grateful' } })
    expect(await findByText('joy')).toBeTruthy()
  })
})
```

Create `src/routes/Embeddings.loaderror.test.tsx` — copy `src/App.loaderror.test.tsx` with the same path changes:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../embedder/embedder', () => ({
  Embedder: { create: async () => ({ embed: async () => ({ vector: Float32Array.from([1, 0]) }) }) },
}))
vi.mock('../vectorStore/vectorStore', () => ({
  VectorStore: { fromUrl: async () => { throw new Error('not a database') } },
}))
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: any) => <div>{children}</div>, useFrame: () => {} }))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Line: () => null,
  Text: () => null,
  Billboard: ({ children }: any) => children,
  Html: ({ children }: any) => children,
}))

import Embeddings from './Embeddings'

describe('Embeddings load error handling', () => {
  it('shows an error message instead of an infinite spinner when data fails to load', async () => {
    const { findByText } = render(<Embeddings />)
    expect(await findByText(/failed to load data/i)).toBeTruthy()
  })
})
```

- [ ] **Step 3: Delete the old files**

Run:
```bash
git rm src/App.tsx src/App.test.tsx src/App.loaderror.test.tsx
```

- [ ] **Step 4: Point `main.tsx` at the moved component temporarily so the app still runs**

Modify `src/main.tsx` — change the import and render from `App` to `Embeddings` (Task 4 replaces this with the router; this keeps the app working in between):
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Embeddings from './routes/Embeddings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Embeddings />
  </StrictMode>,
)
```
(If `main.tsx` differs, keep its existing structure and only swap the `App` import/usage for `Embeddings`.)

- [ ] **Step 5: Run tests + build**

Run: `npm run test`
Expected: all tests pass (the two moved Embeddings tests included).
Run: `npm run build`
Expected: `✓ built`, no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move explorer from App.tsx to routes/Embeddings.tsx"
```

---

## Task 3: NavHeader (TDD)

**Files:**
- Create: `src/ui/NavHeader.tsx`, `src/ui/NavHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/NavHeader.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavHeader } from './NavHeader'

describe('NavHeader', () => {
  it('renders the wordmark and three stage links', () => {
    const { getByText, getByRole } = render(
      <MemoryRouter initialEntries={['/embeddings']}>
        <NavHeader />
      </MemoryRouter>,
    )
    expect(getByText('MechTerp')).toBeTruthy()
    expect(getByRole('link', { name: /intro/i })).toBeTruthy()
    expect(getByRole('link', { name: /stage 1/i })).toBeTruthy()
    expect(getByRole('link', { name: /stage 2/i })).toBeTruthy()
  })

  it('marks the active route with aria-current', () => {
    const { getByRole } = render(
      <MemoryRouter initialEntries={['/embeddings']}>
        <NavHeader />
      </MemoryRouter>,
    )
    expect(getByRole('link', { name: /stage 1/i }).getAttribute('aria-current')).toBe('page')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- NavHeader`
Expected: FAIL — `./NavHeader` not found.

- [ ] **Step 3: Implement**

Create `src/ui/NavHeader.tsx`:
```tsx
import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', full: 'Intro', short: 'Intro', end: true },
  { to: '/embeddings', full: 'Stage 1 · Embeddings', short: 'Stage 1', end: false },
  { to: '/internals', full: 'Stage 2 · Internals', short: 'Stage 2', end: false },
]

export function NavHeader() {
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-gray-800 bg-gray-950 px-4 text-gray-100">
      <NavLink to="/" end className="text-sm font-semibold tracking-wide">
        MechTerp
      </NavLink>
      <nav className="flex items-center gap-1 sm:gap-2">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `flex min-h-[44px] items-center rounded px-2 text-xs sm:text-sm ${
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'
              }`
            }
          >
            <span className="md:hidden">{l.short}</span>
            <span className="hidden md:inline">{l.full}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
```
Note: `NavLink` sets `aria-current="page"` on the active link automatically, satisfying the second test.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- NavHeader`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/NavHeader.tsx src/ui/NavHeader.test.tsx
git commit -m "feat: responsive NavHeader with active-route highlighting"
```

---

## Task 4: AppLayout + routes wiring (TDD)

**Files:**
- Create: `src/AppLayout.tsx`, `src/AppLayout.test.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write the failing routing test**

Create `src/AppLayout.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Stub the heavy Stage 1 route so this test stays fast and GPU-free.
vi.mock('./routes/Embeddings', () => ({ default: () => <div>STAGE1_EXPLORER</div> }))

import { AppLayout } from './AppLayout'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><AppLayout /></MemoryRouter>)
}

describe('AppLayout routing', () => {
  it('renders the Intro landing at /', () => {
    const { getByText } = renderAt('/')
    expect(getByText(/introduction to mechanistic interpretability/i)).toBeTruthy()
  })
  it('renders Stage 1 at /embeddings', () => {
    const { getByText } = renderAt('/embeddings')
    expect(getByText('STAGE1_EXPLORER')).toBeTruthy()
  })
  it('renders the Stage 2 teaser at /internals', () => {
    const { getByText } = renderAt('/internals')
    expect(getByText(/coming soon/i)).toBeTruthy()
  })
  it('shows the nav on every page', () => {
    const { getByText } = renderAt('/internals')
    expect(getByText('MechTerp')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- AppLayout`
Expected: FAIL — `./AppLayout`, `./routes/Intro`, `./routes/Internals` not found.

- [ ] **Step 3: Implement `AppLayout` (and minimal Intro/Internals so it compiles)**

Create `src/routes/Intro.tsx` (full version is Task 5; this minimal version satisfies the routing test now):
```tsx
import { Link } from 'react-router-dom'

export function Intro() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto bg-gray-950 p-6 text-center text-gray-100">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MechTerp</h1>
        <p className="mt-2 text-gray-400">An introduction to mechanistic interpretability.</p>
      </div>
      <Link to="/embeddings" className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
        Stage 1 · Embedding Space →
      </Link>
    </main>
  )
}
```

Create `src/routes/Internals.tsx` (full teaser is Task 6; minimal now):
```tsx
import { Link } from 'react-router-dom'

export function Internals() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto bg-gray-950 p-6 text-center text-gray-100">
      <h1 className="text-2xl font-bold">Stage 2 · Internals</h1>
      <p className="text-indigo-300">coming soon</p>
      <Link to="/embeddings" className="text-sm text-gray-400 underline">← Back to Stage 1</Link>
    </main>
  )
}
```

Create `src/AppLayout.tsx`:
```tsx
import { Routes, Route } from 'react-router-dom'
import { NavHeader } from './ui/NavHeader'
import { Intro } from './routes/Intro'
import { Internals } from './routes/Internals'
import Embeddings from './routes/Embeddings'

export function AppLayout() {
  return (
    <div className="flex h-[100dvh] flex-col">
      <NavHeader />
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/embeddings" element={<Embeddings />} />
        <Route path="/internals" element={<Internals />} />
      </Routes>
    </div>
  )
}
```

- [ ] **Step 4: Wire `main.tsx` to the router**

Replace `src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AppLayout } from './AppLayout'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 5: Run tests + build**

Run: `npm run test -- AppLayout`
Expected: PASS, 4 tests.
Run: `npm run test` then `npm run build`
Expected: full suite green; `✓ built` with no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: routed AppLayout (Intro / Stage 1 / Stage 2) with BrowserRouter"
```

---

## Task 5: Full Intro landing

**Files:**
- Modify: `src/routes/Intro.tsx`
- Create: `src/routes/Intro.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/routes/Intro.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Intro } from './Intro'

describe('Intro', () => {
  it('links to both stages, with Stage 2 marked coming soon', () => {
    const { getByRole, getByText } = render(<MemoryRouter><Intro /></MemoryRouter>)
    expect(getByRole('link', { name: /embedding space/i }).getAttribute('href')).toBe('/embeddings')
    expect(getByRole('link', { name: /internals/i }).getAttribute('href')).toBe('/internals')
    expect(getByText(/coming soon/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- routes/Intro`
Expected: FAIL — no `/internals` link / no "coming soon" yet.

- [ ] **Step 3: Implement the full Intro**

Replace `src/routes/Intro.tsx`:
```tsx
import { Link } from 'react-router-dom'

function StageCard({ to, eyebrow, title, body, soon }: { to: string; eyebrow: string; title: string; body: string; soon?: boolean }) {
  return (
    <Link
      to={to}
      className="group relative flex w-full max-w-sm flex-col gap-2 rounded-xl border border-gray-800 bg-gray-900/60 p-5 text-left transition hover:border-indigo-500"
    >
      {soon && (
        <span className="absolute right-4 top-4 rounded-full bg-indigo-600/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
          coming soon
        </span>
      )}
      <span className="text-xs uppercase tracking-wide text-gray-500">{eyebrow}</span>
      <span className="text-lg font-semibold text-gray-100">{title}</span>
      <span className="text-sm text-gray-400">{body}</span>
    </Link>
  )
}

export function Intro() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto bg-gray-950 p-6 text-center text-gray-100">
      <div className="max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight">MechTerp</h1>
        <p className="mt-2 text-lg text-gray-400">An introduction to mechanistic interpretability.</p>
        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          Explore how a small language model (<code className="text-gray-300">all-MiniLM-L6-v2</code>) represents and
          processes <em>emotion</em> using the GoEmotions dataset — starting from its black-box embeddings and working
          toward the internal mechanics that produce them.
        </p>
      </div>
      <div className="flex w-full max-w-3xl flex-col items-stretch justify-center gap-4 md:flex-row">
        <StageCard
          to="/embeddings"
          eyebrow="Stage 1"
          title="Embedding Space →"
          body="Type a sentence and watch where it lands — and drifts — in a 3D map of emotion embeddings."
        />
        <StageCard
          to="/internals"
          eyebrow="Stage 2"
          title="Internals"
          body="Crack the model open: attention patterns and how a sentence's representation forms layer by layer."
          soon
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- routes/Intro`
Expected: PASS. Then `npm run test` (full suite incl. AppLayout) stays green.

- [ ] **Step 5: Commit**

```bash
git add src/routes/Intro.tsx src/routes/Intro.test.tsx
git commit -m "feat: Intro landing with stage cards (responsive)"
```

---

## Task 6: Full Stage 2 teaser

**Files:**
- Modify: `src/routes/Internals.tsx`
- Create: `src/routes/Internals.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/routes/Internals.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Internals } from './Internals'

describe('Internals teaser', () => {
  it('describes attention and links back to Stage 1', () => {
    const { getByText, getByRole } = render(<MemoryRouter><Internals /></MemoryRouter>)
    expect(getByText(/coming soon/i)).toBeTruthy()
    expect(getByText(/attention/i)).toBeTruthy()
    expect(getByRole('link', { name: /back to stage 1/i }).getAttribute('href')).toBe('/embeddings')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- routes/Internals`
Expected: FAIL — no "attention" text yet.

- [ ] **Step 3: Implement the full teaser (with a CSS attention-grid mock)**

Replace `src/routes/Internals.tsx`:
```tsx
import { Link } from 'react-router-dom'

/** Decorative 8x8 "attention grid" placeholder (pure CSS, scales on mobile). */
function AttentionGridMock() {
  const cells = Array.from({ length: 64 }, (_, i) => {
    const r = Math.floor(i / 8), c = i % 8
    // a soft diagonal + a couple of "heads" attending to token 0, just for flavor
    const v = Math.max(0, 1 - Math.abs(r - c) / 3) * 0.7 + (c === 0 ? 0.25 : 0)
    return Math.min(1, v)
  })
  return (
    <div className="grid w-full max-w-[260px] grid-cols-8 gap-[2px] rounded-lg border border-gray-800 p-2">
      {cells.map((v, i) => (
        <div key={i} className="aspect-square rounded-[2px]" style={{ backgroundColor: `rgba(129,140,248,${v.toFixed(2)})` }} />
      ))}
    </div>
  )
}

export function Internals() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto bg-gray-950 p-6 text-center text-gray-100">
      <div className="max-w-xl">
        <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
          coming soon
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Stage 2 · Internals</h1>
        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          Where we crack the model open. Type a sentence and see its <strong className="text-gray-200">attention
          patterns</strong> — which tokens attend to which, across all 6 layers and 12 heads — plus the
          <strong className="text-gray-200"> layer trajectory</strong> of how its representation forms with depth.
          Read straight from the model's exposed internals.
        </p>
      </div>
      <AttentionGridMock />
      <Link to="/embeddings" className="text-sm text-gray-400 underline hover:text-gray-200">
        ← Back to Stage 1
      </Link>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- routes/Internals`
Expected: PASS. Then run full `npm run test` — green.

- [ ] **Step 5: Commit**

```bash
git add src/routes/Internals.tsx src/routes/Internals.test.tsx
git commit -m "feat: Stage 2 internals teaser with attention-grid mock"
```

---

## Task 7: Vercel SPA rewrite for deep links

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add the rewrite**

Modify `vercel.json` to add a `rewrites` array (keep the existing `buildCommand`, `outputDirectory`, and `headers`). The full file should read:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }] }
  ]
}
```
(Vercel serves real files via filesystem priority before applying rewrites, so `emotions.sqlite`, `/sql-wasm/*`, and hashed `/assets/*` are unaffected; only unmatched routes fall through to `index.html`.)

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('valid')"`
Expected: `valid`.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "build: SPA rewrite so /embeddings and /internals deep-link on Vercel"
```

---

## Task 8: Verify in-browser (desktop + mobile) and deploy

**Files:** none (verification + deploy)

- [ ] **Step 1: Full suite + build**

Run: `npm run test` (all green) and `npm run build` (`✓ built`).

- [ ] **Step 2: Start preview and check all three routes at desktop + mobile**

Run: `npm run preview`, then drive a browser (Playwright if available) to verify:
- `/` Intro renders the two stage cards (stacked at 390px width, side-by-side at ≥768px).
- `/embeddings` loads the explorer under the ~52px header; the 3D + bottom sheet still fit at 390px (no clipping; cloud has vertical room).
- `/internals` shows the teaser + attention-grid mock, readable at 390px.
- NavHeader links navigate between routes and highlight the active one; labels shorten on mobile.
Record a screenshot of each route at 390px.

- [ ] **Step 3: Deploy and confirm deep-link refresh**

Run: `npx --yes vercel --prod --yes`
Then load `https://mechterp.vercel.app/embeddings` directly (fresh navigation, not via in-app link) and refresh `https://mechterp.vercel.app/internals` — both must load their page (proves the SPA rewrite), not 404.

- [ ] **Step 4: Commit any fixes found during verification**

```bash
git add -A
git commit -m "fix: shell responsive/route adjustments from browser verification"
```
(If no fixes were needed, skip this step.)

---

## Self-Review (completed by plan author)

**Spec coverage:** routing + react-router-dom v7 (Task 1, 4), NavHeader responsive + active state (Task 3), Intro landing with stacked-on-mobile cards (Task 5), Stage 1 moved to `/embeddings` filling `flex-1` (Task 2), Stage 2 teaser with attention-grid mock + back link (Task 6), Vercel SPA rewrite (Task 7), mobile + desktop verification and deploy with deep-link check (Task 8). All spec sections map to a task. Stage 2's real attention view is correctly excluded (separate spec, per the spec's out-of-scope).

**Placeholder scan:** no "TBD"/"add error handling"-style gaps; every code step shows complete file contents or exact edits. The minimal Intro/Internals in Task 4 are intentionally replaced by full versions in Tasks 5–6 (not placeholders — each is working, tested code at its step).

**Type/name consistency:** `Embeddings` (default export) used consistently in Task 2 and imported in Task 4's `AppLayout`. `NavHeader`, `Intro`, `Internals` are named exports used consistently across tasks. Route paths `/`, `/embeddings`, `/internals` match across NavHeader, AppLayout, Intro, Internals, and the Vercel/verification tasks.
