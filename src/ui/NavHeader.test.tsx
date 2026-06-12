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
