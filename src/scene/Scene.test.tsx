import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Stub the WebGL canvas + useThree so jsdom can render children (incl. PointPicker) without a GPU.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
  useThree: () => ({
    camera: {},
    size: { width: 100, height: 100 },
    gl: {
      domElement: {
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        style: {},
      },
    },
  }),
}))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Line: () => null,
  Text: () => null,
  Billboard: ({ children }: any) => children,
  Html: ({ children }: any) => children,
}))

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

  it('renders the drift trail (>1 point) and a focused-point halo without throwing', () => {
    const { getByTestId } = render(
      <Scene
        points={pts}
        centroids={[]}
        live={[2, 2, 2] as XYZ}
        trail={[[0, 0, 0], [1, 1, 1], [2, 2, 2]]}
        focusedIndex={0}
        onPickPoint={() => {}}
      />,
    )
    expect(getByTestId('canvas')).toBeTruthy()
  })
})
