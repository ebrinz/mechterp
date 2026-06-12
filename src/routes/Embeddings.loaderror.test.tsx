import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../embedder/embedder', () => ({
  Embedder: { create: async () => ({ embed: async () => ({ vector: Float32Array.from([1, 0]) }) }) },
}))
vi.mock('../vectorStore/vectorStore', () => ({
  VectorStore: { fromUrl: async () => { throw new Error('not a database') } },
}))
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: any) => <div>{children}</div>, useFrame: () => {} }))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Line: () => null,
  Text: () => null,
  Billboard: ({ children }: any) => children,
  Html: ({ children }: any) => children,
}))

import Embeddings from './Embeddings'

describe('Embeddings load error handling', () => {
  it('shows an error message instead of an infinite spinner when data fails to load', async () => {
    const { findByText } = render(<Embeddings />)
    expect(await findByText(/failed to load data/i)).toBeTruthy()
  })
})
