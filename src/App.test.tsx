import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./embedder/embedder', () => ({
  Embedder: { create: async () => ({ embed: async () => ({ vector: Float32Array.from([1, 0]) }) }) },
}))
vi.mock('./vectorStore/vectorStore', () => ({
  VectorStore: {
    fromUrl: async () => ({
      knn: () => [{ id: 1, text: 'a', emotion: 'joy', xyz: [0, 0, 0], distance: 0.1 }],
      centroids: () => [],
      all: () => [{ id: 1, text: 'a', emotion: 'joy', xyz: [0, 0, 0], vec: Float32Array.from([1, 0]) }],
      count: () => 1,
    }),
  },
}))
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: any) => <div>{children}</div>, useFrame: () => {} }))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Line: () => null,
  Text: () => null,
  Billboard: ({ children }: any) => children,
  Html: ({ children }: any) => children,
}))

import App from './App'

describe('App', () => {
  it('embeds typed text and shows a nearest neighbor', async () => {
    const { getByPlaceholderText, findByText } = render(<App />)
    await waitFor(() => getByPlaceholderText(/type a sentence/i))
    fireEvent.change(getByPlaceholderText(/type a sentence/i), { target: { value: 'I am grateful' } })
    expect(await findByText('joy')).toBeTruthy()
  })
})
