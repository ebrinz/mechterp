import { Link } from 'react-router-dom'

function StageCard({
  to,
  code,
  title,
  body,
  status,
  delay,
}: {
  to: string
  code: string
  title: string
  body: string
  status: string
  delay: string
}) {
  return (
    <Link
      to={to}
      style={{ animationDelay: delay }}
      className="plate group flex w-full max-w-md flex-1 animate-plate-in flex-col gap-3 p-5 text-left transition-colors duration-300 hover:border-brass/60 sm:p-6"
    >
      <div className="flex items-center justify-between">
        <span className="readout text-brass/80">stage {code}</span>
        <span className="flex items-center gap-1.5 readout text-ink-600">
          <span className="h-1.5 w-1.5 rounded-full bg-brass shadow-[0_0_8px] shadow-brass/60" />
          {status}
        </span>
      </div>

      <h2 className="font-display text-2xl font-medium leading-tight text-paper transition-colors group-hover:text-brass-bright sm:text-[1.7rem]">
        {title}
      </h2>

      <p className="font-mono text-[13px] leading-relaxed text-ink-600">{body}</p>

      <span className="mt-1 flex items-center gap-2 readout text-ink-600 transition-colors group-hover:text-brass">
        enter
        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
      </span>
    </Link>
  )
}

export function Intro() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-12 text-center">
      <div className="flex w-full max-w-3xl flex-col items-center">
        <span className="readout animate-fade-in text-brass/80" style={{ animationDelay: '0ms' }}>
          ✦ field guide · n°00
        </span>

        <h1
          className="mt-5 animate-plate-in font-display text-6xl font-semibold leading-[0.95] tracking-tight text-paper sm:text-7xl md:text-8xl"
          style={{ animationDelay: '60ms' }}
        >
          Mech<span className="font-normal italic text-paper/60">Terp</span>
        </h1>

        <p
          className="mt-4 animate-fade-in font-mono text-[11px] uppercase tracking-readout text-ink-600"
          style={{ animationDelay: '220ms' }}
        >
          a field instrument for mechanistic interpretability
        </p>

        <p
          className="mt-7 max-w-xl animate-fade-in font-display text-lg leading-relaxed text-paper/75 sm:text-xl"
          style={{ animationDelay: '320ms' }}
        >
          Every language model turns words into geometry. MechTerp charts that geometry — mapping how{' '}
          <span className="font-mono text-[0.85em] text-brass">all-MiniLM-L6-v2</span> arranges{' '}
          <em className="text-paper">emotion</em> in space, then opening the model to watch the machinery
          that puts it there.
        </p>
      </div>

      <div
        className="mt-12 flex w-full max-w-3xl animate-fade-in flex-col items-stretch gap-4 md:flex-row"
        style={{ animationDelay: '420ms' }}
      >
        <StageCard
          to="/embeddings"
          code="01"
          title="Embedding Space"
          body="Type a sentence and watch it land — and drift — through a 3-D survey of emotion embeddings. Mask a word; the point moves. That motion is saliency."
          status="open"
          delay="480ms"
        />
        <StageCard
          to="/internals"
          code="02"
          title="Internals · Attention"
          body="Crack the model open. Read its real self-attention as a token×token field — which words reach for which, head by head, layer by layer."
          status="live"
          delay="600ms"
        />
      </div>

      <p
        className="mt-10 animate-fade-in font-mono text-[10px] tracking-readout text-ink-700"
        style={{ animationDelay: '760ms' }}
      >
        runs entirely in your browser · no data leaves the device
      </p>
    </main>
  )
}
