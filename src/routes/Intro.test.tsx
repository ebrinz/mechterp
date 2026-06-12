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
