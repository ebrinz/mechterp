import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', code: '00', full: 'Intro', short: 'Intro', end: true },
  { to: '/embeddings', code: '01', full: 'Embeddings', short: 'Embed', end: false },
  { to: '/internals', code: '02', full: 'Internals', short: 'Intern', end: false },
]

export function NavHeader() {
  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-ink-700 bg-ink-900/80 px-3 backdrop-blur-sm sm:px-5">
      {/* brass registration tick on the masthead hairline */}
      <span className="pointer-events-none absolute -bottom-px left-5 h-[3px] w-6 bg-brass/80" />

      <NavLink to="/" end aria-label="MechTerp" className="group flex items-baseline gap-2">
        <span className="text-brass" aria-hidden>
          ✦
        </span>
        <span className="font-display text-xl font-semibold leading-none tracking-tight text-paper">
          Mech<span className="italic font-normal text-paper/70">Terp</span>
        </span>
        <span className="readout hidden text-ink-600 sm:inline">field unit</span>
      </NavLink>

      <nav className="flex items-stretch gap-0.5 sm:gap-1">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            aria-label={l.full}
            className={({ isActive }) =>
              `group relative flex min-h-[44px] items-center gap-1.5 px-2 font-mono text-[11px] tracking-wide transition-colors sm:px-3 sm:text-xs ${
                isActive ? 'text-brass' : 'text-ink-600 hover:text-paper'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`tabular-nums ${isActive ? 'text-brass/70' : 'text-ink-600/70'}`}>
                  {l.code}
                </span>
                <span className="hidden sm:inline">{l.full}</span>
                <span className="sm:hidden">{l.short}</span>
                {/* active underline indicator */}
                <span
                  className={`pointer-events-none absolute -bottom-px left-2 right-2 h-[2px] origin-left bg-brass transition-transform sm:left-3 sm:right-3 ${
                    isActive ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
