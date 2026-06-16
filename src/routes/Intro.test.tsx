import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Intro } from './Intro'

describe('Intro', () => {
  it('links to both stages, with Stage 2 presented as live', () => {
    const { getByRole, getByText } = render(<MemoryRouter><Intro /></MemoryRouter>)
    expect(getByRole('link', { name: /embedding space/i }).getAttribute('href')).toBe('/embeddings')
    expect(getByRole('link', { name: /internals/i }).getAttribute('href')).toBe('/internals')
    // Stage 2 is a working attention explorer now — no longer "coming soon".
    expect(getByText(/live/i)).toBeTruthy()
    expect(() => getByText(/coming soon/i)).toThrow()
  })
})
