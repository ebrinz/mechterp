/** token×token attention grid. matrix[i][j] = attention from row token i to col token j (0..1).
 *  Rendered as an amber-phosphor readout: brightness = attention weight. */
export function AttentionHeatmap({ tokens, matrix }: { tokens: string[]; matrix: number[][] }) {
  const T = tokens.length
  return (
    <div className="overflow-auto">
      <div
        className="inline-grid gap-px bg-ink-700 p-px"
        style={{ gridTemplateColumns: `minmax(52px, auto) repeat(${T}, minmax(22px, 1fr))` }}
      >
        <div className="bg-ink-900" />
        {tokens.map((t, j) => (
          <div
            key={`c${j}`}
            className="bg-ink-900 px-0.5 pb-1 text-center font-mono text-[10px] text-ink-400"
            title={t}
          >
            <span className="inline-block max-w-[52px] truncate align-bottom">{t}</span>
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
      <div
        className="truncate bg-ink-900 pr-1.5 text-right font-mono text-[10px] leading-[22px] text-ink-400"
        title={token}
      >
        {token}
      </div>
      {row.map((v, j) => {
        const a = Math.max(0, Math.min(1, v))
        return (
          <div
            key={j}
            data-testid="att-cell"
            title={`${token} → ${colTokens[j]}: ${v.toFixed(2)}`}
            className="h-[22px] w-full"
            style={{
              backgroundColor: `rgba(242, 194, 102, ${a.toFixed(3)})`,
              boxShadow: a > 0.5 ? `0 0 ${(a * 8).toFixed(1)}px -1px rgba(242,194,102,${(a * 0.5).toFixed(3)})` : undefined,
            }}
          />
        )
      })}
    </>
  )
}
