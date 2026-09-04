import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useExperience } from '../store/useExperience'
import { useRenderCtx } from '../render/RenderContext'
import { canAddToStep, hasCapRoom, labelFor } from '../lib/guardrails'
import type { ComponentKind, Step } from '../types/experience'

const ADDABLE: ComponentKind[] = ['loss_aversion', 'survey', 'offer']

function KindIcon({ kind }: { kind: ComponentKind }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'loss_aversion':
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" />
        </svg>
      )
    case 'survey':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      )
    case 'offer':
      return (
        <svg {...common}>
          <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7" />
          <path d="M2 7h20v5H2zM12 21V7M12 7H8.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h3.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />
        </svg>
      )
    case 'pricing_table':
      return (
        <svg {...common}>
          <path d="M4 4h16v16H4zM4 9h16M10 9v11" />
        </svg>
      )
    default:
      return null
  }
}

/**
 * In-card affordance to add a second component beside (or, on mobile, below) the
 * current one. Only component kinds the guardrails permit for this step are
 * offered; when nothing can be added the slot renders nothing. The picker is
 * rendered in a portal so the surrounding modal's `overflow-hidden` never
 * clips it.
 */
export function AddComponentSlot({ step, stacked = false }: { step: Step; stacked?: boolean }) {
  const experience = useExperience((s) => s.experience)
  const addComponent = useExperience((s) => s.addComponent)
  const { shell } = useRenderCtx()
  // On the hosted full-page layouts the slot is a big half-width canvas beside
  // the content (matching the reference); modal keeps the compact side column.
  const large = !stacked && shell !== 'modal'
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const options = ADDABLE.map((kind) => ({ kind, check: canAddToStep(step, kind), capRoom: hasCapRoom(experience, kind) })).filter(
    (o) => o.check.ok && o.capRoom,
  )

  // Keep the portalled menu anchored to the button on scroll / resize.
  useLayoutEffect(() => {
    if (!menu) return
    const reposition = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (r) setMenu({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu !== null])

  if (options.length === 0) return null

  const open = menu !== null
  const toggle = () => {
    if (open) {
      setMenu(null)
      return
    }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setMenu({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
  }

  return (
    <div
      className={`relative flex items-stretch ${
        stacked ? 'w-full min-h-[120px]' : large ? 'min-h-[240px] flex-1 self-stretch' : 'w-[112px] flex-none self-stretch'
      }`}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`group flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-center transition-all duration-150 ${
          large ? 'gap-3 p-8' : 'gap-2 p-4'
        } ${
          open
            ? 'border-blue-400 bg-blue-50/60'
            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-[0_0_0_4px_rgba(59,130,246,0.06)]'
        }`}
      >
        <span
          className={`flex items-center justify-center rounded-full border border-dashed transition-all duration-150 ${
            large ? 'h-14 w-14' : 'h-9 w-9'
          } ${
            open
              ? 'border-blue-400 bg-white text-blue-600'
              : 'border-slate-300 text-slate-400 group-hover:scale-110 group-hover:border-blue-400 group-hover:text-blue-600'
          }`}
        >
          <svg width={large ? 26 : 18} height={large ? 26 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span
          className={`font-semibold transition-colors ${large ? 'text-[16px]' : 'text-[13px]'} ${
            open ? 'text-blue-600' : 'text-slate-500 group-hover:text-blue-600'
          }`}
        >
          Add component
        </span>
        <span className={`leading-snug text-slate-400 ${large ? 'text-[12px]' : 'text-[11px]'}`}>
          {stacked ? 'Added below this one' : 'Placed beside this one'}
        </span>
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[999]" onClick={() => setMenu(null)} />
            <div
              className="fixed z-[1000] w-56 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl"
              style={{ left: menu.x, top: menu.y }}
            >
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {stacked ? 'Add below' : 'Add to the side'}
              </div>
              {options.map((o) => (
                <button
                  key={o.kind}
                  type="button"
                  onClick={() => {
                    addComponent(step.id, o.kind)
                    setMenu(null)
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                >
                  <span className="text-slate-400">
                    <KindIcon kind={o.kind} />
                  </span>
                  {labelFor(o.kind)}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}
