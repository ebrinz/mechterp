import { Link } from 'react-router-dom'

function StageCard({ to, eyebrow, title, body, soon }: { to: string; eyebrow: string; title: string; body: string; soon?: boolean }) {
  return (
    <Link
      to={to}
      className="group relative flex w-full max-w-sm flex-col gap-2 rounded-xl border border-gray-800 bg-gray-900/60 p-5 text-left transition hover:border-indigo-500"
    >
      {soon && (
        <span className="absolute right-4 top-4 rounded-full bg-indigo-600/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
          coming soon
        </span>
      )}
      <span className="text-xs uppercase tracking-wide text-gray-500">{eyebrow}</span>
      <span className="text-lg font-semibold text-gray-100">{title}</span>
      <span className="text-sm text-gray-400">{body}</span>
    </Link>
  )
}

export function Intro() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto bg-gray-950 p-6 text-center text-gray-100">
      <div className="max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight">MechTerp</h1>
        <p className="mt-2 text-lg text-gray-400">An introduction to mechanistic interpretability.</p>
        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          Explore how a small language model (<code className="text-gray-300">all-MiniLM-L6-v2</code>) represents and
          processes <em>emotion</em> using the GoEmotions dataset — starting from its black-box embeddings and working
          toward the internal mechanics that produce them.
        </p>
      </div>
      <div className="flex w-full max-w-3xl flex-col items-stretch justify-center gap-4 md:flex-row">
        <StageCard
          to="/embeddings"
          eyebrow="Stage 1"
          title="Embedding Space →"
          body="Type a sentence and watch where it lands — and drifts — in a 3D map of emotion embeddings."
        />
        <StageCard
          to="/internals"
          eyebrow="Stage 2"
          title="Internals"
          body="Crack the model open: attention patterns and how a sentence's representation forms layer by layer."
          soon
        />
      </div>
    </main>
  )
}
