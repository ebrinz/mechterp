/** token×token attention grid. matrix[i][j] = attention from row token i to col token j (0..1). */
export function AttentionHeatmap({ tokens, matrix }: { tokens: string[]; matrix: number[][] }) {
  const T = tokens.length
  return (
    <div className="overflow-auto">
      <div
        className="grid gap-[1px]"
        style={{ gridTemplateColumns: `minmax(60px, auto) repeat(${T}, minmax(18px, 1fr))` }}
      >
        <div />
        {tokens.map((t, j) => (
          <div key={`c${j}`} className="px-0.5 text-center text-[10px] text-gray-400" title={t}>
            <span className="inline-block max-w-[48px] truncate align-bottom">{t}</span>
          </div>
        ))}
        {matrix.map((row, i) => (
          <Row key={`r${i}`} token={tokens[i]} row={row} colTokens={tokens} />
        ))}
      </div>
    </div>
  )
}

function Row({ token, row, colTokens }: { token: string; row: number[]; colTokens: string[] }) {
  return (
    <>
      <div className="truncate pr-1 text-right text-[10px] leading-[18px] text-gray-400" title={token}>{token}</div>
      {row.map((v, j) => (
        <div
          key={j}
          data-testid="att-cell"
          title={`${token} → ${colTokens[j]}: ${v.toFixed(2)}`}
          className="h-[18px] w-full rounded-[1px]"
          style={{ backgroundColor: `rgba(129,140,248,${Math.max(0, Math.min(1, v)).toFixed(3)})` }}
        />
      ))}
    </>
  )
}
