import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AttentionHeatmap } from './AttentionHeatmap'

describe('AttentionHeatmap', () => {
  const tokens = ['[CLS]', 'hi', '[SEP]']
  const matrix = [
    [0.8, 0.1, 0.1],
    [0.2, 0.7, 0.1],
    [0.3, 0.3, 0.4],
  ]
  it('renders a cell per matrix entry and labels the tokens', () => {
    const { getAllByTestId, getAllByText } = render(<AttentionHeatmap tokens={tokens} matrix={matrix} />)
    expect(getAllByTestId('att-cell').length).toBe(9)
    expect(getAllByText('hi').length).toBeGreaterThanOrEqual(1)
  })
  it('encodes the weight in each cell title', () => {
    const { getAllByTestId } = render(<AttentionHeatmap tokens={tokens} matrix={matrix} />)
    const first = getAllByTestId('att-cell')[0]
    expect(first.getAttribute('title')).toMatch(/0\.80/)
  })
})
