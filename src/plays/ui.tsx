import { useEffect, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { SButton, SIcon, type SIconName } from '@chargebee/sting-react'

export interface MenuItem {
  label: string
  icon?: SIconName
  onClick?: () => void
  danger?: boolean
  /** Asks once more before running, with this line. */
  confirm?: string
  /** Opens a nested list in place instead of running. */
  items?: MenuItem[]
  disabled?: boolean
  hint?: string
}

function useOutside(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, ref, close])
}

function MenuList({ items, close }: { items: MenuItem[]; close: () => void }) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [nested, setNested] = useState<MenuItem | null>(null)
  if (nested) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setNested(null)}
          className="flex w-full items-center gap-[6px] rounded-lg px-[10px] py-[6px] text-left text-[12px] font-semibold text-slate-500 hover:bg-slate-100"
        >
          <SIcon name="arrow-left" size={12} />
          {nested.label.replace(/…$/, '')}
        </button>
        <div className="my-[2px] h-px bg-slate-100" />
        {nested.items!.length === 0 && <p className="px-[10px] py-[6px] text-[12px] text-slate-400">Nothing to pick</p>}
        <MenuList items={nested.items!} close={close} />
      </div>
    )
  }
  return (
    <>
      {items.map((item) => {
        const asking = confirming === item.label
        return (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={(e) => {
              e.stopPropagation()
              if (item.items) {
                setNested(item)
                return
              }
              if (item.confirm && !asking) {
                setConfirming(item.label)
                return
              }
              close()
              item.onClick?.()
            }}
            className={`flex w-full items-center gap-[8px] rounded-lg px-[10px] py-[6px] text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-40 ${
              item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {item.icon && <SIcon name={item.icon} size={14} className="flex-none opacity-80" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{asking ? item.confirm : item.label}</span>
              {item.hint && !asking && <span className="block truncate text-[11.5px] text-slate-400">{item.hint}</span>}
            </span>
            {item.items && <SIcon name="chevron-right" size={12} className="flex-none text-slate-400" />}
          </button>
        )
      })}
    </>
  )
}

/** The ⋯ button on a pane row, and its list. */
export function RowMenu({
  items,
  label,
  className = '',
  icon = 'more-horizontal',
  align = 'right',
  width = 220,
}: {
  items: MenuItem[]
  label: string
  className?: string
  icon?: SIconName
  /** `beside` opens to the right of the button, outside a narrow pane. */
  align?: 'left' | 'right' | 'beside'
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(open, ref, () => setOpen(false))
  return (
    <div ref={ref} className={`relative flex-none ${className}`}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900 ${open ? 'bg-white text-slate-900' : ''}`}
      >
        <SIcon name={icon} size={14} />
      </button>
      {open && (
        <div
          role="menu"
          style={{ width }}
          className={`absolute z-50 rounded-xl border border-slate-200 bg-white p-[4px] shadow-[0_12px_40px_rgba(15,23,42,0.16)] ${
            align === 'beside' ? 'left-full top-0 ml-[8px]' : `top-full mt-[4px] ${align === 'right' ? 'right-0' : 'left-0'}`
          }`}
        >
          <MenuList items={items} close={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

/** A primary button that opens a list below it, lined up with its right edge. */
export function DropdownButton({ label, items, width = 270 }: { label: string; items: MenuItem[]; width?: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(open, ref, () => setOpen(false))
  return (
    <div ref={ref} className="relative flex-none">
      <SButton size="small" variant="primary" className="w-auto" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="inline-flex items-center gap-[6px]">
          {label}
          <SIcon name="chevron-down" size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </SButton>
      {open && (
        <div
          role="menu"
          style={{ width }}
          className="absolute right-0 top-full z-50 mt-[6px] rounded-xl border border-slate-200 bg-white p-[4px] text-left shadow-[0_12px_40px_rgba(15,23,42,0.16)]"
        >
          <MenuList items={items} close={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

/**
 * A name that edits in place. Enter saves, Escape puts it back. `onCommit`
 * returns what's wrong with the name, or null once it's saved.
 */
export function InlineName({
  value,
  editing,
  onStart,
  onDone,
  onCommit,
  className = '',
  inputClassName = '',
}: {
  value: string
  editing: boolean
  onStart: () => void
  onDone: () => void
  onCommit: (name: string) => string | null
  className?: string
  inputClassName?: string
}) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!editing) return
    setDraft(value)
    setError(null)
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [editing, value])

  if (!editing) {
    return (
      <span
        onDoubleClick={(e) => {
          e.stopPropagation()
          onStart()
        }}
        title="Double-click to rename"
        className={`block min-w-0 truncate ${className}`}
      >
        {value}
      </span>
    )
  }

  const commit = () => {
    if (draft.trim() === value) {
      onDone()
      return
    }
    const problem = onCommit(draft)
    if (problem) {
      setError(problem)
      inputRef.current?.focus()
      return
    }
    onDone()
  }

  return (
    <span className="relative block min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        value={draft}
        aria-label="Name"
        aria-invalid={Boolean(error)}
        onChange={(e) => {
          setDraft(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') onDone()
        }}
        onBlur={() => {
          if (error) {
            onDone()
            return
          }
          commit()
        }}
        className={`w-full rounded-md border bg-white px-[6px] py-[2px] text-[13px] font-medium text-slate-900 outline-none ${
          error ? 'border-rose-400' : 'border-indigo-400'
        } ${inputClassName}`}
      />
      {error && (
        <span className="absolute left-0 top-full z-50 mt-[3px] whitespace-nowrap rounded-md bg-rose-600 px-[8px] py-[3px] text-[11.5px] font-medium text-white shadow">
          {error}
        </span>
      )}
    </span>
  )
}

interface Toast {
  id: number
  text: string
}

export const useToast = create<{ toast: Toast | null }>(() => ({ toast: null }))

let toastN = 0
export function toast(text: string) {
  const id = ++toastN
  useToast.setState({ toast: { id, text } })
  window.setTimeout(() => {
    if (useToast.getState().toast?.id === id) useToast.setState({ toast: null })
  }, 2600)
}

export function ToastHost() {
  const t = useToast((s) => s.toast)
  if (!t) return null
  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-[20px] left-1/2 z-[90] -translate-x-1/2 rounded-full bg-slate-900 px-[14px] py-[8px] text-[12.5px] font-medium text-white shadow-lg"
    >
      {t.text}
    </div>
  )
}

export function Chip({ children, tone = 'slate', title }: { children: ReactNode; tone?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose'; title?: string }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }
  return (
    <span title={title} className={`inline-flex flex-none items-center rounded-full px-[6px] py-[1px] text-[10.5px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}
