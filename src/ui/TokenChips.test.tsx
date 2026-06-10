import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TokenChips } from './TokenChips'

describe('TokenChips', () => {
  it('calls onToggle with the clicked index', () => {
    const onToggle = vi.fn()
    const { getByText } = render(
      <TokenChips tokens={[{ index: 0, text: 'hi', masked: false }]} onToggle={onToggle} />,
    )
    fireEvent.click(getByText('hi'))
    expect(onToggle).toHaveBeenCalledWith(0)
  })
})
