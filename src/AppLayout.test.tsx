import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Stub the heavy Stage 1 route so this test stays fast and GPU-free.
vi.mock('./routes/Embeddings', () => ({ default: () => <div>STAGE1_EXPLORER</div> }))
// Stub the attention model so this test stays fast and ONNX/GPU-free.
vi.mock('./attention/attentionModel', () => ({
  AttentionModel: {
    create: () => new Promise(() => {}), // never resolves — keeps input disabled
  },
}))

import { AppLayout } from './AppLayout'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><AppLayout /></MemoryRouter>)
}

describe('AppLayout routing', () => {
  it('renders the Intro landing at /', () => {
    const { getByText } = renderAt('/')
    expect(getByText(/mechanistic interpretability/i)).toBeTruthy()
  })
  it('renders Stage 1 at /embeddings', () => {
    const { getByText } = renderAt('/embeddings')
    expect(getByText('STAGE1_EXPLORER')).toBeTruthy()
  })
  it('renders the Stage 2 attention explorer at /internals', () => {
    const { getAllByText } = renderAt('/internals')
    expect(getAllByText(/attention/i).length).toBeGreaterThan(0)
  })
  it('shows the nav on every page', () => {
    const { getByRole } = renderAt('/internals')
    expect(getByRole('link', { name: 'MechTerp' })).toBeTruthy()
  })
})
