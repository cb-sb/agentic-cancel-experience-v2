import { useEffect, useRef, type ReactNode } from 'react'

export interface AddOption {
  id: string
  label: string
  desc?: string
  /** Stated rather than implied: a greyed row with no reason is a dead end. */
  disabledReason?: string
  onPick: () => void
}

export interface AddSection {
  title: string
  options: AddOption[]
}

/**
 * The one menu every "add" on the canvas opens.
 *
 * There are four places a merchant can add something — a gap between columns, a
 * step's toolbar, the split's column, the canvas toolbar — and each of them used
 * to be its own popover or its own bespoke button. Granularity is what tells
 * them apart (a play node, a step, a component), not the shape of the control,
 * so the shape is shared and the sections say what is on offer.
 */
export function AddMenu({
  sections,
  align = 'center',
  side = 'below',
  onClose,
}: {
  sections: AddSection[]
  align?: 'center' | 'left'
  /** Which way it opens — the palette lives at the bottom of the pane. */
  side?: 'below' | 'above'
  onClose: () => void
}) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const live = sections.filter((s) => s.options.length)
  if (!live.length) return null

  return (
    <>
      {/* Anything outside dismisses it, including the canvas behind. */}
      <div className="fixed inset-0 z-40" onPointerDown={onClose} />
      <div
        ref={box}
        className={`nowheel nopan absolute z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-2xl ${
          side === 'below' ? 'top-full mt-2' : 'bottom-full mb-2'
        } ${align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {live.map((section, i) => (
          <div key={section.title} className={i ? 'mt-1 border-t border-slate-100 pt-1' : ''}>
            <div className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {section.title}
            </div>
            {section.options.map((o) => (
              <Row key={o.id} option={o} onClose={onClose} />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

function Row({ option, onClose }: { option: AddOption; onClose: () => void }) {
  const disabled = Boolean(option.disabledReason)
  return (
    <button
      type="button"
      disabled={disabled}
      title={option.disabledReason}
      className="flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left transition-colors enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        option.onPick()
        onClose()
      }}
    >
      <span className="text-[12.5px] font-semibold text-slate-800">{option.label}</span>
      {(option.disabledReason || option.desc) && (
        <span className="truncate text-[11px] text-slate-400">
          {option.disabledReason ?? option.desc}
        </span>
      )}
    </button>
  )
}

/** The trigger the menus hang off, so all four sit at the same size. */
export function AddButton({
  title,
  open,
  size = 26,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  size?: number
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`nowheel nopan flex items-center justify-center rounded-full border-2 border-dashed bg-white shadow-sm transition-colors ${
        open
          ? 'border-indigo-500 text-indigo-600'
          : 'border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600'
      }`}
      style={{ width: size, height: size }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {children}
    </button>
  )
}
