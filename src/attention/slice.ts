export interface AttentionDims { layers: number; heads: number; T: number }

/** Extract the T×T attention matrix for one (layer, head) from a flat [L,1,H,T,T] tensor. */
export function sliceAttention(data: Float32Array, dims: AttentionDims, layer: number, head: number): number[][] {
  const { heads, T } = dims
  const matrix: number[][] = []
  // element [layer][0][head][i][j] in a row-major [L,1,H,T,T] tensor:
  //   (((layer * heads) + head) * T + i) * T + j
  for (let i = 0; i < T; i++) {
    const row: number[] = []
    for (let j = 0; j < T; j++) {
      row.push(data[(((layer * heads + head) * T) + i) * T + j])
    }
    matrix.push(row)
  }
  return matrix
}
