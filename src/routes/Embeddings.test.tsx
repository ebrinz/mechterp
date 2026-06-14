import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../embedder/embedder', () => ({
  Embedder: { create: async () => ({ embed: async () => ({ vector: Float32Array.from([1, 0]) }) }) },
}))
vi.mock('../vectorStore/vectorStore', () => ({
  VectorStore: {
    fromUrl: async () => ({
      knn: () => [{ id: 1, text: 'neighbor-text', emotion: 'joy', xyz: [0, 0, 0], distance: 0.1 }],
      centroids: () => [],
      all: () => [{ id: 1, text: 'point-zero-text', emotion: 'relief', xyz: [0, 0, 0], vec: Float32Array.from([1, 0]) }],
      count: () => 1,
    }),
  },
}))
// Fully stub the 3D Scene; expose its onPickPoint via a button so we can test focus wiring.
vi.mock('../scene/Scene', () => ({
  Scene: ({ onPickPoint }: { onPickPoint?: (i: number | null) => void }) => (
    <button onClick={() => onPickPoint && onPickPoint(0)}>pick-point-0</button>
  ),
}))

import Embeddings from './Embeddings'

describe('Embeddings (Stage 1)', () => {
  it('embeds typed text and shows a nearest neighbor', async () => {
    const { getByPlaceholderText, findByText } = render(<Embeddings />)
    await waitFor(() => getByPlaceholderText(/type a sentence/i))
    fireEvent.change(getByPlaceholderText(/type a sentence/i), { target: { value: 'I am grateful' } })
    expect(await findByText('neighbor-text')).toBeTruthy()
  })

  it('clicking a point focuses it: shows its text/emotion and its neighbors', async () => {
    const { getByText, findByText, findAllByText } = render(<Embeddings />)
    await waitFor(() => getByText('pick-point-0'))
    fireEvent.click(getByText('pick-point-0'))
    expect(await findByText('point-zero-text')).toBeTruthy()          // inspected card text
    expect((await findAllByText('relief'))[0]).toBeTruthy()           // inspected card emotion (may also appear in Legend)
    expect(await findByText('neighbor-text')).toBeTruthy()            // that point's neighbors
  })
})
