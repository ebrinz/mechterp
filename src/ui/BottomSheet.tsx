import { useState, type ReactNode } from 'react'

export function BottomSheet({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div
      className={`fixed inset-x-0 bottom-0 rounded-t-2xl bg-gray-900/95 p-4 shadow-2xl transition-all md:static md:rounded-none ${
        expanded ? 'max-h-[60dvh]' : 'max-h-[20dvh]'
      } overflow-y-auto`}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-gray-600 md:hidden"
        aria-label="toggle panel"
      />
      {children}
    </div>
  )
}
