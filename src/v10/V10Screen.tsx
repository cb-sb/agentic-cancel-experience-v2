import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { ExperiencePage } from '../concierge/objective/ExperiencePage'
import { PlayPage } from '../concierge/objective/PlayPage'
import { ThreadView } from '../layout/StudioWorkspace'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { RuleBuilder } from '../orchestration/NodeSetup'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { activeKind, useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { DropdownButton, MenuList, ToastHost, useOutside, type MenuItem } from '../plays/ui'
import { PlayWorkspace } from '../plays/PlayWorkspace'
import { rowsFor, useV10Rows, type V10Row } from './rows'
import { V10_GUTTER, V10Table } from './V10Table'
import { updateAudience, useAudiences } from './useAudiences'
import {
  createV10Audience,
  createV10CancelPage,
  createV10Experience,
  createV10Play,
  createV10RetentionPlay,
  useV10,
  type Filters,
  type SavedView,
  type Tag,
  type V10Ref,
  type V10Tab,
} from './useV10'

const TAB_TITLE: Record<V10Tab, string> = { plays: 'Plays', experiences: 'Experiences', audiences: 'Audiences' }
const TAB_ICON: Record<V10Tab, SIconName> = { plays: 'workflow', experiences: 'layout-template', audiences: 'users' }
const TAGS: { id: Tag; label: string }[] = [
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'expansion', label: 'Expansion' },
  { id: 'retention', label: 'Retention' },
]
const KIND: Record<V10Tab, V10Row['kind']> = { plays: 'play', experiences: 'experience', audiences: 'audience' }
const VIEWS: V10Tab[] = ['plays', 'experiences', 'audiences']
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
const STATUSES: { id: Filters['status']; label: string }[] = [
  { id: 'any', label: 'Any status' },
  { id: 'live', label: 'Live' },
  { id: 'draft', label: 'Draft' },
]
const NEW_ITEMS: Record<V10Tab, MenuItem[]> = {
  plays: [
    { label: 'Play', icon: 'workflow', onClick: createV10Play },
    { label: 'Retention play', icon: 'repeat', onClick: createV10RetentionPlay },
  ],
  experiences: [
    { label: 'In-app offer', icon: 'gift', onClick: () => createV10Experience('in_app_offer') },
    { label: 'Pricing table', icon: 'table', onClick: () => createV10Experience('pricing_table') },
    { label: 'Cancel page', icon: 'file-text', onClick: createV10CancelPage },
  ],
  audiences: [{ label: 'Audience', icon: 'users', onClick: createV10Audience }],
}

function tagLabel(tag: Tag) {
  return TAGS.find((item) => item.id === tag)?.label ?? tag
}

function filtersOf(view: Filters): Filters {
  return { query: view.query, tags: view.tags, status: view.status, group: view.group, sort: view.sort }
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
  const detail = open !== null && open.kind === KIND[tab]
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
  const saved = useV10((state) => state.saved)
  const active = useV10((state) => state.active)
  const current = saved.find((view) => view.id === active && view.tab === tab)?.id ?? tab
  return (
    <div className={`flex-none ${detail ? `border-b border-slate-200 ${V10_GUTTER}` : `${V10_GUTTER} pt-[20px]`}`}>
      <div className={`flex min-h-[44px] items-center gap-[12px] ${detail ? '' : 'border-b border-slate-200'}`}>
        <div role="tablist" aria-label="Views" className="flex min-w-0 flex-1 flex-wrap items-center gap-[2px] py-[6px]">
          {VIEWS.map((id) => (
            <ViewTab key={id} tab={id} label={TAB_TITLE[id]} on={current === id} />
          ))}
          {saved.map((view) => (
            <ViewTab key={view.id} tab={view.tab} label={view.name} view={view} on={current === view.id} />
          ))}
          <AddView />
        </div>
        {!detail && <Tools tab={tab} />}
      </div>
    </div>
  )
}

function ViewTab({ tab, label, view, on }: { tab: V10Tab; label: string; view?: SavedView; on: boolean }) {
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(menu, ref, () => setMenu(false))
  const duplicate = () => {
    const from = view ? filtersOf(view) : useV10.getState().filters[tab]
    useV10.getState().addView(tab, `${label} copy`, from)
  }
  const items: MenuItem[] = view
    ? [
        { label: 'Rename', icon: 'pencil', onClick: () => setRenaming(true) },
        { label: 'Duplicate view', icon: 'copy', onClick: duplicate },
        { label: 'Delete view', icon: 'trash-2', danger: true, confirm: 'Delete this view?', onClick: () => useV10.getState().deleteView(view.id) },
      ]
    : [{ label: 'Duplicate view', icon: 'copy', onClick: duplicate }]

  if (renaming && view) {
    const commit = (value: string) => {
      if (value.trim()) useV10.getState().updateView(view.id, { name: value.trim() })
      setRenaming(false)
    }
    return (
      <input
        autoFocus
        defaultValue={view.name}
        aria-label="View name"
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value)
          if (event.key === 'Escape') setRenaming(false)
        }}
        className="h-[30px] w-[160px] rounded-md border border-slate-300 px-[8px] text-[13px] outline-none"
      />
    )
  }

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        role="tab"
        aria-selected={on}
        aria-haspopup={on ? 'menu' : undefined}
        onClick={() => (on ? setMenu((value) => !value) : useV10.getState().selectView(tab, view?.id ?? null))}
        onDoubleClick={() => view && setRenaming(true)}
        className={`flex h-[30px] items-center gap-[6px] rounded-md px-[8px] text-[13px] ${
          on ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        }`}
      >
        <SIcon name={TAB_ICON[tab]} size={14} className="flex-none" />
        <span className="max-w-[160px] truncate">{label}</span>
      </button>
      {menu && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-[4px] w-[200px] rounded-xl border border-slate-200 bg-white p-[4px] shadow-[0_12px_40px_rgba(15,23,42,0.16)]">
          <MenuList items={items} close={() => setMenu(false)} />
        </div>
      )}
    </div>
  )
}

function AddView() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(open, ref, () => setOpen(false))
  const add = (base: V10Tab) => {
    useV10.getState().addView(base)
    setOpen(false)
  }
  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        aria-label="Add a view"
        title="Add a view"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-[28px] w-[28px] items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${open ? 'bg-slate-100 text-slate-700' : ''}`}
      >
        <SIcon name="plus" size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-[6px] w-[300px] rounded-xl border border-slate-200 bg-white p-[10px] shadow-[0_12px_40px_rgba(15,23,42,0.16)]">
          <p className="px-[4px] pb-[8px] text-[12px] text-slate-500">New view of</p>
          <div className="grid grid-cols-3 gap-[4px]">
            {VIEWS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => add(id)}
                className="flex flex-col items-center gap-[6px] rounded-lg px-[6px] py-[10px] text-[12.5px] text-slate-700 hover:bg-slate-100"
              >
                <SIcon name={TAB_ICON[id]} size={18} />
                {TAB_TITLE[id]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Tools({ tab }: { tab: V10Tab }) {
  const { filters, set } = useCurrentView(tab)
  const [searching, setSearching] = useState(false)
  const filtering = filters.tags.length > 0 || filters.status !== 'any'
  return (
    <div className="flex flex-none items-center gap-[2px]">
      <ToolMenu icon="list-filter" label="Filter" on={filtering}>
        <MenuHeading>Tags</MenuHeading>
        {TAGS.map((tag) => (
          <Option
            key={tag.id}
            label={tag.label}
            on={filters.tags.includes(tag.id)}
            onClick={() => set({ tags: filters.tags.includes(tag.id) ? filters.tags.filter((item) => item !== tag.id) : [...filters.tags, tag.id] })}
          />
        ))}
        <MenuHeading>Status</MenuHeading>
        {STATUSES.map((status) => (
          <Option key={status.id} label={status.label} on={filters.status === status.id} onClick={() => set({ status: status.id })} />
        ))}
      </ToolMenu>
      <ToolMenu icon="arrow-up-down" label="Sort" on={filters.sort !== 'recent'}>
        <MenuHeading>Sort by</MenuHeading>
        {SORTS.map((sort) => (
          <Option key={sort.id} label={sort.label} on={filters.sort === sort.id} onClick={() => set({ sort: sort.id })} />
        ))}
      </ToolMenu>
      <ToolMenu icon="rows-3" label="Group" on={filters.group !== 'none'}>
        <MenuHeading>Group by</MenuHeading>
        {GROUPS.map((group) => (
          <Option key={group.id} label={group.label} on={filters.group === group.id} onClick={() => set({ group: group.id })} />
        ))}
      </ToolMenu>
      {searching || filters.query ? (
        <input
          autoFocus
          value={filters.query}
          onChange={(event) => set({ query: event.target.value })}
          onBlur={() => setSearching(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              set({ query: '' })
              setSearching(false)
            }
          }}
          placeholder={`Search ${TAB_TITLE[tab].toLowerCase()}`}
          aria-label={`Search ${TAB_TITLE[tab].toLowerCase()}`}
          className="h-[28px] w-[180px] rounded-md border border-slate-200 px-[8px] text-[13px] outline-none focus:border-slate-400"
        />
      ) : (
        <ToolButton icon="search" label="Search" onClick={() => setSearching(true)} />
      )}
      <div className="ml-[8px]">
        <DropdownButton label="New" items={NEW_ITEMS[tab]} width={220} />
      </div>
    </div>
  )
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
    ...(filters.status !== 'any' ? [{ id: 'status', label: `Status: ${filters.status === 'live' ? 'Live' : 'Draft'}`, clear: () => set({ status: 'any' }) }] : []),
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
            <button type="button" onClick={() => set({ tags: [], status: 'any' })} className="h-[26px] px-[6px] text-[12px] text-slate-500 hover:text-slate-800">
              Clear
            </button>
          </div>
        )}
        <div className="pt-[12px]">
          <V10Table tab={tab} shown={shown} groups={groups} grouped={filters.group !== 'none'} />
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
    if (filters.tags.length > 0 && !row.tags.some((tag) => filters.tags.includes(tag))) return false
    if (filters.status !== 'any' && row.status !== filters.status) return false
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
