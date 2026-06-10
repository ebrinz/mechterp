import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Stub the WebGL canvas so jsdom can render children logic without a GPU.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
}))
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null }))

import { Scene } from './Scene'
import type { Point, XYZ } from '../types'

const pts: Point[] = [{ id: 1, text: 'a', emotion: 'joy', xyz: [0, 0, 0], vec: Float32Array.from([1, 0]) }]

describe('Scene', () => {
  it('renders without crashing given points and a live position', () => {
    const { getByTestId } = render(
      <Scene points={pts} centroids={[]} live={[1, 1, 1] as XYZ} trail={[[0, 0, 0]]} />,
    )
    expect(getByTestId('canvas')).toBeTruthy()
  })
})
