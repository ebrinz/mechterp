import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', full: 'Intro', short: 'Intro', end: true },
  { to: '/embeddings', full: 'Stage 1 · Embeddings', short: 'Stage 1', end: false },
  { to: '/internals', full: 'Stage 2 · Internals', short: 'Stage 2', end: false },
]

export function NavHeader() {
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-gray-800 bg-gray-950 px-4 text-gray-100">
      <NavLink to="/" end className="text-sm font-semibold tracking-wide">
        MechTerp
      </NavLink>
      <nav className="flex items-center gap-1 sm:gap-2">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `flex min-h-[44px] items-center rounded px-2 text-xs sm:text-sm ${
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'
              }`
            }
          >
            <span className="md:hidden">{l.short}</span>
            <span className="hidden md:inline">{l.full}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
