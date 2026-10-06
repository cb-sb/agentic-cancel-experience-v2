import { useRef, useState, type ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { EASE_ENTER, EASE_LEAVE } from '../lib/motion'
import { MenuList, useOutside, type MenuItem } from '../plays/ui'

/**
 * v9 page chrome from sting-slg: angled tabs on a strong baseline, a page
 * header that carries them, and ghost toolbar actions beside them.
 */

export interface TabItem<T extends string = string> {
  id: T
  label: string
  hint?: string
  count?: number
  onClose?: () => void
}

type TabSize = 'md' | 'sm'

const TAB_HEIGHT: Record<TabSize, string> = { md: 'h-[40px]', sm: 'h-[32px]' }

function Slope({ side }: { side: 'left' | 'right' }) {
  const fill = side === 'left' ? 'M0 40 L18 0 L18 40 Z' : 'M0 0 L18 40 L0 40 Z'
  const edge = side === 'left' ? 'M0.5 40 L18 0.5' : 'M0 0.5 L17.5 40'
  return (
    <svg
      aria-hidden
      viewBox="0 0 18 40"
      preserveAspectRatio="none"
      className={`absolute top-0 h-full w-[18px] overflow-visible ${side === 'left' ? 'left-0' : 'right-0'}`}
    >
      <path d={fill} fill="var(--tab-fill)" />
      <path d={edge} fill="none" stroke="var(--tab-edge)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** The trapezoid behind a tab, filled from --tab-fill and outlined with --tab-edge. Stops 1px short so the baseline shows. */
function TabShape() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[1px] top-0">
      <Slope side="left" />
      <span className="absolute inset-y-0 left-[17.5px] right-[17.5px] border-t border-[var(--tab-edge)] bg-[var(--tab-fill)] transition-colors" />
      <Slope side="right" />
    </span>
  )
}

const FOCUS =
  "outline-none focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-x-[12px] focus-visible:after:bottom-[5px] focus-visible:after:top-[3px] focus-visible:after:border-2 focus-visible:after:border-[var(--slg-color-focus-ring)] focus-visible:after:content-['']"

export function AngledTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  size = 'md',
}: {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  size?: TabSize
}) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar flex min-w-0 items-end overflow-x-auto overflow-y-hidden">
      {items.map((t, i) => {
        const on = t.id === value
        return (
          <div
            key={t.id}
            style={{ zIndex: on ? items.length + 20 : items.length - i + 2 }}
            className={`relative flex flex-none items-center ${TAB_HEIGHT[size]} ${i > 0 ? '-ml-[18px]' : ''} ${
              on
                ? 'text-[var(--slg-color-text-on-solid)] [--tab-edge:var(--slg-neutral-900)] [--tab-fill:var(--slg-neutral-900)]'
                : 'text-[var(--slg-color-text-primary)] [--tab-edge:var(--slg-neutral-900)] [--tab-fill:var(--slg-neutral-50)] hover:[--tab-fill:var(--slg-neutral-100)]'
            }`}
          >
            <TabShape />
            <button
              type="button"
              role="tab"
              aria-selected={on}
              title={t.hint}
              onClick={() => onChange(t.id)}
              onAuxClick={(e) => e.button === 1 && t.onClose?.()}
              className={`relative flex h-full items-center gap-[6px] whitespace-nowrap pb-[1px] text-[12px] font-medium uppercase leading-[18px] ${
                size === 'md' ? 'pl-[28px]' : 'pl-[24px]'
              } ${t.onClose ? 'pr-[6px]' : size === 'md' ? 'pr-[28px]' : 'pr-[24px]'} ${FOCUS}`}
            >
              {t.label}
              {t.count !== undefined && <span className="tabular-nums opacity-60">{t.count}</span>}
            </button>
            {t.onClose && (
              <button
                type="button"
                aria-label={`Close ${t.label}`}
                title={`Close ${t.label}`}
                onClick={t.onClose}
                className={`relative mb-[1px] flex h-[18px] w-[18px] flex-none items-center justify-center opacity-60 hover:opacity-100 ${
                  size === 'md' ? 'mr-[22px]' : 'mr-[18px]'
                }`}
              >
                <SIcon name="x" size={12} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The + tab after a row of tabs. Opens a list of what can be added. */
export function AddTab({ items, label = 'Open a tab', size = 'md', width = 260 }: { items: MenuItem[]; label?: string; size?: TabSize; width?: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(open, ref, () => setOpen(false))
  if (items.length === 0) return null
  return (
    <div
      ref={ref}
      className={`relative -ml-[16px] flex-none ${TAB_HEIGHT[size]} w-[64px] text-[var(--slg-blue-700)] [--tab-edge:transparent] [--tab-fill:var(--slg-color-bg-info-subtle)] hover:text-[var(--slg-blue-500)]`}
    >
      <TabShape />
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-full w-full items-center justify-center pb-[1px] ${FOCUS}`}
      >
        <SIcon name="plus" size={14} />
      </button>
      {open && (
        <div role="menu" style={{ width }} className="absolute left-[8px] top-full z-50 mt-[4px] border border-slate-200 bg-white p-[4px] text-left shadow-xl">
          <MenuList items={items} close={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

/** A row that sits on the strong 1px baseline. Tabs inside it stand on the line. */
export function TabRail({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative flex min-w-0 items-end ${className}`}>
      {children}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--slg-color-border-strong)]" />
    </div>
  )
}

/** Short facts after a title, split by thin rules. */
export function HeaderMeta({ items }: { items: ReactNode[] }) {
  const shown = items.filter((i) => i !== null && i !== undefined && i !== false)
  if (shown.length === 0) return null
  return (
    <div className="flex min-w-0 items-center gap-[8px] whitespace-nowrap text-[12px] font-medium leading-[18px] text-[var(--slg-color-text-muted)]">
      {shown.map((item, i) => (
        <span key={i} className="flex items-center gap-[8px]">
          {i > 0 && <span aria-hidden className="h-[16px] w-px bg-[var(--slg-color-border-default)]" />}
          {item}
        </span>
      ))}
    </div>
  )
}

/** Title, its meta, the tabs and the toolbar on one row over the baseline. */
export function PageHeader({
  title,
  meta,
  tabs,
  actions,
  tabsAlign = 'center',
  size = 'md',
  className = '',
}: {
  title: ReactNode
  meta?: ReactNode[]
  tabs?: ReactNode
  actions?: ReactNode
  tabsAlign?: 'center' | 'start'
  size?: TabSize
  className?: string
}) {
  const row = size === 'md' ? 'min-h-[40px]' : 'min-h-[32px]'
  return (
    <TabRail className={`gap-[24px] ${className}`}>
      <div className={`flex min-w-0 flex-none items-center gap-[12px] self-stretch pb-[1px] ${row}`}>
        {typeof title === 'string' ? <h1 className="truncate">{title}</h1> : title}
        {meta && <HeaderMeta items={meta} />}
      </div>
      <div className={`flex min-w-0 flex-1 ${tabsAlign === 'center' ? 'justify-center' : 'justify-start'}`}>{tabs}</div>
      {actions && <div className={`flex flex-none items-center gap-[4px] self-stretch pb-[1px] ${row}`}>{actions}</div>}
    </TabRail>
  )
}

const TOOL =
  'inline-flex h-[28px] flex-none items-center gap-[6px] text-[12px] font-medium leading-[18px] text-[var(--slg-color-text-primary)] transition-colors hover:bg-[var(--slg-color-bg-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--slg-color-focus-ring)]'

/** A borderless toolbar action. Without children it is a square icon button. */
export function ToolButton({
  icon,
  label,
  children,
  onClick,
  pressed,
  disabled,
}: {
  icon?: SIconName
  label: string
  children?: ReactNode
  onClick?: () => void
  pressed?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={children ? undefined : label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`${TOOL} ${children ? 'px-[8px]' : 'w-[28px] justify-center'} ${pressed ? 'bg-[var(--slg-color-bg-surface-muted)]' : ''}`}
    >
      {icon && <SIcon name={icon} size={14} className="flex-none" />}
      {children}
    </button>
  )
}

/** "Label: Value ⌄". Picks one option from a short list. */
export function ToolSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  align = 'right',
}: {
  label: string
  value: T
  options: { id: T; label: string; count?: number; hint?: string }[]
  onChange: (id: T) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(open, ref, () => setOpen(false))
  const current = options.find((o) => o.id === value) ?? options[0]
  return (
    <div ref={ref} className="relative flex-none">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${TOOL} px-[8px] ${open ? 'bg-[var(--slg-color-bg-surface-muted)]' : ''}`}>
        <span className="text-[var(--slg-color-text-muted)]">{label}:</span>
        <span className="font-semibold">{current?.label}</span>
        <SIcon name="chevron-down" size={13} className={`flex-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className={`absolute top-full z-50 mt-[4px] min-w-[200px] border border-slate-200 bg-white p-[4px] shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              onClick={() => {
                setOpen(false)
                onChange(o.id)
              }}
              className="flex w-full items-center gap-[8px] px-[10px] py-[6px] text-left text-[13px] text-slate-700 hover:bg-slate-100"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.hint && <span className="block truncate text-[11.5px] text-slate-400">{o.hint}</span>}
              </span>
              {o.count !== undefined && <span className="flex-none tabular-nums text-slate-400">{o.count}</span>}
              <SIcon name="check" size={13} className={`flex-none ${o.id === value ? 'text-slate-900' : 'invisible'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** A search icon that slides open into a field, and folds back when left empty. */
export function ToolSearch({
  value,
  onChange,
  placeholder,
  label = 'Search',
  width = 240,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label?: string
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const shown = open || value !== ''
  useOutside(open && !value, box, () => setOpen(false))
  const fold = () => {
    onChange('')
    setOpen(false)
  }
  return (
    <div
      ref={box}
      style={{
        width: shown ? width : 28,
        transition: shown ? `width 240ms ${EASE_ENTER}` : `width 160ms ${EASE_LEAVE}`,
      }}
      className={`flex h-[28px] flex-none items-center overflow-hidden transition-colors ${shown ? '' : 'hover:bg-[var(--slg-color-bg-surface-muted)]'}`}
    >
      <button
        type="button"
        aria-label={label}
        title={shown ? undefined : label}
        aria-expanded={shown}
        tabIndex={shown ? -1 : 0}
        onClick={() => {
          setOpen(true)
          input.current?.focus({ preventScroll: true })
        }}
        className="flex h-[28px] w-[28px] flex-none items-center justify-center text-[var(--slg-color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--slg-color-focus-ring)]"
      >
        <SIcon name="search" size={16} />
      </button>
      <input
        ref={input}
        value={value}
        tabIndex={shown ? 0 : -1}
        aria-hidden={!shown}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => !value && setOpen(false)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          fold()
          input.current?.blur()
        }}
        placeholder={placeholder}
        aria-label={label}
        className={`min-w-0 flex-1 bg-transparent pr-[6px] text-[13px] leading-[20px] text-[var(--slg-color-text-primary)] outline-none transition-opacity duration-200 placeholder:text-[var(--slg-color-text-secondary)] ${
          shown ? 'opacity-100 delay-75' : 'opacity-0'
        }`}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('')
            input.current?.focus({ preventScroll: true })
          }}
          className="mr-[6px] flex h-[18px] w-[18px] flex-none items-center justify-center text-[var(--slg-color-text-muted)] hover:text-[var(--slg-color-text-primary)]"
        >
          <SIcon name="x" size={13} />
        </button>
      )}
    </div>
  )
}

/** A thin rule between groups in a toolbar. */
export function ToolDivider() {
  return <span aria-hidden className="mx-[4px] h-[16px] w-px flex-none bg-[var(--slg-color-border-default)]" />
}
