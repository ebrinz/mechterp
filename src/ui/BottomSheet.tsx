import { useState, type ReactNode } from 'react'

export function BottomSheet({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-20 overflow-y-auto border-t border-ink-700 bg-ink-900/95 px-4 pb-4 pt-2 shadow-sheet backdrop-blur-sm transition-all md:static md:z-0 md:h-full md:max-h-none md:border-l md:border-t-0 md:bg-ink-900/60 md:py-4 md:shadow-none md:backdrop-blur-0 ${
        expanded ? 'max-h-[62dvh]' : 'max-h-[22dvh]'
      }`}
    >
      {/* brass registration tick on the sheet seam (mobile) */}
      <span className="pointer-events-none absolute left-4 top-0 h-[3px] w-6 bg-brass/80 md:hidden" />
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mx-auto mb-3 mt-1 block h-1 w-10 rounded-full bg-ink-600 transition-colors hover:bg-brass md:hidden"
        aria-label="toggle panel"
      />
      {children}
    </div>
  )
}
