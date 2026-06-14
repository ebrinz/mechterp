import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../attention/attentionModel', () => ({
  AttentionModel: {
    create: async () => ({
      analyze: async () => ({
        tokens: ['[CLS]', 'hi', '[SEP]'],
        dims: { layers: 6, heads: 12, T: 3 },
        data: Float32Array.from({ length: 6 * 1 * 12 * 3 * 3 }, () => 0.33),
      }),
    }),
  },
}))

import { Internals } from './Internals'

describe('Internals attention explorer', () => {
  it('analyzes typed text and renders the heatmap', async () => {
    const { getByPlaceholderText, getAllByTestId } = render(<MemoryRouter><Internals /></MemoryRouter>)
    await waitFor(() => expect((getByPlaceholderText(/type a sentence/i) as HTMLInputElement).disabled).toBe(false))
    fireEvent.change(getByPlaceholderText(/type a sentence/i), { target: { value: 'hi there' } })
    await waitFor(() => expect(getAllByTestId('att-cell').length).toBe(9))
  })
})
