import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { ExperiencePage } from '../concierge/objective/ExperiencePage'
import { PlayPage } from '../concierge/objective/PlayPage'
import { ThreadView } from '../layout/StudioWorkspace'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { RuleBuilder } from '../orchestration/NodeSetup'
import { SlantedTab } from '../shell/SlantedTab'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { activeKind, useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { DropdownButton, ToastHost, useOutside, type MenuItem } from '../plays/ui'
import { PlayWorkspace } from '../plays/PlayWorkspace'
import { rowsFor, titleOf, useV10Rows, type V10Row } from './rows'
import { V10_GUTTER, V10Table } from './V10Table'
import { updateAudience, useAudiences } from './useAudiences'
import {
  createV10Audience,
  createV10CancelPage,
  createV10Experience,
  createV10GrowthPlay,
  createV10Play,
  createV10RetentionPlay,
  syncV10FromHash,
  useV10,
  type ExperienceSlice,
  type Filters,
  type Tag,
  type V10Ref,
  type V10Scope,
  type V10Tab,
} from './useV10'

const TAB_TITLE: Record<V10Tab, string> = { plays: 'Plays', experiences: 'Experiences', audiences: 'Audiences' }
const TAGS: { id: Tag; label: string }[] = [
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'expansion', label: 'Expansion' },
  { id: 'retention', label: 'Retention' },
]
const KIND: Record<V10Tab, V10Row['kind']> = { plays: 'play', experiences: 'experience', audiences: 'audience' }
const VIEWS: V10Tab[] = ['plays', 'experiences', 'audiences']
const PLAY_SCOPES: { id: V10Scope; label: string }[] = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'expansion', label: 'Expansion' },
  { id: 'retention', label: 'Retention' },
]
const EXPERIENCE_SLICES: { id: ExperienceSlice; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in_app_offer', label: 'In-app offers' },
  { id: 'pricing_table', label: 'Pricing tables' },
  { id: 'cancel_page', label: 'Cancel pages' },
]
const SORTS: { id: Filters['sort']; label: string }[] = [
  { id: 'recent', label: 'Last updated' },
  { id: 'name', label: 'Name' },
]
const GROUPS: { id: Filters['group']; label: string }[] = [
  { id: 'none', label: 'No grouping' },
  { id: 'tag', label: 'Tag' },
  { id: 'status', label: 'Status' },
  { id: 'type', label: 'Type' },
]
const STATUS_PILLS: { id: 'live' | 'draft'; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'draft', label: 'Draft' },
]
const NEW_ITEMS: Record<V10Tab, MenuItem[]> = {
  plays: [
    {
      label: 'Acquisition play',
      icon: 'rocket',
      items: [
        { label: 'In-app offer play', icon: 'gift', onClick: () => createV10GrowthPlay('acquisition', 'in_app_offer') },
        { label: 'Pricing table play', icon: 'table', onClick: () => createV10GrowthPlay('acquisition', 'pricing_table') },
        { label: 'Empty play', icon: 'workflow', onClick: createV10Play },
      ],
    },
    {
      label: 'Expansion play',
      icon: 'arrow-up-right',
      items: [
        { label: 'In-app offer play', icon: 'gift', onClick: () => createV10GrowthPlay('expansion', 'in_app_offer') },
        { label: 'Pricing table play', icon: 'table', onClick: () => createV10GrowthPlay('expansion', 'pricing_table') },
        { label: 'Empty play', icon: 'workflow', onClick: () => createV10GrowthPlay('expansion') },
      ],
    },
    { label: 'Retention play', icon: 'repeat', onClick: createV10RetentionPlay },
  ],
  experiences: [
    {
      label: 'In-app offer',
      icon: 'gift',
      items: [
        { label: 'For Acquisition', icon: 'rocket', onClick: () => createV10Experience('in_app_offer', 'acquisition') },
        { label: 'For Expansion', icon: 'arrow-up-right', onClick: () => createV10Experience('in_app_offer', 'expansion') },
      ],
    },
    {
      label: 'Pricing table',
      icon: 'table',
      items: [
        { label: 'For Acquisition', icon: 'rocket', onClick: () => createV10Experience('pricing_table', 'acquisition') },
        { label: 'For Expansion', icon: 'arrow-up-right', onClick: () => createV10Experience('pricing_table', 'expansion') },
      ],
    },
    { label: 'Cancel page', icon: 'file-text', onClick: createV10CancelPage },
  ],
  audiences: [{ label: 'Audience', icon: 'users', onClick: createV10Audience }],
}

function tagLabel(tag: Tag) {
  return TAGS.find((item) => item.id === tag)?.label ?? tag
}

function filtersOf(view: Filters): Filters {
  return {
    query: view.query,
    tags: view.tags,
    status: view.status,
    group: view.group,
    sort: view.sort,
    scope: view.scope,
    slice: view.slice,
    columns: view.columns,
  }
}

/** The added view selected for this tab, or the tab's default view. Edits save to whichever is on screen. */
function useCurrentView(tab: V10Tab) {
  const saved = useV10((state) => state.saved)
  const active = useV10((state) => state.active)
  const defaults = useV10((state) => state.filters[tab])
  const view = saved.find((item) => item.id === active && item.tab === tab) ?? null
  const filters = view ? filtersOf(view) : defaults
  const set = (patch: Partial<Filters>) => (view ? useV10.getState().updateView(view.id, patch) : useV10.getState().setFilters(tab, patch))
  return { view, filters, set }
}

/** One place. Plays, Experiences and Audiences are the default views; merchants add their own beside them. */
export function V10Screen({ tab }: { tab: V10Tab }) {
  const open = useV10((state) => state.open)
  const route = useGrowthShell((state) => state.route)
  const detail = open !== null && open.kind === KIND[tab]
  useEffect(() => {
    const sync = () => syncV10FromHash(route, window.location.hash)
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [route])
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-white">
      <ViewBar tab={tab} detail={detail} />
      {detail && open ? (
        <div className="min-h-0 flex-1">
          <Detail row={open} />
        </div>
      ) : (
        <List tab={tab} />
      )}
      <ToastHost />
    </div>
  )
}

function ViewBar({ tab, detail }: { tab: V10Tab; detail: boolean }) {
  const { view, filters } = useCurrentView(tab)
  if (detail) return <DetailBreadcrumb tab={tab} viewName={view?.name ?? null} filters={filters} />
  return (
    <div className={`flex-none ${V10_GUTTER} pt-[20px]`}>
      <div className="flex min-h-[43px] items-end gap-[12px] border-b border-[#1b1a2e]">
        <div role="tablist" aria-label="Views" className="flex min-w-0 flex-1 items-end overflow-x-auto pl-[6px] pt-[7px]">
          {VIEWS.map((id, index) => (
            <ViewTab key={id} tab={id} label={TAB_TITLE[id]} on={!view && id === tab} first={index === 0} />
          ))}
        </div>
        <div className="self-center"><SavedViews tab={tab} /></div>
      </div>
      <div className="flex min-h-[42px] items-center gap-[12px] border-b border-slate-200">
        <SystemViews tab={tab} filters={filters} />
        <div className="min-w-0 flex-1" />
        <Tools tab={tab} />
      </div>
    </div>
  )
}

function DetailBreadcrumb({ tab, viewName, filters }: { tab: V10Tab; viewName: string | null; filters: Filters }) {
  const open = useV10((state) => state.open)
  const rows = useV10Rows()
  const title = open ? titleOf(rows, open) : ''
  const crumbs: { label: string; onClick?: () => void }[] = [
    { label: TAB_TITLE[tab], onClick: () => useV10.getState().selectSystemView(tab, 'portfolio', 'all') },
  ]
  if (viewName) crumbs.push({ label: viewName, onClick: () => useV10.getState().close() })
  else if (tab === 'plays' && filters.scope !== 'portfolio') {
    const label = PLAY_SCOPES.find((item) => item.id === filters.scope)?.label ?? filters.scope
    crumbs.push({ label, onClick: () => useV10.getState().selectSystemView(tab, filters.scope) })
  } else if (tab === 'experiences' && filters.slice !== 'all') {
    const label = EXPERIENCE_SLICES.find((item) => item.id === filters.slice)?.label ?? filters.slice
    crumbs.push({ label, onClick: () => useV10.getState().selectSystemView(tab, 'portfolio', filters.slice) })
  }
  crumbs.push({ label: title })
  return (
    <div className={`flex-none border-b border-slate-200 ${V10_GUTTER}`}>
      <nav aria-label="Breadcrumb" className="flex h-[48px] min-w-0 items-center gap-[8px] text-[13px]">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-[8px]">
            {index > 0 && (
              <SIcon name="chevron-right" size={12} className="flex-none text-slate-300" />
            )}
            {crumb.onClick ? (
              <button type="button" onClick={crumb.onClick} className="flex-none text-slate-500 hover:text-slate-900">
                {crumb.label}
              </button>
            ) : (
              <span aria-current="page" className="truncate font-medium text-slate-900">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>
    </div>
  )
}

function SystemViews({ tab, filters }: { tab: V10Tab; filters: Filters }) {
  if (tab === 'audiences') {
    return <span className="px-[2px] text-[13px] font-medium text-slate-700">All audiences</span>
  }
  const items = tab === 'plays' ? PLAY_SCOPES : EXPERIENCE_SLICES
  return (
    <div role="tablist" aria-label={`${TAB_TITLE[tab]} system views`} className="flex min-w-0 items-center gap-[18px] overflow-x-auto">
      {items.map((item) => {
        const on = tab === 'plays' ? filters.scope === item.id : filters.slice === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => {
              if (tab === 'plays') useV10.getState().selectSystemView(tab, item.id as V10Scope)
              else useV10.getState().selectSystemView(tab, 'portfolio', item.id as ExperienceSlice)
            }}
            className={`relative h-[42px] whitespace-nowrap text-[13px] ${
              on ? 'font-medium text-slate-900 after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function SavedViews({ tab }: { tab: V10Tab }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const allSaved = useV10((state) => state.saved)
  const saved = allSaved.filter((view) => view.tab === tab)
  const active = useV10((state) => state.active)
  useOutside(open, ref, () => setOpen(false))
  const add = () => {
    const current = useV10.getState().filters[tab]
    useV10.getState().addView(tab, undefined, current)
    setOpen(false)
  }
  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-[28px] items-center gap-[6px] rounded-md px-[8px] text-[12.5px] ${
          active ? 'bg-slate-100 font-medium text-slate-800' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }`}
      >
        <SIcon name="bookmark" size={14} />
        Saved views
        <SIcon name="chevron-down" size={13} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-[6px] w-[240px] rounded-xl border border-slate-200 bg-white p-[4px] shadow-[0_12px_40px_rgba(15,23,42,0.16)]">
          {saved.length === 0 && <p className="px-[10px] py-[8px] text-[12px] text-slate-400">No saved views yet.</p>}
          {saved.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => {
                useV10.getState().selectView(tab, view.id)
                setOpen(false)
              }}
              className={`flex w-full items-center rounded-lg px-[10px] py-[7px] text-left text-[13px] hover:bg-slate-100 ${active === view.id ? 'font-medium text-slate-900' : 'text-slate-700'}`}
            >
              <span className="min-w-0 flex-1 truncate">{view.name}</span>
              {active === view.id && <SIcon name="check" size={13} />}
            </button>
          ))}
          <div className="my-[4px] border-t border-slate-100" />
          <button type="button" onClick={add} className="flex w-full items-center gap-[8px] rounded-lg px-[10px] py-[7px] text-left text-[13px] text-slate-700 hover:bg-slate-100">
            <SIcon name="plus" size={14} />
            Save current view
          </button>
          {active && (
            <>
              <button
                type="button"
                onClick={() => {
                  const view = saved.find((item) => item.id === active)
                  const name = view ? window.prompt('Rename saved view', view.name) : null
                  if (view && name?.trim()) useV10.getState().updateView(view.id, { name: name.trim() })
                  setOpen(false)
                }}
                className="flex w-full items-center gap-[8px] rounded-lg px-[10px] py-[7px] text-left text-[13px] text-slate-700 hover:bg-slate-100"
              >
                <SIcon name="pencil" size={14} />
                Rename current view
              </button>
              <button
                type="button"
                onClick={() => {
                  const view = saved.find((item) => item.id === active)
                  if (view) useV10.getState().deleteView(view.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-[8px] rounded-lg px-[10px] py-[7px] text-left text-[13px] text-rose-700 hover:bg-rose-50"
              >
                <SIcon name="trash-2" size={14} />
                Delete current view
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ViewTab({ tab, label, on, first }: { tab: V10Tab; label: string; on: boolean; first: boolean }) {
  return (
    <SlantedTab
      label={label}
      active={on}
      first={first}
      rounded
      role="tab"
      aria-selected={on}
      onClick={() => useV10.getState().selectSystemView(tab, 'portfolio', 'all')}
    />
  )
}

function Tools({ tab }: { tab: V10Tab }) {
  const { filters, set } = useCurrentView(tab)
  const items = newItemsFor(tab, filters)
  const newLabel =
    tab === 'plays' && filters.scope !== 'portfolio'
      ? `New ${tagLabel(filters.scope as Tag).toLowerCase()} play`
      : tab === 'experiences' && filters.slice !== 'all'
        ? `New ${EXPERIENCE_SLICES.find((slice) => slice.id === filters.slice)?.label.slice(0, -1).toLowerCase()}`
      : 'New'
  return (
    <div className="flex flex-none items-center gap-[6px]">
      <SearchField tab={tab} value={filters.query} onChange={(query) => set({ query })} />
      <div role="group" aria-label="Status" className="flex items-center gap-[4px]">
        <StatusPill label="All" on={filters.status.length === 0} onClick={() => set({ status: [] })} />
        {STATUS_PILLS.map((status) => (
          <StatusPill
            key={status.id}
            label={status.label}
            on={filters.status.includes(status.id)}
            onClick={() => set({ status: filters.status.includes(status.id) ? filters.status.filter((item) => item !== status.id) : [...filters.status, status.id] })}
          />
        ))}
      </div>
      <ToolMenu icon="more-horizontal" label="More" on={filters.tags.length > 0 || filters.sort !== 'recent' || filters.group !== 'none' || filters.columns.includes('hide-edited')}>
        <MenuHeading>Objective filter</MenuHeading>
        {TAGS.map((tag) => (
          <Option
            key={tag.id}
            label={tag.label}
            on={filters.tags.includes(tag.id)}
            onClick={() => set({ tags: filters.tags.includes(tag.id) ? filters.tags.filter((item) => item !== tag.id) : [...filters.tags, tag.id] })}
          />
        ))}
        <MenuHeading>Sort by</MenuHeading>
        {SORTS.map((sort) => (
          <Option key={sort.id} label={sort.label} on={filters.sort === sort.id} onClick={() => set({ sort: sort.id })} />
        ))}
        <MenuHeading>Group by</MenuHeading>
        {GROUPS.map((group) => (
          <Option key={group.id} label={group.label} on={filters.group === group.id} onClick={() => set({ group: group.id })} />
        ))}
        <MenuHeading>Columns</MenuHeading>
        <Option
          label="Updated date"
          on={!filters.columns.includes('hide-edited')}
          onClick={() => set({ columns: filters.columns.includes('hide-edited') ? filters.columns.filter((item) => item !== 'hide-edited') : [...filters.columns, 'hide-edited'] })}
        />
      </ToolMenu>
      <div className="ml-[8px]">
        <DropdownButton label={newLabel} items={items} width={240} />
      </div>
    </div>
  )
}

function newItemsFor(tab: V10Tab, filters: Filters): MenuItem[] {
  if (tab === 'experiences') {
    if (filters.slice === 'in_app_offer') return NEW_ITEMS.experiences[0].items ?? []
    if (filters.slice === 'pricing_table') return NEW_ITEMS.experiences[1].items ?? []
    if (filters.slice === 'cancel_page') return [NEW_ITEMS.experiences[2]]
    return NEW_ITEMS.experiences
  }
  if (tab === 'audiences') return NEW_ITEMS.audiences
  if (filters.scope === 'acquisition') return NEW_ITEMS.plays[0].items ?? []
  if (filters.scope === 'expansion') return NEW_ITEMS.plays[1].items ?? []
  if (filters.scope === 'retention') return [NEW_ITEMS.plays[2]]
  return NEW_ITEMS.plays
}

function ToolButton({ icon, label, on, open, onClick }: { icon: SIconName; label: string; on?: boolean; open?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={open}
      onClick={onClick}
      className={`flex h-[28px] w-[28px] items-center justify-center rounded-md hover:bg-slate-100 ${on ? 'text-[#2383e2]' : 'text-slate-500 hover:text-slate-800'} ${open ? 'bg-slate-100' : ''}`}
    >
      <SIcon name={icon} size={15} />
    </button>
  )
}

function ToolMenu({ icon, label, on, children }: { icon: SIconName; label: string; on: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(open, ref, () => setOpen(false))
  return (
    <div ref={ref} className="relative">
      <ToolButton icon={icon} label={label} on={on} open={open} onClick={() => setOpen((value) => !value)} />
      {open && (
        <div role="menu" aria-label={label} className="absolute right-0 top-full z-50 mt-[6px] w-[220px] rounded-xl border border-slate-200 bg-white p-[4px] shadow-[0_12px_40px_rgba(15,23,42,0.16)]">
          {children}
        </div>
      )}
    </div>
  )
}

function SearchField({ tab, value, onChange }: { tab: V10Tab; value: string; onChange: (query: string) => void }) {
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const help = `Search ${TAB_TITLE[tab].toLowerCase()}...`
  const field = useRef<HTMLDivElement>(null)
  const shown = open || value.length > 0
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  return (
    <div
      ref={field}
      onBlur={() => {
        window.setTimeout(() => {
          if (!field.current?.contains(document.activeElement) && !value) setOpen(false)
        }, 0)
      }}
      className={`flex h-[30px] items-center overflow-hidden transition-[width] duration-200 ease-out ${shown ? 'w-[210px]' : 'w-[24px]'}`}
    >
      <button
        type="button"
        aria-label={help}
        aria-expanded={shown}
        onClick={() => setOpen(true)}
        className="flex h-[24px] w-[24px] flex-none items-center justify-center text-slate-900"
      >
        <SIcon name="search" size={16} />
      </button>
      <input
        ref={input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange('')
            setOpen(false)
            input.current?.blur()
          }
        }}
        placeholder={help}
        aria-label={help}
        tabIndex={shown ? 0 : -1}
        className={`min-w-0 flex-1 bg-transparent pr-[4px] text-[14px] text-slate-800 outline-none transition-opacity duration-200 placeholder:text-slate-400 ${shown ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
    </div>
  )
}

function StatusPill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-[22px] rounded-full px-[8px] text-[11.5px] font-medium ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {label}
    </button>
  )
}

function MenuHeading({ children }: { children: ReactNode }) {
  return <p className="px-[10px] pb-[2px] pt-[8px] text-[11.5px] font-medium text-slate-400 first:pt-[4px]">{children}</p>
}

function Option({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={on}
      onClick={onClick}
      className="flex w-full items-center gap-[8px] rounded-lg px-[10px] py-[6px] text-left text-[13px] text-slate-700 hover:bg-slate-100"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {on && <SIcon name="check" size={14} className="flex-none text-[#2383e2]" />}
    </button>
  )
}

function List({ tab }: { tab: V10Tab }) {
  const rows = rowsFor(useV10Rows(), KIND[tab])
  const { filters, set } = useCurrentView(tab)
  const shown = applyFilters(rows, filters)
  const groups = groupRows(shown, filters.group)
  const pills: { id: string; label: string; clear: () => void }[] = [
    ...(filters.tags.length > 0 ? [{ id: 'tags', label: `Tag: ${filters.tags.map(tagLabel).join(', ')}`, clear: () => set({ tags: [] }) }] : []),
    ...(filters.status.length > 0 ? [{ id: 'status', label: `Status: ${filters.status.map((status) => (status === 'live' ? 'Live' : 'Draft')).join(', ')}`, clear: () => set({ status: [] }) }] : []),
  ]
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className={`${V10_GUTTER} pb-[24px]`}>
        {pills.length > 0 && (
          <div className="flex flex-wrap items-center gap-[6px] pt-[10px]">
            {pills.map((pill) => (
              <span key={pill.id} className="inline-flex h-[26px] items-center gap-[4px] rounded-full border border-[#2383e2]/30 bg-[#2383e2]/5 pl-[10px] pr-[6px] text-[12px] text-[#1f6fbf]">
                {pill.label}
                <button type="button" aria-label={`Clear ${pill.id}`} onClick={pill.clear} className="flex h-[16px] w-[16px] items-center justify-center rounded-full hover:bg-[#2383e2]/10">
                  <SIcon name="x" size={11} />
                </button>
              </span>
            ))}
            <button type="button" onClick={() => set({ tags: [], status: [] })} className="h-[26px] px-[6px] text-[12px] text-slate-500 hover:text-slate-800">
              Clear
            </button>
          </div>
        )}
        <div className="pt-[12px]">
          <p className="mb-[8px] text-[12px] tabular-nums text-slate-400">
            {shown.length} {shown.length === 1 ? TAB_TITLE[tab].slice(0, -1).toLowerCase() : TAB_TITLE[tab].toLowerCase()}
          </p>
          <V10Table tab={tab} scope={filters.scope} shown={shown} groups={groups} grouped={filters.group !== 'none'} showEdited={!filters.columns.includes('hide-edited')} />
        </div>
      </div>
    </div>
  )
}

function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`h-[28px] rounded-full px-[10px] text-[12px] font-medium ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
      {label}
    </button>
  )
}

function applyFilters(rows: V10Row[], filters: Filters): V10Row[] {
  const query = filters.query.trim().toLowerCase()
  const next = rows.filter((row) => {
    if (query && !row.title.toLowerCase().includes(query)) return false
    if (filters.scope !== 'portfolio' && !row.tags.includes(filters.scope)) return false
    if (row.kind === 'experience' && filters.slice !== 'all') {
      const label = filters.slice === 'in_app_offer' ? 'In-app offer' : filters.slice === 'pricing_table' ? 'Pricing table' : 'Cancel page'
      if (row.type !== label) return false
    }
    if (filters.tags.length > 0 && !row.tags.some((tag) => filters.tags.includes(tag))) return false
    if (filters.status.length > 0 && !filters.status.includes(row.status)) return false
    return true
  })
  next.sort((a, b) => (filters.sort === 'name' ? a.title.localeCompare(b.title) : b.updatedAt - a.updatedAt))
  return next
}

function groupRows(rows: V10Row[], group: Filters['group']): { label: string; rows: V10Row[] }[] {
  if (group === 'none') return [{ label: '', rows }]
  const key = (row: V10Row) => (group === 'status' ? (row.status === 'live' ? 'Live' : 'Draft') : group === 'type' ? row.type : '')
  if (group !== 'tag') {
    const labels = [...new Set(rows.map(key))]
    return labels.map((label) => ({ label, rows: rows.filter((row) => key(row) === label) }))
  }
  return TAGS.map((tag) => ({ label: tag.label, rows: rows.filter((row) => row.tags.includes(tag.id)) })).filter((section) => section.rows.length > 0)
}

function Detail({ row }: { row: V10Ref }) {
  if (row.kind === 'play' && row.source === 'growth' && row.objective) return <PlayPage objective={row.objective} />
  if (row.kind === 'experience' && row.source === 'growth' && row.objective) return <ExperiencePage objective={row.objective} />
  if (row.kind === 'play' && row.source === 'retention') {
    return (
      <Frame label="Plays">
        <PlayWorkspace />
      </Frame>
    )
  }
  if (row.kind === 'experience' && row.source === 'retention') return <RetentionExperience />
  if (row.kind === 'audience') return <AudienceDetail id={row.id} />
  return null
}

/** A cancel page, with the V9 views: Editor, Preview, Summary, Task list and Canvas. */
function RetentionExperience() {
  const page = useWorkspaceUi((state) => state.page)
  const activeTab = useWorkspaceUi((state) => activeKind(state.tabs))
  const stepCount = useExperience((state) => state.experiences[PRIMARY_EXPERIENCE_ID]?.steps.length ?? 0)
  const focusTarget = useOrchestration((state) => state.focusTarget)
  useEffect(() => {
    if (page !== 'thread') useV10.getState().close()
  }, [page])
  useEffect(() => {
    if (activeTab !== 'editor' || focusTarget || stepCount === 0) return
    useOrchestration.getState().enterWorkEditor()
  }, [activeTab, focusTarget, stepCount])
  return <ThreadView />
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[40px] flex-none items-center border-b border-slate-100 px-[12px]">
        <button type="button" onClick={() => useV10.getState().close()} className="text-[12.5px] font-medium text-slate-500 hover:text-slate-900">
          Back to {label}
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

function AudienceDetail({ id }: { id: string }) {
  const audience = useAudiences((state) => state.items.find((item) => item.id === id))
  const pinned = useV10((state) => state.pins.some((pin) => pin.kind === 'audience' && pin.id === id))
  const tags = useV10((state) => state.tags[id])
  const rows = useV10Rows()
  const row = rows.find((item) => item.kind === 'audience' && item.id === id)
  if (!audience) return <p className="p-[28px] text-[13px] text-slate-500">This audience was deleted.</p>
  const current = tags && tags.length > 0 ? tags : row?.tags ?? []
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[760px] px-[28px] py-[24px]">
        <div className="mb-[16px] flex items-center gap-[8px]">
          <button type="button" onClick={() => useV10.getState().close()} className="text-[12.5px] font-medium text-slate-500 hover:text-slate-900">
            Audiences
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => useV10.getState().togglePin({ kind: 'audience', source: 'audience', id })}
            className={`h-[28px] rounded-md px-[8px] text-[12px] font-medium ${pinned ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {pinned ? 'Pinned' : 'Pin'}
          </button>
          <button type="button" onClick={() => useV10.getState().close()} className="h-[28px] rounded-md bg-[#1a56db] px-[12px] text-[12px] font-semibold text-white">
            Done
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-[20px]">
          <label className="block">
            <span className="mb-[4px] block text-[12px] font-medium text-slate-500">Audience name</span>
            <input value={audience.name} onChange={(event) => updateAudience(id, { name: event.target.value })} className="w-full border-b border-transparent text-[18px] font-semibold text-slate-900 outline-none focus:border-slate-300" />
          </label>
          <div className="mt-[12px] flex flex-wrap gap-[6px]">
            {TAGS.map((tag) => {
              const on = current.includes(tag.id)
              return (
                <FilterChip
                  key={tag.id}
                  label={tag.label}
                  on={on}
                  onClick={() => {
                    const next = on ? current.filter((item) => item !== tag.id) : [...current, tag.id]
                    useV10.getState().setTags(id, next.length > 0 ? next : current)
                  }}
                />
              )
            })}
          </div>
          <h2 className="mt-[20px] text-[14px] font-semibold text-slate-900">Audience definition</h2>
          <p className="mb-[8px] text-[12.5px] text-slate-500">Set criteria to define a rule.</p>
          <RuleBuilder conditions={audience.conditions ?? []} match={audience.match ?? 'AND'} onChange={(conditions, match) => updateAudience(id, { conditions, match: match ?? audience.match ?? 'AND' })} />
        </div>
      </div>
    </div>
  )
}
