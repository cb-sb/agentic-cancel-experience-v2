import { useEffect, useRef, useState } from 'react'
import { useOrchestration } from '../../store/useOrchestration'

/**
 * Which focus presentation is being trialled — scaffolding, and dressed as it.
 *
 * This was a segmented control in the play's header, sitting between Preview
 * and Publish as though choosing between two prototypes of a drawer were a
 * property of the play. It is a question we are asking ourselves, so it moves
 * out of the product chrome entirely: a collapsed chip by the zoom controls,
 * dashed and grey, opened only when someone wants to compare.
 *
 * It stays live while a card is open, so the same edit can be flipped between
 * presentations without losing your place — which is the fastest way to feel
 * the difference between them.
 */
export function DemoChip() {
  const presentation = useOrchestration((s) => s.focusPresentation)
  const setPresentation = useOrchestration((s) => s.setFocusPresentation)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <div ref={box} className="flex justify-end">
        {open ? (
          <div className="flex items-center gap-1 rounded-xl border border-dashed border-slate-300 bg-white/95 p-1 shadow-sm backdrop-blur">
            <span className="pl-1.5 pr-0.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
              Focus
            </span>
            {(['overlay', 'drawer'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPresentation(v)}
                aria-pressed={presentation === v}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold capitalize transition-colors ${
                  presentation === v
                    ? 'bg-slate-100 text-slate-800'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            title={`Prototype: focus opens as a ${presentation}`}
            className="flex h-7 items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white/80 px-2 text-[11px] font-semibold text-slate-400 backdrop-blur transition-colors hover:text-slate-700"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 5h16v14H4zM14 5v14" />
            </svg>
            Demo
          </button>
        )}
    </div>
  )
}
