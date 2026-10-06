import { useState, type ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { RowMenu, type MenuItem } from '../plays/ui'
import { ago } from './ThreadSidebar'
import './slgTable.css'

/**
 * v9 list views, after the sting-slg Table: uppercase heads between two
 * strong rules, single-line rows on light dividers, solid rows on hover.
 * Callers pass a grid template so heads and rows line up.
 */

export const TABLE_HEAD =
  'h-[37px] border-b border-[var(--slg-color-border-strong)] px-[16px] text-[11px] font-semibold uppercase leading-[14px] whitespace-nowrap text-[var(--slg-neutral-900)]'

export const TABLE_ROW = 'slg-row min-h-[40px] border-b border-[var(--slg-color-border-default)] px-[16px] text-[13px] font-medium leading-[18px] text-[var(--slg-color-text-primary)]'

/** A row that opens something. It goes solid on hover. */
export const TABLE_ROW_OPEN = `${TABLE_ROW} slg-row--open cursor-pointer`

export function TableHead({ cols, children }: { cols: string; children: ReactNode }) {
  return <div className={`${cols} ${TABLE_HEAD}`}>{children}</div>
}

export function TableRow({ cols, onOpen, children, className = '' }: { cols: string; onOpen: () => void; children: ReactNode; className?: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen()
      }}
      className={`${cols} ${TABLE_ROW_OPEN} ${className}`}
    >
      {children}
    </div>
  )
}

export function TableEmpty({ children }: { children: ReactNode }) {
  return <p className="border-b border-[var(--slg-color-border-default)] px-[16px] py-[11px] text-[13px] text-slate-500">{children}</p>
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase()
}

/** The small square at the start of a row: two letters, a number or an icon. */
export function RowMark({ children, icon }: { children?: ReactNode; icon?: SIconName }) {
  return (
    <span className="slg-avatar flex h-[20px] min-w-[20px] flex-none items-center justify-center bg-[var(--slg-neutral-100)] px-[4px] text-[10px] font-semibold tabular-nums text-[var(--slg-color-text-secondary)]">
      {icon ? <SIcon name={icon} size={12} /> : children}
    </span>
  )
}

/** "18 h ago" with the number strong and the unit muted. */
export function Ago({ at }: { at: number }) {
  const text = ago(at)
  const m = /^(\d+)\s*(.+)$/.exec(text)
  if (!m) return <span className="truncate">{text}</span>
  return (
    <span className="truncate tabular-nums">
      {m[1]} <span className="text-slate-500">{m[2]}</span>
    </span>
  )
}

/** The ⋮ at the end of a row. Clicks stay in the menu. */
export function RowActions({ label, items }: { label: string; items: MenuItem[] }) {
  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="flex justify-end">
      <RowMenu label={label} items={items} icon="more-vertical" />
    </div>
  )
}

/** Which rows are ticked. Rows that drop out of the list (filtered, archived) stop counting. */
export function useSelection(ids: string[]) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set())
  const picked = ids.filter((id) => ticked.has(id))
  return {
    picked,
    has: (id: string) => ticked.has(id),
    toggle: (id: string) =>
      setTicked((s) => {
        const next = new Set(s)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    setAll: (on: boolean) => setTicked(on ? new Set(ids) : new Set()),
    clear: () => setTicked(new Set()),
  }
}

/** A square tick box. Clicks on it never open the row. */
export function Check({ on, onChange, label }: { on: boolean | 'some'; onChange: () => void; label: string }) {
  return (
    <span onClick={(e) => e.stopPropagation()} className="flex h-full items-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={on === 'some' ? 'mixed' : on}
        aria-label={label}
        onClick={onChange}
        className={`slg-check flex h-[16px] w-[16px] flex-none items-center justify-center border ${on ? 'is-on' : ''}`}
      >
        {on && <SIcon name={on === 'some' ? 'minus' : 'check'} size={12} />}
      </button>
    </span>
  )
}

/** A bulk action. With `confirm`, the first click asks and the second does it. */
export function BulkAction({ icon, label, confirm, onClick }: { icon: SIconName; label: string; confirm?: string; onClick: () => void }) {
  const [asking, setAsking] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm && !asking) setAsking(true)
        else {
          setAsking(false)
          onClick()
        }
      }}
      onBlur={() => setAsking(false)}
      className={`flex h-[28px] items-center gap-[6px] px-[8px] text-[12px] font-semibold normal-case tracking-normal ${
        asking ? 'bg-[var(--slg-red-50,#fef2f2)] text-[var(--slg-red-700,#b91c1c)]' : 'hover:bg-[var(--slg-neutral-100)]'
      }`}
    >
      <SIcon name={icon} size={14} />
      {asking ? confirm : label}
    </button>
  )
}

/**
 * A table head with a tick box first. Once anything is ticked it turns into
 * a bar: the count, the bulk actions, and a way to clear.
 */
export function SelectHead({
  cols,
  total,
  picked,
  onAll,
  onClear,
  actions,
  children,
}: {
  cols: string
  total: number
  picked: number
  onAll: (on: boolean) => void
  onClear: () => void
  actions: ReactNode
  children: ReactNode
}) {
  const all = total > 0 && picked === total
  if (picked === 0) {
    return (
      <div className={`${cols} ${TABLE_HEAD}`}>
        <Check on={false} onChange={() => onAll(true)} label="Select all" />
        {children}
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-[16px] bg-[var(--slg-neutral-50)] ${TABLE_HEAD}`}>
      <Check on={all ? true : 'some'} onChange={() => onAll(!all)} label={all ? 'Clear selection' : 'Select all'} />
      <span className="min-w-0 flex-1 truncate">{picked} selected</span>
      <div className="flex items-center gap-[4px]">
        {actions}
        <BulkAction icon="x" label="Clear" onClick={onClear} />
      </div>
    </div>
  )
}
