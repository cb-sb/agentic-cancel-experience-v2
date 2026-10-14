import { useMemo, useState, type ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { offerVariantLabel } from '../lib/offerVariants'
import { useCancelLibrary, type LibCard, type LibOffer, type LibReason, type ReasonKind } from '../library/useCancelLibrary'
import { archiveExperienceItem, archiveExperiencesNow } from '../plays/archive'
import { openArchive, openLibrary, openPlay } from '../plays/navigate'
import { variantLetter, type CancelPlay, type PlayVariant } from '../plays/types'
import { DropdownButton, type MenuItem } from '../plays/ui'
import { usePlays } from '../plays/usePlays'
import { BackButton, backToHome } from '../shell/BackButton'
import { useOrchestration } from '../store/useOrchestration'
import { orderedThreads, switchThread, threadIsLive, useWorkspace, type ExperienceThread } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { createMenuItems } from './createMenu'
import { SHELL_KIND, shellOf, stepCount } from './experienceKind'
import { V9 } from './layoutMode'
import { AngledTabs, PageHeader, ToolButton, ToolDivider, ToolSearch } from './SlgChrome'
import { Ago, BulkAction, Check, initials, RowActions, RowMark, SelectHead, TableRow, useSelection } from './SlgTable'
import { StatusChip } from './StatusChip'
import { ago } from './ThreadSidebar'
import { FRAME_WIDE } from './frames'

type View = 'list' | 'grid'
type Kind = 'offers' | 'cards' | 'reasons'
type Filter = 'all' | Kind
type PlayFilter = 'all' | 'in' | 'out'

const PLAY_FILTERS: { id: PlayFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'In a play' },
  { id: 'out', label: 'Not in a play' },
]

const FILTER_LINE: Record<PlayFilter, string> = {
  all: 'The pages a subscriber sees after clicking Cancel. Put one in a play to choose who sees it.',
  in: 'Experiences at least one play shows to its audience.',
  out: 'Experiences no play uses yet. Nobody sees these until you add them to a play.',
}

const VIEW_KEY = 'cancel-experience:components-view:v8'
const EXP_VIEW_KEY = 'cancel-experience:experiences-view:v9'
const LIST_CAP = 5
const GRID_CAP = 4

const REASON_KIND: Record<ReasonKind, string> = {
  standard: 'Reason',
  competitor: 'Competitor pulse',
  return: 'Return likelihood',
}

const KINDS: Record<Kind, { label: string; one: string }> = {
  offers: { label: 'Offers', one: 'offer' },
  cards: { label: 'Loss aversion cards', one: 'card' },
  reasons: { label: 'Survey reasons', one: 'reason' },
}

interface Item {
  id: string
  title: string
  line: string
  detail: string
  preview: ReactNode
}

function readExpView(): View {
  try {
    return localStorage.getItem(EXP_VIEW_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

/** v8: cancel experiences first, then the parts they are built from. */
export function ExperiencesHome() {
  const setPage = useWorkspaceUi((s) => s.setPage)
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)
  const activeLive = useOrchestration((s) => s.play.publishState === 'live')
  const plays = usePlays((s) => s.plays)
  const lib = useCancelLibrary()
  const [query, setQuery] = useState('')
  const [view, setViewState] = useState<View>(readView)
  const [filter, setFilter] = useState<Filter>('all')
  const [playFilter, setPlayFilter] = useState<PlayFilter>('all')
  const [expView, setExpViewState] = useState<View>(readExpView)
  const archivedCount = useWorkspace((s) => s.archived.length)
  const setExpView = (v: View) => {
    setExpViewState(v)
    try {
      localStorage.setItem(EXP_VIEW_KEY, v)
    } catch {
      /* private mode */
    }
  }

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
  const inAPlay = new Set(plays.flatMap((p) => p.variants.map((v) => v.experienceId)))
  const liveCount = cancelThreads.filter((t) => threadIsLive(t, activeId, activeLive)).length
  const experiences = orderedThreads(cancelThreads).filter(
    (t) => matches(t.title) && (playFilter === 'all' || (playFilter === 'in') === inAPlay.has(t.id)),
  )

  const playLine = useMemo(() => {
    const names = new Map<string, string[]>()
    for (const p of plays) for (const v of p.variants) names.set(v.experienceId, [...(names.get(v.experienceId) ?? []), p.name])
    return (id: string) => {
      const n = [...new Set(names.get(id) ?? [])]
      if (n.length === 0) return 'Not in a play'
      return n.length === 1 ? n[0] : `${n[0]} and ${n.length - 1} more`
    }
  }, [plays])
  const uses = useMemo(() => usesByExperience(plays), [plays])

  const open = (id: string) => {
    setPage('thread')
    switchThread(id)
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
      detail: r.kind === 'standard' ? '' : REASON_KIND[r.kind],
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

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className={`mx-auto px-[32px] pb-[48px] ${V9 ? `${FRAME_WIDE} pt-[20px]` : 'max-w-[960px] pt-[24px]'}`}>
        {V9 ? (
          <PageHeader
            title={
              <div className="flex min-w-0 items-center gap-[6px]">
                <BackButton fallback={backToHome} className="-ml-[8px]" />
                <h1 className="truncate">Experiences</h1>
              </div>
            }
            meta={[
              `${cancelThreads.length} experience${cancelThreads.length === 1 ? '' : 's'}`,
              <span className={liveCount > 0 ? 'text-[var(--slg-green-700)]' : ''}>{liveCount} live</span>,
            ]}
            tabs={<AngledTabs label="Play" items={PLAY_FILTERS} value={playFilter} onChange={setPlayFilter} />}
            actions={
              <>
                <ToolSearch value={query} onChange={setQuery} placeholder="Search experiences…" label="Search experiences" />
                <ToolButton icon="list" label="List view" pressed={expView === 'list'} onClick={() => setExpView('list')} />
                <ToolButton icon="layout-grid" label="Grid view" pressed={expView === 'grid'} onClick={() => setExpView('grid')} />
                <ToolDivider />
                <DropdownButton label="New" items={createMenuItems()} />
              </>
            }
          />
        ) : (
        <div className="flex items-center gap-[12px]">
          <div className="flex min-w-0 flex-1 items-center gap-[6px]">
            <BackButton fallback={backToHome} className="-ml-[8px]" />
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-slate-900">Experiences</h1>
          </div>
          <div className="flex h-[28px] w-[300px] min-w-[160px] shrink items-center gap-[8px] rounded-md border border-slate-200 bg-white px-[10px] transition-colors hover:border-slate-300 focus-within:border-slate-400">
            <SIcon name="search" size={14} className="flex-none text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={V9 ? 'Search experiences' : 'Search experiences and components'}
              aria-label={V9 ? 'Search experiences' : 'Search experiences and components'}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="flex-none rounded p-[2px] text-slate-400 hover:text-slate-700">
                <SIcon name="x" size={14} />
              </button>
            )}
          </div>
          <DropdownButton label="New" items={createMenuItems()} />
        </div>
        )}

        {V9 && <p className="mb-[12px] mt-[16px] text-[13px] text-slate-500">{FILTER_LINE[playFilter]}</p>}
        <section className={V9 ? '' : 'mt-[32px]'}>
          {!V9 && <SectionHead title="Cancel experiences" />}
          {experiences.length > 0 && V9 && expView === 'list' ? (
            <ExperienceList
              rows={experiences.map((t) => ({ thread: t, live: threadIsLive(t, activeId, activeLive), uses: uses.get(t.id) ?? [] }))}
              onOpen={open}
            />
          ) : experiences.length > 0 && V9 ? (
            <div className="grid grid-cols-3 gap-[16px]">
              {experiences.map((t) => (
                <ExperienceTile
                  key={t.id}
                  thread={t}
                  live={threadIsLive(t, activeId, activeLive)}
                  uses={uses.get(t.id) ?? []}
                  onClick={() => open(t.id)}
                />
              ))}
            </div>
          ) : experiences.length > 0 ? (
            <div className="grid grid-cols-2 gap-[12px]">
              {experiences.map((t) => (
                <ExperienceCard
                  key={t.id}
                  title={t.title}
                  play={playLine(t.id)}
                  live={threadIsLive(t, activeId, activeLive)}
                  edited={`Edited ${ago(t.updatedAt).toLowerCase()}`}
                  onClick={() => open(t.id)}
                />
              ))}
            </div>
          ) : (
            <Empty>
              {q || playFilter !== 'all' ? 'No cancel experiences match.' : 'No cancel experiences yet. Use New to make one.'}
            </Empty>
          )}
          {V9 && archivedCount > 0 && (
            <button type="button" onClick={openArchive} className="mt-[12px] flex items-center gap-[6px] text-[12.5px] font-medium text-slate-500 hover:text-slate-900">
              <SIcon name="archive" size={13} /> {archivedCount} archived experience{archivedCount === 1 ? '' : 's'}
            </button>
          )}
        </section>

        {!V9 && (
        <section className="mt-[40px]">
          <SectionHead title="Components" action={<ViewToggle view={view} onChange={setView} />} />

          <div role="tablist" aria-label="Component type" className="mb-[14px] flex flex-wrap items-center gap-[6px]">
            {(['all', ...order] as Filter[]).map((f) => {
              const on = filter === f
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setFilter(f)}
                  className={`flex h-[28px] items-center rounded-full border px-[12px] text-[12.5px] font-medium transition-colors ${
                    on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {f === 'all' ? 'All' : KINDS[f].label}
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
                    <ListRow key={i.id} item={i} onClick={() => openLibrary(k, false, i.id)} />
                  ))}
                  {items.length === 0 && <AddRow kind={k} />}
                </ListGroup>
              ) : (
                <GridGroup key={k} kind={k} count={items.length} onMore={more}>
                  {visible.map((i) => (
                    <GridCard key={i.id} item={i} onClick={() => openLibrary(k, false, i.id)} />
                  ))}
                  {items.length === 0 && <AddTile kind={k} />}
                </GridGroup>
              )
            })}
            {shown.length === 0 && <Empty>No components match your search.</Empty>}
          </div>
        </section>
        )}
      </div>
    </div>
  )
}

function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-[12px] flex min-h-[28px] items-center justify-between gap-[12px]">
      <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
      {action}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-[16px] py-[20px] text-center text-[13px] text-slate-500">{children}</p>
}

function ExperienceCard({ title, play, live, edited, onClick }: { title: string; play: string; live: boolean; edited: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col gap-[4px] rounded-xl border border-slate-200 bg-white px-[16px] py-[14px] text-left transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-sm"
    >
      <span className="flex w-full items-center gap-[8px]">
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-900">{title}</span>
        {live && <StatusChip live />}
      </span>
      <span className="truncate text-[12.5px] text-slate-500">
        {play} · {edited}
      </span>
    </button>
  )
}

interface PlayUse {
  play: CancelPlay
  /** Where this experience sits in the play: a variant and its share, or a sub-audience. */
  roles: string[]
}

function roleOf(p: CancelPlay, v: PlayVariant): string {
  if (p.splitBy === 'segments') {
    if (!v.subAudienceId) return 'Fallback'
    return p.subAudiences.find((s) => s.id === v.subAudienceId)?.audience.name ?? 'Sub-audience'
  }
  if (p.variants.length === 1) return 'Only page'
  return `Variant ${variantLetter(p.variants.indexOf(v))} · ${v.weight}%`
}

function usesByExperience(plays: CancelPlay[]): Map<string, PlayUse[]> {
  const out = new Map<string, PlayUse[]>()
  for (const p of plays) {
    for (const v of p.variants) {
      const list = out.get(v.experienceId) ?? []
      const hit = list.find((u) => u.play.id === p.id)
      if (hit) hit.roles.push(roleOf(p, v))
      else list.push({ play: p, roles: [roleOf(p, v)] })
      out.set(v.experienceId, list)
    }
  }
  return out
}

const USES_SHOWN = 3

/** v9: a vertical card that says which plays use the experience, how, and whether each is live. */
function ExperienceTile({ thread: t, live, uses, onClick }: { thread: ExperienceThread; live: boolean; uses: PlayUse[]; onClick: () => void }) {
  const kind = SHELL_KIND[shellOf(t)]
  const steps = stepCount(t)
  const liveCount = uses.filter((u) => u.play.status === 'live').length
  const hidden = uses.length - USES_SHOWN
  const items: MenuItem[] = [{ label: 'Open', icon: 'arrow-up-right', onClick }, archiveExperienceItem(t.id)]
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-[var(--slg-color-border-default)] bg-[var(--slg-color-bg-surface)] transition-[border-color,box-shadow] hover:border-[var(--slg-color-border-strong)] hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]">
      <div className="flex items-start gap-[8px] px-[16px] pb-[14px] pt-[16px]">
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-start gap-[12px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--slg-color-focus-ring)]"
        >
          <span className="slg-avatar flex h-[36px] w-[36px] flex-none items-center justify-center border border-[var(--slg-color-border-default)] bg-[var(--slg-neutral-50)] text-[var(--slg-neutral-700)]">
            <SIcon name={kind.icon} size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-[8px]">
              <span className="min-w-0 truncate font-[family-name:var(--slg-font-family-emphasis)] text-[15px] font-semibold leading-[22px] text-[var(--slg-neutral-900)]">{t.title}</span>
              {live && <StatusChip live />}
            </span>
            <span className="mt-[2px] block truncate text-[12px] leading-[16px] text-[var(--slg-color-text-secondary)]">
              {kind.label} · {steps} {steps === 1 ? 'step' : 'steps'} · Edited {ago(t.updatedAt).toLowerCase()}
            </span>
          </span>
        </button>
        <RowActions label={`Actions for ${t.title}`} items={items} />
      </div>
      <div className="mx-[16px] flex flex-1 flex-col border-t border-[var(--slg-color-border-default)] pb-[10px] pt-[12px]">
        {uses.length === 0 ? (
          <div className="flex flex-col gap-[2px] pb-[4px]">
            <span className="text-[13px] font-medium text-[var(--slg-color-text-primary)]">Not in a play yet</span>
            <span className="text-[12px] leading-[18px] text-[var(--slg-color-text-muted)]">No one sees this until a play uses it.</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-[8px] pb-[4px] text-[12px] leading-[16px]">
              <span className="font-medium text-[var(--slg-color-text-secondary)]">
                Used in {uses.length} {uses.length === 1 ? 'play' : 'plays'}
              </span>
              <span className={liveCount > 0 ? 'font-medium text-[var(--slg-green-700)]' : 'text-[var(--slg-color-text-muted)]'}>
                {liveCount > 0 ? `${liveCount} live` : 'None live'}
              </span>
            </div>
            <ul className="-mx-[8px] flex flex-col">
              {uses.slice(0, USES_SHOWN).map((u) => {
                const on = u.play.status === 'live'
                return (
                  <li key={u.play.id}>
                    <button
                      type="button"
                      onClick={() => openPlay(u.play.id)}
                      title={`Open ${u.play.name}`}
                      className="group/use flex w-full items-center gap-[10px] px-[8px] py-[7px] text-left transition-colors hover:bg-[var(--slg-neutral-50)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--slg-color-focus-ring)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium leading-[18px] text-[var(--slg-color-text-primary)]">{u.play.name}</span>
                        <span className="block truncate text-[12px] leading-[16px] text-[var(--slg-color-text-muted)]">{u.roles.join(', ')}</span>
                      </span>
                      <span className={`flex flex-none items-center gap-[5px] text-[12px] ${on ? 'font-medium text-[var(--slg-green-700)]' : 'text-[var(--slg-color-text-muted)]'}`}>
                        <span className={`h-[6px] w-[6px] rounded-full ${on ? 'bg-[var(--slg-green-500)]' : 'bg-[var(--slg-neutral-400)]'}`} />
                        {on ? 'Live' : 'Draft'}
                      </span>
                      <SIcon name="chevron-right" size={14} className="flex-none text-[var(--slg-color-text-muted)] opacity-0 transition-opacity group-hover/use:opacity-100" />
                    </button>
                  </li>
                )
              })}
            </ul>
            {hidden > 0 && (
              <button
                type="button"
                onClick={onClick}
                className="mt-[2px] self-start text-[12px] font-medium text-[var(--slg-color-text-secondary)] hover:text-[var(--slg-color-text-primary)]"
              >
                {hidden} more {hidden === 1 ? 'play' : 'plays'}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}

const EXP_COLS = 'grid grid-cols-[16px_minmax(0,1.6fr)_88px_52px_minmax(0,2.4fr)_60px_88px_28px] items-center gap-[16px]'

/** v9: the default Experiences view. One row each, with the plays it's in and whether each is live. */
function ExperienceList({ rows, onOpen }: { rows: { thread: ExperienceThread; live: boolean; uses: PlayUse[] }[]; onOpen: (id: string) => void }) {
  const sel = useSelection(rows.map((r) => r.thread.id))
  const inPlays = rows.filter((r) => sel.has(r.thread.id) && r.uses.length > 0).length
  return (
    <div>
      <SelectHead
        cols={EXP_COLS}
        total={rows.length}
        picked={sel.picked.length}
        onAll={sel.setAll}
        onClear={sel.clear}
        actions={
          <BulkAction
            icon="archive"
            label="Archive"
            confirm={inPlays > 0 ? `Takes ${inPlays === 1 ? 'one' : inPlays} out of plays. Archive?` : undefined}
            onClick={() => {
              archiveExperiencesNow(sel.picked)
              sel.clear()
            }}
          />
        }
      >
        <span>Experience</span>
        <span>Type</span>
        <span className="text-right">Steps</span>
        <span>Used in</span>
        <span>Status</span>
        <span>Edited</span>
        <span />
      </SelectHead>
      {rows.map(({ thread: t, live, uses }) => {
        const kind = SHELL_KIND[shellOf(t)]
        const steps = stepCount(t)
        const items: MenuItem[] = [
          { label: 'Open', icon: 'arrow-up-right', onClick: () => onOpen(t.id) },
          archiveExperienceItem(t.id),
        ]
        return (
          <TableRow key={t.id} cols={EXP_COLS} onOpen={() => onOpen(t.id)} className={sel.has(t.id) ? 'is-picked' : ''}>
            <Check on={sel.has(t.id)} onChange={() => sel.toggle(t.id)} label={`Select ${t.title}`} />
            <div className="flex min-w-0 items-center gap-[10px]">
              <RowMark>{initials(t.title)}</RowMark>
              <span className="truncate">{t.title}</span>
            </div>
            <span className="flex min-w-0 items-center gap-[6px]">
              <SIcon name={kind.icon} size={12} className="flex-none text-slate-500" />
              <span className="truncate">{kind.label}</span>
            </span>
            <span className="text-right tabular-nums">{steps}</span>
            <div className="flex min-w-0 items-center gap-[6px]">
              {uses.length === 0 ? (
                <span className="text-slate-500">Not in a play</span>
              ) : (
                <>
                  {uses.slice(0, 2).map((u) => (
                    <button
                      key={u.play.id}
                      type="button"
                      title={`${u.play.name}: ${u.roles.join(', ')}. Opens the play.`}
                      onClick={(e) => {
                        e.stopPropagation()
                        openPlay(u.play.id)
                      }}
                      className="slg-tag inline-flex min-w-0 max-w-[170px] shrink items-center gap-[5px] bg-[var(--slg-neutral-100)] px-[6px] py-[1px] text-[12px] hover:bg-[var(--slg-neutral-200)]"
                    >
                      <span className={`h-[6px] w-[6px] flex-none rounded-full ${u.play.status === 'live' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="truncate">{u.play.name}</span>
                    </button>
                  ))}
                  {uses.length > 2 && (
                    <span className="flex-none text-[12px] text-slate-500" title={uses.slice(2).map((u) => u.play.name).join(', ')}>
                      +{uses.length - 2}
                    </span>
                  )}
                </>
              )}
            </div>
            <span>
              <StatusChip live={live} />
            </span>
            <Ago at={t.updatedAt} />
            <RowActions label={`Actions for ${t.title}`} items={items} />
          </TableRow>
        )
      })}
    </div>
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
        <button type="button" onClick={() => openLibrary(kind, true)} className="text-slate-500 hover:text-slate-900">
          New {KINDS[kind].one}
        </button>
      </div>
    </div>
  )
}

function ListGroup({ kind, count, hidden, onMore, children }: { kind: Kind; count: number; hidden: number; onMore?: () => void; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <GroupHead kind={kind} count={count} className="border-b border-slate-200 bg-slate-50 px-[16px] py-[8px]" />
      <ul>{children}</ul>
      {hidden > 0 && onMore && (
        <button type="button" onClick={onMore} className="w-full border-t border-slate-100 px-[16px] py-[9px] text-left text-[12.5px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900">
          {hidden} more {hidden === 1 ? KINDS[kind].one : `${KINDS[kind].one}s`}
        </button>
      )}
    </div>
  )
}

function ListRow({ item, onClick }: { item: Item; onClick: () => void }) {
  return (
    <li className="border-t border-slate-100 first:border-t-0">
      <button type="button" onClick={onClick} className="flex w-full items-center gap-[16px] px-[16px] py-[10px] text-left transition-colors hover:bg-slate-50">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-slate-900">{item.title}</span>
          {item.line && <span className="block truncate text-[12.5px] text-slate-500">{item.line}</span>}
        </span>
        {item.detail && <span className="flex-none text-[12.5px] text-slate-500">{item.detail}</span>}
      </button>
    </li>
  )
}

function AddRow({ kind }: { kind: Kind }) {
  return (
    <li>
      <button type="button" onClick={() => openLibrary(kind, true)} className="w-full px-[16px] py-[12px] text-left text-[13px] text-slate-500 hover:bg-slate-50 hover:text-slate-900">
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

function GridCard({ item, onClick }: { item: Item; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex aspect-[3/4] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden border-b border-slate-100 bg-slate-50 p-[14px]">{item.preview}</div>
      <div className="min-w-0 px-[12px] py-[10px]">
        <span className="block truncate text-[13px] font-medium text-slate-900">{item.title}</span>
        {item.detail && <span className="block truncate text-[12px] text-slate-500">{item.detail}</span>}
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
