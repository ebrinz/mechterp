import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { InspectedCard } from './InspectedCard'
import type { Point } from '../types'

const point: Point = { id: 5, text: 'I am so relieved', emotion: 'relief', xyz: [0, 0, 0], vec: Float32Array.from([1, 0]) }

describe('InspectedCard', () => {
  it('shows the point text and emotion', () => {
    const { getByText } = render(<InspectedCard point={point} onClear={() => {}} />)
    expect(getByText('I am so relieved')).toBeTruthy()
    expect(getByText('relief')).toBeTruthy()
  })
  it('calls onClear when the clear button is clicked', () => {
    const onClear = vi.fn()
    const { getByRole } = render(<InspectedCard point={point} onClear={onClear} />)
    fireEvent.click(getByRole('button', { name: /clear inspection/i }))
    expect(onClear).toHaveBeenCalled()
  })
})
