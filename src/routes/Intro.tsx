import { Link } from 'react-router-dom'

export function Intro() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto bg-gray-950 p-6 text-center text-gray-100">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MechTerp</h1>
        <p className="mt-2 text-gray-400">An introduction to mechanistic interpretability.</p>
      </div>
      <Link to="/embeddings" className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
        Stage 1 · Embedding Space →
      </Link>
    </main>
  )
}
