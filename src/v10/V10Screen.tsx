import { useState, type ReactNode } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { ExperiencePage } from '../concierge/objective/ExperiencePage'
import { PlayPage } from '../concierge/objective/PlayPage'
import { ThreadView } from '../layout/StudioWorkspace'
import { RuleBuilder } from '../orchestration/NodeSetup'
import { Chip } from '../plays/ui'
import { PlayWorkspace } from '../plays/PlayWorkspace'
import type { NavLeafId } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { rowsFor, useV10Rows, type V10Row } from './rows'
import { updateAudience, useAudiences } from './useAudiences'
import { openRef, useV10, type Filters, type Tag, type V10Ref, type V10Tab } from './useV10'

const TAB_TITLE: Record<V10Tab, string> = { plays: 'Plays', experiences: 'Experiences', audiences: 'Audiences' }
const TAGS: { id: Tag; label: string }[] = [
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'expansion', label: 'Expansion' },
  { id: 'retention', label: 'Retention' },
]
const KIND: Record<V10Tab, V10Row['kind']> = { plays: 'play', experiences: 'experience', audiences: 'audience' }
const VIEW_ROUTE: Record<V10Tab, NavLeafId> = { plays: 'work.plays', experiences: 'work.experiences', audiences: 'work.audiences' }
const VIEWS: V10Tab[] = ['plays', 'experiences', 'audiences']

function showView(tab: V10Tab) {
  useV10.getState().close()
  useGrowthShell.getState().go(VIEW_ROUTE[tab])
}

function ago(at: number) {
  const days = Math.max(0, Math.round((Date.now() - at) / 86_400_000))
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function tagLabel(tag: Tag) {
  return TAGS.find((item) => item.id === tag)?.label ?? tag
}

/** One place. Plays, Experiences and Audiences are the three views. */
export function V10Screen({ tab }: { tab: V10Tab }) {
  const open = useV10((state) => state.open)
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-white">
      {open && open.kind === KIND[tab] ? (
        <>
          <ViewSwitch tab={tab} bar />
          <Detail row={open} />
        </>
      ) : (
        <List tab={tab} />
      )}
    </div>
  )
}

function ViewSwitch({ tab, bar }: { tab: V10Tab; bar?: boolean }) {
  return (
    <div className={bar ? 'flex h-[52px] flex-none items-center gap-[4px] border-b border-slate-200 px-[28px]' : 'flex items-center gap-[4px]'} role="tablist" aria-label="Views">
      {VIEWS.map((id) => {
        const on = id === tab
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => showView(id)}
            className={`h-8 rounded-md px-[12px] text-[13px] font-medium ${on ? 'bg-[#1a1c2e] text-white' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            {TAB_TITLE[id]}
          </button>
        )
      })}
    </div>
  )
}

function List({ tab }: { tab: V10Tab }) {
  const rows = rowsFor(useV10Rows(), KIND[tab])
  const filters = useV10((state) => state.filters[tab])
  const setFilters = useV10((state) => state.setFilters)
  const savedViews = useV10((state) => state.saved)
  const saved = savedViews.filter((view) => view.tab === tab)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const shown = applyFilters(rows, filters)
  const groups = groupRows(shown, filters.group)
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-[960px] px-[28px] py-[24px]">
        <div className="flex items-center gap-[12px]">
          <ViewSwitch tab={tab} />
          <input
            value={filters.query}
            onChange={(event) => setFilters(tab, { query: event.target.value })}
            placeholder={`Search ${TAB_TITLE[tab].toLowerCase()}`}
            aria-label={`Search ${TAB_TITLE[tab].toLowerCase()}`}
            className="ml-auto h-[32px] w-[220px] rounded-lg border border-slate-200 px-[10px] text-[13px] outline-none focus:border-slate-400"
          />
        </div>
        <div className="mt-[14px] flex flex-wrap items-center gap-[6px]">
          {TAGS.map((tag) => (
            <FilterChip
              key={tag.id}
              label={tag.label}
              on={filters.tags.includes(tag.id)}
              onClick={() => setFilters(tab, { tags: filters.tags.includes(tag.id) ? filters.tags.filter((item) => item !== tag.id) : [...filters.tags, tag.id] })}
            />
          ))}
          <FilterChip label="Live" on={filters.status === 'live'} onClick={() => setFilters(tab, { status: filters.status === 'live' ? 'any' : 'live' })} />
          <FilterChip label="Draft" on={filters.status === 'draft'} onClick={() => setFilters(tab, { status: filters.status === 'draft' ? 'any' : 'draft' })} />
          <label className="ml-[8px] flex items-center gap-[6px] text-[12px] text-slate-500">
            Group
            <select value={filters.group} onChange={(event) => setFilters(tab, { group: event.target.value as Filters['group'] })} className="h-[28px] rounded-md border border-slate-200 bg-white px-[6px] text-[12px] text-slate-800">
              <option value="none">None</option>
              <option value="tag">Tag</option>
              <option value="status">Status</option>
              <option value="type">Type</option>
            </select>
          </label>
          <label className="flex items-center gap-[6px] text-[12px] text-slate-500">
            Sort
            <select value={filters.sort} onChange={(event) => setFilters(tab, { sort: event.target.value as Filters['sort'] })} className="h-[28px] rounded-md border border-slate-200 bg-white px-[6px] text-[12px] text-slate-800">
              <option value="recent">Recent</option>
              <option value="name">Name</option>
            </select>
          </label>
          {naming ? (
            <form
              className="flex items-center gap-[4px]"
              onSubmit={(event) => {
                event.preventDefault()
                useV10.getState().saveView(tab, name)
                setName('')
                setNaming(false)
              }}
            >
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="View name" aria-label="View name" className="h-[28px] w-[140px] rounded-md border border-slate-200 px-[8px] text-[12px] outline-none focus:border-slate-400" />
              <button type="submit" className="h-[28px] rounded-md bg-slate-900 px-[8px] text-[12px] font-medium text-white">Save</button>
            </form>
          ) : (
            <button type="button" onClick={() => setNaming(true)} className="h-[28px] rounded-md px-[8px] text-[12px] font-medium text-slate-600 hover:bg-slate-100">
              Save view
            </button>
          )}
        </div>
        {saved.length > 0 && (
          <div className="mt-[8px] flex flex-wrap gap-[6px]">
            {saved.map((view) => (
              <span key={view.id} className="inline-flex items-center rounded-full border border-slate-200 text-[12px]">
                <button type="button" onClick={() => useV10.getState().applyView(view.id)} className="px-[10px] py-[3px] font-medium text-slate-700 hover:text-slate-900">
                  {view.name}
                </button>
                <button type="button" aria-label={`Remove ${view.name}`} onClick={() => useV10.getState().deleteView(view.id)} className="pr-[8px] text-slate-400 hover:text-slate-700">
                  <SIcon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-[18px]">
          {shown.length === 0 && <p className="py-[24px] text-[13px] text-slate-400">Nothing matches these filters.</p>}
          {groups.map((group) => (
            <section key={group.label} className="mb-[18px]">
              {filters.group !== 'none' && <h2 className="mb-[6px] text-[12px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</h2>}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_90px_110px_28px] gap-[12px] border-b border-slate-200 px-[14px] py-[8px] text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>Name</span>
                  <span>Tags</span>
                  <span>Status</span>
                  <span>Updated</span>
                  <span />
                </div>
                {group.rows.map((row) => (
                  <div key={`${row.kind}:${row.id}:${group.label}`} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_90px_110px_28px] items-center gap-[12px] border-b border-slate-100 px-[14px] py-[10px] last:border-b-0 hover:bg-slate-50">
                    <button type="button" onClick={() => openRef(row)} className="min-w-0 truncate text-left text-[13px] font-medium text-slate-900 hover:underline">
                      {row.title}
                    </button>
                    <span className="truncate text-[12px] text-slate-500">{row.tags.map(tagLabel).join(', ')}</span>
                    <Chip tone={row.status === 'live' ? 'emerald' : 'amber'}>{row.status === 'live' ? 'Live' : 'Draft'}</Chip>
                    <span className="text-[12px] text-slate-500">{ago(row.updatedAt)}</span>
                    <button
                      type="button"
                      aria-label={`Pin ${row.title}`}
                      title="Pin"
                      onClick={() => useV10.getState().togglePin(row)}
                      className="flex h-6 w-6 items-center justify-center text-slate-400 hover:text-slate-800"
                    >
                      <SIcon name="pin" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
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
  if (row.kind === 'experience' && row.source === 'retention') {
    return (
      <Frame label="Experiences">
        <ThreadView />
      </Frame>
    )
  }
  if (row.kind === 'audience') return <AudienceDetail id={row.id} />
  return null
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
