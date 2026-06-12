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
