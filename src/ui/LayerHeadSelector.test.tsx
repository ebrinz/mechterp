import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { LayerHeadSelector } from './LayerHeadSelector'

describe('LayerHeadSelector', () => {
  it('renders layer and head buttons and reports clicks', () => {
    const onLayer = vi.fn(); const onHead = vi.fn()
    const { getByRole } = render(
      <LayerHeadSelector layers={6} heads={12} layer={0} head={0} onLayer={onLayer} onHead={onHead} />,
    )
    fireEvent.click(getByRole('button', { name: 'layer 3' }))
    expect(onLayer).toHaveBeenCalledWith(3)
    fireEvent.click(getByRole('button', { name: 'head 5' }))
    expect(onHead).toHaveBeenCalledWith(5)
  })
  it('marks the active layer/head with aria-pressed', () => {
    const { getByRole } = render(
      <LayerHeadSelector layers={6} heads={12} layer={2} head={4} onLayer={() => {}} onHead={() => {}} />,
    )
    expect(getByRole('button', { name: 'layer 2' }).getAttribute('aria-pressed')).toBe('true')
    expect(getByRole('button', { name: 'head 4' }).getAttribute('aria-pressed')).toBe('true')
  })
})
