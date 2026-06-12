import { Link } from 'react-router-dom'

export function Internals() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto bg-gray-950 p-6 text-center text-gray-100">
      <h1 className="text-2xl font-bold">Stage 2 · Internals</h1>
      <p className="text-indigo-300">coming soon</p>
      <Link to="/embeddings" className="text-sm text-gray-400 underline">← Back to Stage 1</Link>
    </main>
  )
}
