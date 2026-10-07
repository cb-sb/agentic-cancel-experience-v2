import type { ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { navItem } from '../../layout/navStyle'

export interface PaneRowSpec {
  id: string
  label: string
  icon: SIconName
  active?: boolean
  section?: boolean
  onClick: () => void
  add?: ReactNode
  trailing?: ReactNode
  showWhenFolded?: boolean
}

export interface PaneSectionSpec {
  id: string
  title: string
  rows: PaneRowSpec[]
}

export function PaneRow({ row }: { row: PaneRowSpec }) {
  return (
    <div className={`group relative flex h-8 items-center ${navItem(row.active, row.section)}`}>
      <button
        type="button"
        onClick={row.onClick}
        aria-current={row.active ? 'page' : undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-[10px] px-[10px] text-left"
      >
        <SIcon name={row.icon} size={16} className="slg-nav-icon flex-none" />
        <span className="slg-pane-label min-w-0 flex-1 truncate">{row.label}</span>
        {row.trailing}
      </button>
      {row.add && (
        <div className="absolute right-[6px] top-1/2 flex -translate-y-1/2 bg-inherit pl-[4px] opacity-0 transition-opacity group-hover:opacity-100 has-[:focus-visible]:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          {row.add}
        </div>
      )}
    </div>
  )
}

export function PaneSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[2px]">
      <div className="flex h-7 items-end px-[10px] pb-[4px]">
        <span className="slg-pane-head">{title}</span>
      </div>
      {children}
    </section>
  )
}

function HeaderButton({ label, icon, onClick }: { label: string; icon: SIconName; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`${navItem()} flex h-8 w-8 flex-none items-center justify-center`}>
      <SIcon name={icon} size={18} className="slg-nav-icon" />
    </button>
  )
}

/** The V9 pane grammar, shared by every concierge objective. */
export function ObjectivePaneShell({
  title,
  folded,
  onSearch,
  onToggle,
  topRows,
  sections,
  recent,
  footer,
}: {
  title: string
  folded: boolean
  onSearch: () => void
  onToggle: () => void
  topRows: PaneRowSpec[]
  sections: PaneSectionSpec[]
  recent: ReactNode
  footer: PaneRowSpec
}) {
  const foldedRows = [...topRows, ...sections.flatMap((section) => section.rows)].filter((row) => row.showWhenFolded)
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className={`flex h-[60px] flex-none items-center border-b border-slate-200 ${folded ? 'justify-center' : 'gap-[2px] px-[14px]'}`}>
        {!folded && (
          <span className="min-w-0 flex-1 truncate font-[family-name:var(--slg-font-family-emphasis)] text-[16px] font-semibold text-[var(--slg-neutral-900,#0f172a)]">
            {title}
          </span>
        )}
        {!folded && <HeaderButton label="Search" icon="search" onClick={onSearch} />}
        <HeaderButton label={folded ? 'Open side panel' : 'Close side panel'} icon="panel-left" onClick={onToggle} />
      </div>

      {folded ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-[2px] px-[8px] py-[10px]">
            <button type="button" title="Search" aria-label="Search" onClick={onSearch} className={`${navItem()} flex h-9 w-full items-center justify-center`}>
              <SIcon name="search" size={16} className="slg-nav-icon" />
            </button>
            {foldedRows.map((row) => (
              <button
                key={row.id}
                type="button"
                title={row.label}
                aria-label={row.label}
                aria-current={row.active ? 'page' : undefined}
                onClick={row.onClick}
                className={`${navItem(row.active, row.section)} flex h-9 w-full items-center justify-center`}
              >
                <SIcon name={row.icon} size={16} className="slg-nav-icon" />
              </button>
            ))}
          </div>
          <div className="flex-none border-t border-slate-200 px-[8px] py-[8px]">
            <button
              type="button"
              title={footer.label}
              aria-label={footer.label}
              aria-current={footer.active ? 'page' : undefined}
              onClick={footer.onClick}
              className={`${navItem(footer.active)} flex h-9 w-full items-center justify-center`}
            >
              <SIcon name={footer.icon} size={16} className="slg-nav-icon" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[10px] pb-[16px] pt-[10px]">
            {topRows.map((row) => <PaneRow key={row.id} row={row} />)}
            {sections.map((section) => (
              <PaneSection key={section.id} title={section.title}>
                {section.rows.map((row) => <PaneRow key={row.id} row={row} />)}
              </PaneSection>
            ))}
            {recent}
          </div>
          <div className="flex-none border-t border-slate-200 px-[10px] py-[8px]">
            <PaneRow row={footer} />
          </div>
        </>
      )}
    </aside>
  )
}
