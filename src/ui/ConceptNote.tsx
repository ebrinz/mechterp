import type { ReactNode } from 'react'

/** A collapsible "field note" explaining what the user is looking at.
 *  Open by default — the explanation is the point — but collapsible to focus. */
export function ConceptNote({
  summary = 'what am i looking at?',
  children,
}: {
  summary?: string
  children: ReactNode
}) {
  return (
    <details open className="plate group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 readout text-brass [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <span className="text-ink-400 transition-transform duration-200 group-open:rotate-180" aria-hidden>
          ⌄
        </span>
      </summary>
      <div className="space-y-2.5 border-t border-ink-700 px-3 py-3 font-mono text-[12px] leading-relaxed text-paper/85">
        {children}
      </div>
    </details>
  )
}
