import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Data load fails (the real-world case: a stale dev server returns HTML for the wasm,
// or the sqlite 404s). The app must surface an error, not spin forever.
vi.mock('./embedder/embedder', () => ({
  Embedder: { create: async () => ({ embed: async () => ({ vector: Float32Array.from([1, 0]) }) }) },
}))
vi.mock('./vectorStore/vectorStore', () => ({
  VectorStore: { fromUrl: async () => { throw new Error('not a database') } },
}))
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: any) => <div>{children}</div>, useFrame: () => {} }))
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null, Line: () => null }))

import App from './App'

describe('App load error handling', () => {
  it('shows an error message instead of an infinite spinner when data fails to load', async () => {
    const { findByText } = render(<App />)
    expect(await findByText(/failed to load data/i)).toBeTruthy()
  })
})
