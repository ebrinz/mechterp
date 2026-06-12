import { Routes, Route } from 'react-router-dom'
import { NavHeader } from './ui/NavHeader'
import { Intro } from './routes/Intro'
import { Internals } from './routes/Internals'
import Embeddings from './routes/Embeddings'

export function AppLayout() {
  return (
    <div className="flex h-[100dvh] flex-col">
      <NavHeader />
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/embeddings" element={<Embeddings />} />
        <Route path="/internals" element={<Internals />} />
      </Routes>
    </div>
  )
}
