import { useMemo, useState, type ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import type { JourneyFile } from '../journey/types'
import { offerVariantLabel } from '../lib/offerVariants'
import { useCancelLibrary, type LibCard, type LibOffer, type LibReason, type ReasonKind } from '../library/useCancelLibrary'
import { openLibrary } from '../plays/navigate'
import { DropdownButton } from '../plays/ui'
import { usePlays } from '../plays/usePlays'
import { BackButton, backToHome } from '../shell/BackButton'
import { audienceLabel, useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { byPriority, useCancelSettings } from '../workspace/useCancelSettings'
import { orderedThreads, switchThread, threadIsLive, useWorkspace, type ExperienceThread } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { createMenuItems } from './createMenu'
import { StatusChip } from './StatusChip'
import { ago } from './ThreadSidebar'

type Sort = 'recent' | 'priority'
type View = 'list' | 'grid'
type Kind = 'offers' | 'cards' | 'reasons'
type Filter = 'all' | Kind

const VIEW_KEY = 'cancel-experience:components-view:v8'
const LIST_CAP = 5
const GRID_CAP = 4

const REASON_KIND: Record<ReasonKind, string> = {
  standard: 'Reason',
  competitor: 'Competitor pulse',
  return: 'Return likelihood',
}

const KINDS: Record<Kind, { label: string; one: string; icon: SIconName; tint: string }> = {
  offers: { label: 'Offers', one: 'offer', icon: 'gift', tint: 'bg-amber-50 text-amber-600' },
  cards: { label: 'Loss aversion cards', one: 'card', icon: 'shield', tint: 'bg-rose-50 text-rose-600' },
  reasons: { label: 'Survey reasons', one: 'reason', icon: 'message-square', tint: 'bg-sky-50 text-sky-600' },
}

interface Item {
  id: string
  title: string
  line: string
  detail: string
  preview: ReactNode
}

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

function summary(t: ExperienceThread, file: JourneyFile | undefined): string {
  if (!file) return t.seed ? 'All subscribers' : 'Not started'
  const n = file.steps.length
  if (n === 0) return 'Not started'
  return `${audienceLabel(file.audience)} · ${n} step${n === 1 ? '' : 's'}`
}

/** v8: cancel experiences first, then the parts they are built from. */
export function ExperiencesHome() {
  const setPage = useWorkspaceUi((s) => s.setPage)
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)
  const activeLive = useOrchestration((s) => s.play.publishState === 'live')
  const activeFile = useJourney((s) => s.file)
  const plays = usePlays((s) => s.plays)
  const priority = useCancelSettings((s) => s.priority)
  const setPriority = useCancelSettings((s) => s.setPriority)
  const lib = useCancelLibrary()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [view, setViewState] = useState<View>(readView)
  const [filter, setFilter] = useState<Filter>('all')

  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* private mode */
    }
  }

  const q = query.trim().toLowerCase()
  const matches = (...s: string[]) => !q || s.some((x) => x.toLowerCase().includes(q))

  const cancelThreads = threads.filter((t) => t.title !== 'New experience' || t.snapshot?.chat.lines.length)
  const ranked = byPriority(cancelThreads, priority)
  const experiences = (sort === 'priority' ? ranked : orderedThreads(cancelThreads)).filter((t) => matches(t.title))

  const playLine = useMemo(() => {
    const names = new Map<string, string[]>()
    for (const p of plays) for (const v of p.variants) names.set(v.experienceId, [...(names.get(v.experienceId) ?? []), p.name])
    return (id: string) => {
      const n = [...new Set(names.get(id) ?? [])]
      if (n.length === 0) return 'Not in a play'
      return n.length === 1 ? n[0] : `${n[0]} and ${n.length - 1} more`
    }
  }, [plays])

  const open = (id: string) => {
    setPage('thread')
    switchThread(id)
  }

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = ranked.map((t) => t.id).filter((id) => id !== dragId)
    ids.splice(ids.indexOf(targetId), 0, dragId)
    setPriority(ids)
    setDragId(null)
    setOverId(null)
  }

  const all: Record<Kind, Item[]> = {
    offers: lib.offers.map((o) => ({ id: o.id, title: o.name, line: o.title, detail: offerVariantLabel(o.type), preview: <OfferPreview o={o} /> })),
    cards: lib.cards.map((c) => ({
      id: c.id,
      title: c.name,
      line: c.title,
      detail: `${c.keep.filter(Boolean).length} kept, ${c.lose.filter(Boolean).length} lost`,
      preview: <CardPreview c={c} />,
    })),
    reasons: lib.reasons.map((r) => ({
      id: r.id,
      title: r.label,
      line: r.kind === 'competitor' ? r.options.filter(Boolean).join(', ') : r.kind === 'return' ? 'Scale from not likely to very likely' : r.followUp || 'No follow-up question',
      detail: REASON_KIND[r.kind],
      preview: <ReasonPreview r={r} />,
    })),
  }
  const found: Record<Kind, Item[]> = {
    offers: all.offers.filter((i) => matches(i.title, i.line)),
    cards: all.cards.filter((i) => matches(i.title, i.line)),
    reasons: all.reasons.filter((i) => matches(i.title, i.line)),
  }
  const order: Kind[] = ['offers', 'cards', 'reasons']
  const shown = order.filter((k) => (filter === 'all' || filter === k) && (!q || found[k].length > 0))
  const cap = filter === 'all' && !q ? (view === 'grid' ? GRID_CAP : LIST_CAP) : Infinity
  const total = order.reduce((n, k) => n + found[k].length, 0)

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[960px] px-[32px] pb-[48px] pt-[24px]">
        <div className="flex items-center justify-between gap-[16px]">
          <div className="flex min-w-0 items-center gap-[6px]">
            <BackButton fallback={backToHome} className="-ml-[8px]" />
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Experiences</h1>
          </div>
          <DropdownButton label="New" items={createMenuItems()} />
        </div>

        <div className="mt-[16px] flex h-[36px] items-center gap-[8px] rounded-lg border border-slate-200 bg-white px-[10px] transition-colors focus-within:border-slate-400">
          <SIcon name="search" size={15} className="flex-none text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search experiences and components"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="flex-none rounded p-[2px] text-slate-400 hover:text-slate-700">
              <SIcon name="x" size={14} />
            </button>
          )}
        </div>

        <section className="mt-[28px]">
          <SectionHead
            title="Cancel experiences"
            count={experiences.length}
            action={
              <label className="flex items-center gap-[6px] text-[12.5px] text-slate-500">
                Sort by
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="h-[28px] rounded-md border border-slate-200 bg-white px-[6px] text-[12.5px] font-medium text-slate-800 outline-none hover:border-slate-300"
                >
                  <option value="recent">Recent activity</option>
                  <option value="priority">Priority</option>
                </select>
              </label>
            }
          />
          {sort === 'priority' && (
            <p className="mb-[12px] text-[12.5px] text-slate-500">When two cancel experiences match the same subscriber, the higher one wins. Drag to reorder.</p>
          )}
          {experiences.length > 0 ? (
            <div className="grid grid-cols-2 gap-[12px]">
              {experiences.map((t) => (
                <ExperienceCard
                  key={t.id}
                  title={t.title}
                  subtitle={summary(t, t.id === activeId ? activeFile : t.snapshot?.journey)}
                  play={playLine(t.id)}
                  live={threadIsLive(t, activeId, activeLive)}
                  edited={`Edited ${ago(t.updatedAt).toLowerCase()}`}
                  rank={sort === 'priority' ? ranked.indexOf(t) + 1 : undefined}
                  onClick={() => open(t.id)}
                  drag={
                    sort === 'priority'
                      ? {
                          onDragStart: () => setDragId(t.id),
                          onDragOver: (e) => {
                            e.preventDefault()
                            if (overId !== t.id) setOverId(t.id)
                          },
                          onDrop: () => drop(t.id),
                          over: overId === t.id && dragId !== t.id,
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <Empty>{q ? 'No cancel experiences match your search.' : 'No cancel experiences yet. Use New to make one.'}</Empty>
          )}
        </section>

        <section className="mt-[36px]">
          <SectionHead
            title="Components"
            count={total}
            hint="Offers, cards and reasons you can reuse across cancel experiences."
            action={<ViewToggle view={view} onChange={setView} />}
          />

          <div role="tablist" aria-label="Component type" className="mb-[14px] flex flex-wrap items-center gap-[6px]">
            {(['all', ...order] as Filter[]).map((f) => {
              const on = filter === f
              const n = f === 'all' ? total : found[f].length
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setFilter(f)}
                  className={`flex h-[28px] items-center gap-[6px] rounded-full border px-[11px] text-[12.5px] font-medium transition-colors ${
                    on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {f === 'all' ? 'All' : KINDS[f].label}
                  <span className={`tabular-nums ${on ? 'text-white/60' : 'text-slate-400'}`}>{n}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-[20px]">
            {shown.map((k) => {
              const items = found[k]
              const visible = items.slice(0, cap)
              const hidden = items.length - visible.length
              const more = hidden > 0 ? () => setFilter(k) : undefined
              return view === 'list' ? (
                <ListGroup key={k} kind={k} count={items.length} hidden={hidden} onMore={more}>
                  {visible.map((i) => (
                    <ListRow key={i.id} kind={k} item={i} onClick={() => openLibrary(k, false, i.id)} />
                  ))}
                  {items.length === 0 && <AddRow kind={k} />}
                </ListGroup>
              ) : (
                <GridGroup key={k} kind={k} count={items.length} onMore={more}>
                  {visible.map((i) => (
                    <GridCard key={i.id} kind={k} item={i} onClick={() => openLibrary(k, false, i.id)} />
                  ))}
                  {items.length === 0 && <AddTile kind={k} />}
                </GridGroup>
              )
            })}
            {shown.length === 0 && <Empty>No components match your search.</Empty>}
          </div>
        </section>
      </div>
    </div>
  )
}

function SectionHead({ title, count, hint, action }: { title: string; count: number; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-[12px] flex items-end justify-between gap-[12px]">
      <div className="min-w-0">
        <h2 className="flex items-baseline gap-[8px] text-[15px] font-semibold text-slate-900">
          {title}
          <span className="text-[13px] font-normal tabular-nums text-slate-400">{count}</span>
        </h2>
        {hint && <p className="mt-[2px] text-[12.5px] text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-[16px] py-[20px] text-center text-[13px] text-slate-500">{children}</p>
}

function ExperienceCard({
  title,
  subtitle,
  play,
  live,
  edited,
  rank,
  onClick,
  drag,
}: {
  title: string
  subtitle: string
  play: string
  live: boolean
  edited: string
  rank?: number
  onClick: () => void
  drag?: { onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void; over: boolean }
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      draggable={Boolean(drag)}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
      className={`group flex flex-col rounded-xl border bg-white px-[16px] pb-[12px] pt-[14px] text-left transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)] ${
        drag?.over ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
      } ${drag ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex w-full items-center gap-[10px]">
        {rank !== undefined && (
          <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-slate-100 text-[11.5px] font-semibold tabular-nums text-slate-600">
            {rank}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-900">{title}</span>
        <StatusChip live={live} />
        {drag && <SIcon name="grip-vertical" size={15} className="flex-none text-slate-300" />}
      </div>
      <p className="mt-[4px] truncate text-[12.5px] text-slate-500">{subtitle}</p>
      <div className="mt-[14px] flex w-full items-center gap-[6px] border-t border-slate-100 pt-[10px] text-[12px] text-slate-400">
        <SIcon name="layers" size={13} className="flex-none" />
        <span className="min-w-0 truncate">{play}</span>
        <span className="ml-auto flex-none">{edited}</span>
      </div>
    </button>
  )
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: { id: View; label: string; icon: SIconName }[] = [
    { id: 'list', label: 'List view', icon: 'list' },
    { id: 'grid', label: 'Grid view', icon: 'layout-grid' },
  ]
  return (
    <div className="flex flex-none items-center rounded-lg border border-slate-200 bg-white p-[2px]">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-label={o.label}
          aria-pressed={view === o.id}
          title={o.label}
          onClick={() => onChange(o.id)}
          className={`flex h-[26px] w-[30px] items-center justify-center rounded-md transition-colors ${
            view === o.id ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <SIcon name={o.icon} size={15} />
        </button>
      ))}
    </div>
  )
}

function KindIcon({ kind, size = 30 }: { kind: Kind; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className={`flex flex-none items-center justify-center rounded-lg ${KINDS[kind].tint}`}>
      <SIcon name={KINDS[kind].icon} size={Math.round(size / 2)} />
    </span>
  )
}

function GroupHead({ kind, count, onMore, className }: { kind: Kind; count: number; onMore?: () => void; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-[12px] ${className ?? ''}`}>
      <div className="flex items-center gap-[8px] text-[13px] font-semibold text-slate-800">
        {KINDS[kind].label}
        <span className="font-normal tabular-nums text-slate-400">{count}</span>
      </div>
      <div className="flex items-center gap-[12px] text-[12.5px] font-medium">
        {onMore && (
          <button type="button" onClick={onMore} className="text-slate-500 hover:text-slate-900">
            Show all
          </button>
        )}
        <button type="button" onClick={() => openLibrary(kind, true)} className="flex items-center gap-[4px] text-slate-500 hover:text-slate-900">
          <SIcon name="plus" size={13} />
          New {KINDS[kind].one}
        </button>
      </div>
    </div>
  )
}

function ListGroup({ kind, count, hidden, onMore, children }: { kind: Kind; count: number; hidden: number; onMore?: () => void; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <GroupHead kind={kind} count={count} className="border-b border-slate-200 bg-slate-50/70 px-[14px] py-[8px]" />
      <ul>{children}</ul>
      {hidden > 0 && onMore && (
        <button type="button" onClick={onMore} className="w-full border-t border-slate-100 px-[14px] py-[8px] text-left text-[12.5px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900">
          {hidden} more {hidden === 1 ? KINDS[kind].one : `${KINDS[kind].one}s`}
        </button>
      )}
    </div>
  )
}

function ListRow({ kind, item, onClick }: { kind: Kind; item: Item; onClick: () => void }) {
  return (
    <li className="border-t border-slate-100 first:border-t-0">
      <button type="button" onClick={onClick} className="group flex w-full items-center gap-[12px] px-[14px] py-[9px] text-left transition-colors hover:bg-slate-50">
        <KindIcon kind={kind} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-slate-900">{item.title}</span>
          {item.line && <span className="block truncate text-[12px] text-slate-500">{item.line}</span>}
        </span>
        <span className="flex-none rounded-full bg-slate-100 px-[8px] py-[2px] text-[11.5px] font-medium text-slate-600">{item.detail}</span>
        <SIcon name="chevron-right" size={14} className="flex-none text-slate-300 group-hover:text-slate-500" />
      </button>
    </li>
  )
}

function AddRow({ kind }: { kind: Kind }) {
  return (
    <li className="border-t border-slate-100 first:border-t-0">
      <button type="button" onClick={() => openLibrary(kind, true)} className="flex w-full items-center gap-[12px] px-[14px] py-[12px] text-left text-[13px] text-slate-500 hover:bg-slate-50 hover:text-slate-900">
        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-dashed border-slate-300">
          <SIcon name="plus" size={14} />
        </span>
        No {KINDS[kind].label.toLowerCase()} yet. Add the first one.
      </button>
    </li>
  )
}

function GridGroup({ kind, count, onMore, children }: { kind: Kind; count: number; onMore?: () => void; children: ReactNode }) {
  return (
    <div>
      <GroupHead kind={kind} count={count} onMore={onMore} className="mb-[10px]" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-[12px]">{children}</div>
    </div>
  )
}

function GridCard({ kind, item, onClick }: { kind: Kind; item: Item; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex aspect-[3/4] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden border-b border-slate-100 bg-slate-50 p-[14px]">{item.preview}</div>
      <div className="flex items-center gap-[10px] px-[12px] py-[10px]">
        <KindIcon kind={kind} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-slate-900">{item.title}</span>
          <span className="block truncate text-[11.5px] text-slate-500">{item.detail}</span>
        </span>
      </div>
    </button>
  )
}

function AddTile({ kind }: { kind: Kind }) {
  return (
    <button
      type="button"
      onClick={() => openLibrary(kind, true)}
      className="flex aspect-[3/4] flex-col items-center justify-center gap-[8px] rounded-xl border border-dashed border-slate-300 text-[13px] font-medium text-slate-500 hover:border-slate-400 hover:text-slate-900"
    >
      <SIcon name="plus" size={18} />
      New {KINDS[kind].one}
    </button>
  )
}

function Mini({ children }: { children: ReactNode }) {
  return <div className="w-full rounded-lg bg-white p-[10px] shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70">{children}</div>
}

function OfferPreview({ o }: { o: LibOffer }) {
  return (
    <Mini>
      <div className="text-[9.5px] font-semibold uppercase tracking-wide text-amber-600">{offerVariantLabel(o.type)}</div>
      <div className="mt-[4px] line-clamp-2 text-[11.5px] font-semibold leading-snug text-slate-900">{o.title || o.name}</div>
      {o.description && <div className="mt-[3px] line-clamp-3 text-[10px] leading-snug text-slate-500">{o.description}</div>}
      <div className="mt-[8px] truncate rounded-md bg-slate-900 px-[6px] py-[4px] text-center text-[10px] font-semibold text-white">{o.cta || 'Accept offer'}</div>
    </Mini>
  )
}

function CardPreview({ c }: { c: LibCard }) {
  const keep = c.keep.filter(Boolean).slice(0, 2)
  const lose = c.lose.filter(Boolean).slice(0, 3)
  return (
    <Mini>
      <div className="line-clamp-2 text-[11.5px] font-semibold leading-snug text-slate-900">{c.title || c.name}</div>
      <ul className="mt-[6px] flex flex-col gap-[3px] text-[10px] leading-snug text-slate-600">
        {keep.map((k, i) => (
          <li key={`k${i}`} className="flex items-start gap-[4px]">
            <SIcon name="check" size={10} className="mt-[2px] flex-none text-emerald-600" />
            <span className="line-clamp-1">{k}</span>
          </li>
        ))}
        {lose.map((l, i) => (
          <li key={`l${i}`} className="flex items-start gap-[4px]">
            <SIcon name="x" size={10} className="mt-[2px] flex-none text-rose-500" />
            <span className="line-clamp-1">{l}</span>
          </li>
        ))}
      </ul>
    </Mini>
  )
}

function ReasonPreview({ r }: { r: LibReason }) {
  if (r.kind === 'return') {
    return (
      <Mini>
        <div className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-900">{r.label}</div>
        <div className="mt-[8px] flex justify-between gap-[3px]">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`flex h-[18px] flex-1 items-center justify-center rounded text-[9px] font-semibold ${n === 4 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {n}
            </span>
          ))}
        </div>
      </Mini>
    )
  }
  if (r.kind === 'competitor') {
    return (
      <Mini>
        <div className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-900">{r.label}</div>
        <div className="mt-[6px] flex flex-wrap gap-[3px]">
          {r.options.filter(Boolean).slice(0, 4).map((o) => (
            <span key={o} className="rounded-full bg-slate-100 px-[6px] py-[1px] text-[9.5px] text-slate-600">
              {o}
            </span>
          ))}
        </div>
      </Mini>
    )
  }
  return (
    <Mini>
      <div className="flex items-center gap-[6px] rounded-md border border-slate-900 px-[7px] py-[5px]">
        <span className="flex h-[10px] w-[10px] flex-none items-center justify-center rounded-full border border-slate-900">
          <span className="h-[5px] w-[5px] rounded-full bg-slate-900" />
        </span>
        <span className="line-clamp-2 text-[10.5px] font-medium leading-snug text-slate-900">{r.label}</span>
      </div>
      {r.followUp && <div className="mt-[6px] line-clamp-2 text-[10px] leading-snug text-slate-500">{r.followUp}</div>}
      <div className="mt-[6px] h-[18px] rounded-md border border-slate-200" />
    </Mini>
  )
}
