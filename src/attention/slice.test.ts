import { describe, it, expect } from 'vitest'
import { sliceAttention } from './slice'

// dims: layers=2, heads=2, T=2 → flat length 2*1*2*2*2 = 16
// layout [layer][batch=1][head][i][j]; value encodes layer*1000 + head*100 + i*10 + j
function makeData() {
  const L = 2, H = 2, T = 2
  const data = new Float32Array(L * 1 * H * T * T)
  let k = 0
  for (let l = 0; l < L; l++) for (let h = 0; h < H; h++) for (let i = 0; i < T; i++) for (let j = 0; j < T; j++)
    data[k++] = l * 1000 + h * 100 + i * 10 + j
  return data
}

describe('sliceAttention', () => {
  const data = makeData()
  const dims = { layers: 2, heads: 2, T: 2 }
  it('extracts the T×T matrix for a given layer/head', () => {
    expect(sliceAttention(data, dims, 0, 0)).toEqual([[0, 1], [10, 11]])
    expect(sliceAttention(data, dims, 1, 0)).toEqual([[1000, 1001], [1010, 1011]])
    expect(sliceAttention(data, dims, 0, 1)).toEqual([[100, 101], [110, 111]])
    expect(sliceAttention(data, dims, 1, 1)).toEqual([[1100, 1101], [1110, 1111]])
  })
})
