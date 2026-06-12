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
