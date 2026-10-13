import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { TRIGGER_LABEL, TYPE_ICON, TYPE_LABEL, WIDGET_LABEL, type GrowthObjective } from '../concierge/model'
import { useGrowthLibrary } from '../concierge/useGrowthLibrary'
import { archiveGrowthExperience, duplicateGrowthExperience, useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { archiveGrowthPlay, duplicateGrowthPlay, useGrowthPlays } from '../concierge/useGrowthPlays'
import { SHELL_KIND, shellOf, stepCount } from '../layout/experienceKind'
import { Ago, BulkAction, Check, RowActions, RowMark, SelectHead, TableEmpty, TableRow, initials, useSelection } from '../layout/SlgTable'
import { StatusChip } from '../layout/StatusChip'
import { archiveExperienceNow, archivePlayNow } from '../plays/archive'
import { PlayCanvas } from '../plays/PlayCanvas'
import { audienceText, fallbackVariant, pagesIn } from '../plays/resolve'
import type { CancelPlay, PlayVariant } from '../plays/types'
import { toast, type MenuItem } from '../plays/ui'
import { audienceUnset, duplicatePlay, playsUsing, usePlays, useRankedPlays } from '../plays/usePlays'
import { audienceSummary } from '../types/orchestration'
import { duplicateThread, useWorkspace } from '../workspace/useWorkspace'
import { useAudiences } from './useAudiences'
import { cancelHoverPreview, previewOnHover } from './PreviewDock'
import type { V10Row } from './rows'
import { openRef, useV10, type V10Scope, type V10Source, type V10Tab } from './useV10'

/** Shared with the view bar so the table and the tabs line up, including on wide screens. */
export const V10_GUTTER = 'px-[28px] min-[1440px]:px-[40px] min-[1800px]:px-[64px]'

const PORTFOLIO_COLS =
  'grid items-center gap-x-[10px] min-[1440px]:gap-x-[16px] min-[1800px]:gap-x-[20px] grid-cols-[16px_minmax(168px,1.7fr)_100px_110px_minmax(136px,1.2fr)_minmax(148px,1.3fr)_68px_52px_92px_52px]'
const GROWTH_PLAY_COLS =
  'grid items-center gap-x-[10px] min-[1440px]:gap-x-[16px] min-[1800px]:gap-x-[20px] grid-cols-[16px_minmax(168px,1.6fr)_minmax(150px,1.25fr)_minmax(136px,1.1fr)_minmax(120px,1fr)_minmax(130px,1fr)_68px_52px_92px_52px]'
const RETENTION_PLAY_COLS =
  'grid items-center gap-x-[10px] min-[1440px]:gap-x-[16px] min-[1800px]:gap-x-[20px] grid-cols-[16px_minmax(168px,1.6fr)_minmax(136px,1.1fr)_minmax(160px,1.3fr)_minmax(140px,1.1fr)_52px_68px_92px_52px]'
const EXPERIENCE_COLS =
  'grid items-center gap-x-[10px] min-[1440px]:gap-x-[16px] min-[1800px]:gap-x-[20px] grid-cols-[16px_minmax(180px,1.8fr)_minmax(108px,0.85fr)_minmax(120px,0.8fr)_52px_minmax(200px,1.7fr)_68px_92px_52px]'
const AUDIENCE_COLS =
  'grid items-center gap-x-[10px] min-[1440px]:gap-x-[16px] min-[1800px]:gap-x-[20px] grid-cols-[16px_minmax(180px,1.6fr)_minmax(108px,0.8fr)_minmax(220px,2fr)_minmax(180px,1.4fr)_68px_92px_52px]'

const COLS = { experiences: EXPERIENCE_COLS, audiences: AUDIENCE_COLS } as const

function playCols(scope: V10Scope) {
  if (scope === 'retention') return RETENTION_PLAY_COLS
  if (scope === 'acquisition' || scope === 'expansion') return GROWTH_PLAY_COLS
  return PORTFOLIO_COLS
}

function compactTemplate(tab: V10Tab, scope: V10Scope) {
  if (tab === 'experiences') return '16px minmax(180px,1.8fr) minmax(108px,.85fr) minmax(120px,.8fr) 52px minmax(200px,1.7fr) 68px 52px'
  if (tab === 'audiences') return '16px minmax(180px,1.6fr) minmax(108px,.8fr) minmax(220px,2fr) minmax(180px,1.4fr) 68px 52px'
  if (scope === 'portfolio') return '16px minmax(168px,1.7fr) 100px 110px minmax(136px,1.2fr) minmax(148px,1.3fr) 68px 52px 52px'
  if (scope === 'retention') return '16px minmax(168px,1.6fr) minmax(136px,1.1fr) minmax(160px,1.3fr) minmax(140px,1.1fr) 68px 52px 52px'
  return '16px minmax(168px,1.6fr) minmax(150px,1.25fr) minmax(136px,1.1fr) minmax(120px,1fr) minmax(130px,1fr) 68px 52px 52px'
}

interface UseChip {
  key: string
  name: string
  live: boolean
  source: V10Source
  id: string
  objective?: GrowthObjective
}

function rowKey(row: V10Row) {
  return `${row.kind}:${row.source}:${row.id}`
}

function setupLine(play: CancelPlay): string {
  if (play.splitBy === 'segments') return `Split into ${play.subAudiences.length} sub-audience${play.subAudiences.length === 1 ? '' : 's'}`
  if (play.variants.length === 0) return 'No experience yet'
  if (play.variants.length === 1) return 'One experience'
  return `A/B test of ${play.variants.length}`
}

function pageTypes(play: CancelPlay, source: V10Source, growthTypes: Map<string, string>, shells: Map<string, string>): string {
  const ids = [...new Set(play.variants.map((variant) => variant.experienceId))]
  const labels = [...new Set(ids.map((id) => (source === 'growth' ? growthTypes.get(id) : shells.get(id))).filter((label): label is string => Boolean(label)))]
  return labels.join(', ') || 'None yet'
}

/** Plays, experiences and audiences in the same table, with the columns each list has in the app. */
export function V10Table({
  tab,
  scope,
  shown,
  groups,
  grouped,
  showEdited = true,
}: {
  tab: V10Tab
  scope: V10Scope
  shown: V10Row[]
  groups: { label: string; rows: V10Row[] }[]
  grouped: boolean
  showEdited?: boolean
}) {
  const facts = useFacts()
  const pins = useV10((state) => state.pins)
  const [openPlay, setOpenPlay] = useState<string | null>(null)
  const sel = useSelection(shown.map(rowKey))
  const [armed, setArmed] = useState(false)
  const picked = shown.filter((row) => sel.has(rowKey(row)))
  const picking = armed || picked.length > 0
  const liveCount = picked.filter((row) => row.status === 'live').length
  const cols = tab === 'plays' ? playCols(scope) : COLS[tab]
  const compactStyle = showEdited ? undefined : { gridTemplateColumns: compactTemplate(tab, scope) }
  const clearRef = useRef(sel.clear)
  clearRef.current = sel.clear
  const pickedCount = picked.length
  const previousCount = useRef(0)
  useEffect(() => {
    if (previousCount.current > 0 && pickedCount === 0) setArmed(false)
    previousCount.current = pickedCount
  }, [pickedCount])
  useEffect(() => {
    if (!picking) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return
      clearRef.current()
      setArmed(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picking])
  return (
    <div className={`slg-selectable min-w-[1080px] min-[1440px]:min-w-0 ${picking ? 'slg-picking' : ''}`}>
      <div className="sticky top-0 z-20 bg-white">
        {pickedCount === 0 && (
          <button type="button" className="slg-arm" onClick={() => setArmed((value) => !value)}>
            {armed ? 'Cancel' : 'Select'}
          </button>
        )}
        <SelectHead
          cols={cols}
          style={compactStyle}
          total={shown.length}
          picked={sel.picked.length}
          onAll={sel.setAll}
          onClear={sel.clear}
          actions={
            tab === 'audiences' ? null : (
              <BulkAction
                icon="archive"
                label="Archive"
                confirm={liveCount > 0 ? `${liveCount} live ${liveCount === 1 ? 'item stops' : 'items stop'} showing. Archive?` : undefined}
                onClick={() => {
                  picked.forEach(archiveRow)
                  sel.clear()
                }}
              />
            )
          }
        >
          {tab === 'plays' && <PlayHead scope={scope} showEdited={showEdited} />}
          {tab === 'experiences' && (
            <>
              <span>Experience</span>
              <span>Tags</span>
              <span>Type</span>
              <span className="text-right">Steps</span>
              <span>Used in</span>
              <span>Status</span>
              {showEdited && <span>Edited</span>}
              <span />
            </>
          )}
          {tab === 'audiences' && (
            <>
              <span>Audience</span>
              <span>Tags</span>
              <span>Rules</span>
              <span>Used in</span>
              <span>Status</span>
              {showEdited && <span>Edited</span>}
              <span />
            </>
          )}
        </SelectHead>
      </div>
      {shown.length === 0 && <TableEmpty>Nothing matches this view.</TableEmpty>}
      {groups.map((group) => (
        <div key={group.label || 'all'}>
          {grouped && (
            <h2 className="flex items-center gap-[6px] border-b border-[var(--slg-color-border-default)] bg-[var(--slg-neutral-50)] px-[16px] py-[8px] text-[12.5px] font-medium text-slate-600">
              {group.label}
              <span className="font-normal tabular-nums text-slate-400">{group.rows.length}</span>
            </h2>
          )}
          {group.rows.map((row) => {
            const key = rowKey(row)
            return (
              <DataRow
                key={`${key}:${group.label}`}
                row={row}
                scope={scope}
                cols={cols}
                style={compactStyle}
                showEdited={showEdited}
                picked={sel.has(key)}
                onToggle={() => sel.toggle(key)}
                pinned={pins.some((pin) => pin.kind === row.kind && pin.id === row.id)}
                facts={facts}
                expanded={row.kind === 'play' && openPlay === key}
                onExpand={
                  row.kind === 'play'
                    ? () => {
                        setOpenPlay((current) => (current === key ? null : key))
                        useV10.getState().setTree({ kind: 'play', source: row.source, id: row.id, objective: row.objective })
                      }
                    : undefined
                }
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

function PlayHead({ scope, showEdited }: { scope: V10Scope; showEdited: boolean }) {
  if (scope === 'acquisition') {
    return (
      <>
        <span>Acquisition play</span><span>Trigger</span><span>Audience</span><span>Experience type</span><span>Experiment</span><span>Status</span><span className="text-right">Priority</span>{showEdited && <span>Edited</span>}<span />
      </>
    )
  }
  if (scope === 'expansion') {
    return (
      <>
        <span>Expansion play</span><span>Surface</span><span>Audience</span><span>Offer or plan</span><span>Experiment</span><span>Status</span><span className="text-right">Priority</span>{showEdited && <span>Edited</span>}<span />
      </>
    )
  }
  if (scope === 'retention') {
    return (
      <>
        <span>Retention play</span><span>Cancel audience</span><span>Save treatments</span><span>Fallback</span><span>Status</span><span className="text-right">Priority</span>{showEdited && <span>Edited</span>}<span />
      </>
    )
  }
  return (
    <>
      <span>Play</span><span>Objective</span><span>Play type</span><span>Audience</span><span>Experience</span><span>Status</span><span className="text-right">Priority</span>{showEdited && <span>Edited</span>}<span />
    </>
  )
}

function DataRow({
  row,
  scope,
  cols,
  style,
  showEdited,
  picked,
  onToggle,
  pinned,
  facts,
  expanded = false,
  onExpand,
}: {
  row: V10Row
  scope: V10Scope
  cols: string
  style?: CSSProperties
  showEdited: boolean
  picked: boolean
  onToggle: () => void
  pinned: boolean
  facts: Facts
  expanded?: boolean
  onExpand?: () => void
}) {
  const items = menuOf(row, pinned)
  const preview = () => previewOnHover({ kind: row.kind, source: row.source, id: row.id, objective: row.objective })
  return (
    <div onMouseEnter={preview} onFocus={preview} onMouseLeave={cancelHoverPreview}>
    <TableRow cols={cols} style={style} onOpen={() => (onExpand ? onExpand() : openRef(row))} className={`group ${picked ? 'is-picked' : ''} ${expanded ? 'bg-slate-50' : ''}`}>
      <Check on={picked} onChange={onToggle} label={`Select ${row.title}`} />
      <div className="flex min-w-0 items-center gap-[8px]">
        {onExpand && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${row.title}` : `Expand ${row.title}`}
            onClick={(event) => {
              event.stopPropagation()
              onExpand()
            }}
            className="-mx-[2px] flex h-[20px] w-[20px] flex-none cursor-pointer items-center justify-center rounded text-slate-400 transition-colors duration-150 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slg-color-action-primary)]"
          >
            <SIcon name="chevron-right" size={13} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
          </button>
        )}
        {row.kind === 'audience' && <RowMark>{initials(row.title)}</RowMark>}
        <span className="truncate">{row.title}</span>
      </div>
      {row.kind === 'play' ? (
        <PlayCells row={row} scope={scope} facts={facts} />
      ) : (
        <>
          <span className="truncate text-slate-600">{row.tags.map(tagWord).join(', ') || '—'}</span>
          {row.kind === 'experience' && <ExperienceCells row={row} facts={facts} />}
          {row.kind === 'audience' && <AudienceCells row={row} facts={facts} />}
        </>
      )}
      <span>
        <StatusChip live={row.status === 'live'} />
      </span>
      {row.kind === 'play' && (
        <span className="text-right tabular-nums">{facts.play.get(`${row.source}:${row.id}`)?.priority ?? '—'}</span>
      )}
      {showEdited && <Ago at={row.updatedAt} />}
      <span className="flex items-center justify-end gap-[2px]">
        <button
          type="button"
          aria-label={pinned ? `Unpin ${row.title}` : `Pin ${row.title}`}
          title={pinned ? 'Unpin' : 'Pin'}
          onClick={(event) => {
            event.stopPropagation()
            useV10.getState().togglePin(row)
          }}
          className={`flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-200 ${pinned ? 'text-slate-700' : 'text-slate-400 opacity-0 focus:opacity-100 group-hover:opacity-100'}`}
        >
          <SIcon name="pin" size={13} />
        </button>
        <RowActions label={`Actions for ${row.title}`} items={items} />
      </span>
    </TableRow>
    {expanded && <PlayMap row={row} />}
    </div>
  )
}

function PlayMap({ row }: { row: V10Row }) {
  const growthPlay = useGrowthPlays((state) => (row.source === 'growth' ? state.plays.find((play) => play.id === row.id) : undefined))
  const retentionPlay = usePlays((state) => (row.source === 'retention' ? state.plays.find((play) => play.id === row.id) : undefined))
  const play = growthPlay ?? retentionPlay
  const growthExperiences = useGrowthExperiences((state) => state.items)
  const threads = useWorkspace((state) => state.threads)
  const [canvasOpen, setCanvasOpen] = useState(false)
  if (!play) return null
  const nameOf = (id: string) => growthExperiences.find((item) => item.id === id)?.name ?? threads.find((item) => item.id === id)?.title ?? 'Experience'
  const iconOf = (id: string): SIconName => {
    const experience = growthExperiences.find((item) => item.id === id)
    if (experience) return TYPE_ICON[experience.type]
    const thread = threads.find((item) => item.id === id)
    return thread ? SHELL_KIND[shellOf(thread)].icon : 'file'
  }
  const openExperience = (id: string) => {
    openRef(row.source === 'growth' ? { kind: 'experience', source: 'growth', id, objective: row.objective } : { kind: 'experience', source: 'retention', id })
  }
  const audienceLine = play.audience.targetAll ? 'All subscribers' : audienceUnset(play.audience) ? 'No audience yet' : audienceText(play.audience)
  const previewExperience = (id: string) => previewOnHover({ kind: 'experience', source: row.source, id, objective: row.objective })
  const experienceNode = (variant: PlayVariant, depth: number) => (
    <div key={variant.id} onMouseEnter={(event) => { event.stopPropagation(); previewExperience(variant.experienceId) }}>
      <MapNode icon={iconOf(variant.experienceId)} label={nameOf(variant.experienceId)} depth={depth} onClick={() => openExperience(variant.experienceId)} />
    </div>
  )
  return (
    <div className="flex items-center border-b border-[var(--slg-color-border-default)] bg-slate-50 py-[8px] pl-[40px] pr-[16px]">
      <CanvasMark name={play.name} onClick={() => setCanvasOpen(true)} />
      <div className="ml-[8px] flex max-w-[520px] flex-col border-l border-slate-200 py-[2px] pl-[12px]">
        <MapNode icon="users" label={audienceLine} onClick={() => openRef(row)} />
        {play.splitBy === 'segments' ? (
          <>
            {play.subAudiences.map((item, index) => {
              const pages = pagesIn(play, item.id)
              return (
                <div key={item.id}>
                  <MapNode icon="users-round" label={audienceUnset(item.audience) ? `Sub-audience ${index + 1}` : audienceText(item.audience)} depth={1} onClick={() => openRef(row)} />
                  {pages.length === 0 ? <EmptyMap depth={2} /> : pages.map((variant) => experienceNode(variant, 2))}
                </div>
              )
            })}
            <MapNode icon="shield" label="Fallback" depth={1} onClick={() => openRef(row)} />
            {fallbackVariant(play) ? experienceNode(fallbackVariant(play)!, 2) : <EmptyMap depth={2} />}
          </>
        ) : play.variants.length === 0 ? (
          <EmptyMap depth={1} />
        ) : (
          play.variants.map((variant) => experienceNode(variant, 1))
        )}
      </div>
      {canvasOpen && <CanvasOverlay play={play} onClose={() => setCanvasOpen(false)} />}
    </div>
  )
}

function CanvasMark({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${name} canvas`}
      title="Open canvas"
      className="-m-[6px] flex flex-none cursor-pointer items-center justify-center rounded-md border border-transparent p-[6px] text-slate-400 transition-[color,background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-[var(--slg-color-action-primary)] hover:bg-[var(--slg-color-action-primary)] hover:text-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slg-color-action-primary)] focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
    >
      <svg viewBox="0 0 32 24" aria-hidden className="h-[18px] w-[24px] fill-none stroke-current stroke-[1.6]">
        <path d="M10 12H14M14 12V6.5H20M14 12V17.5H20" strokeLinejoin="round" />
        <rect x="2.5" y="8.5" width="7" height="7" rx="1.5" />
        <rect x="20.5" y="2.5" width="7" height="7" rx="1.5" />
        <rect x="20.5" y="14.5" width="7" height="7" rx="1.5" />
      </svg>
    </button>
  )
}

function CanvasOverlay({ play, onClose }: { play: CancelPlay; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/30 p-[24px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${play.name} canvas`} className="flex h-[min(760px,90vh)] w-[min(1120px,100%)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex h-[48px] flex-none items-center gap-[8px] border-b border-slate-200 px-[16px]">
          <h2 className="min-w-0 truncate text-[14px] font-semibold text-slate-900">{play.name}</h2>
          <button type="button" aria-label="Close canvas" onClick={onClose} className="ml-auto flex h-[28px] w-[28px] items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <SIcon name="x" size={14} />
          </button>
        </header>
        <div className="min-h-0 flex-1">
          <PlayCanvas play={play} />
        </div>
      </div>
    </div>
  )
}

function MapNode({ icon, label, depth = 0, onClick }: { icon: SIconName; label: string; depth?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/node flex h-[28px] min-w-0 cursor-pointer items-center gap-[8px] self-start rounded-md px-[6px] text-left text-[13px] text-slate-700 transition-colors duration-150 hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slg-color-action-primary)]"
      style={{ marginLeft: depth * 20 - 6 }}
    >
      <SIcon name={icon} size={13} className="flex-none text-slate-400 transition-colors group-hover/node:text-slate-600" />
      <span className="truncate">{label}</span>
    </button>
  )
}

function EmptyMap({ depth }: { depth: number }) {
  return (
    <p className="flex h-[28px] items-center text-[12.5px] text-slate-400" style={{ paddingLeft: depth * 20 + 21 }}>
      No experience yet
    </p>
  )
}

function PlayCells({ row, scope, facts }: { row: V10Row; scope: V10Scope; facts: Facts }) {
  const play = facts.play.get(`${row.source}:${row.id}`)
  if (scope === 'acquisition') {
    return (
      <>
        <span className="truncate text-slate-600">{play?.trigger ?? 'Any page'}</span>
        <span className="truncate">{play?.audience ?? '—'}</span>
        <span className="truncate text-slate-600">{play?.pageType ?? 'None yet'}</span>
        <span className="truncate text-slate-600">{play?.setup ?? '—'}</span>
      </>
    )
  }
  if (scope === 'expansion') {
    return (
      <>
        <span className="truncate text-slate-600">{play?.surface ?? '—'}</span>
        <span className="truncate">{play?.audience ?? '—'}</span>
        <span className="truncate text-slate-600">{play?.content ?? 'None yet'}</span>
        <span className="truncate text-slate-600">{play?.setup ?? '—'}</span>
      </>
    )
  }
  if (scope === 'retention') {
    return (
      <>
        <span className="truncate">{play?.audience ?? '—'}</span>
        <span className="truncate text-slate-600">{play?.treatments ?? 'None yet'}</span>
        <span className="truncate text-slate-600">{play?.fallback ?? 'No fallback'}</span>
      </>
    )
  }
  return (
    <>
      <span className="truncate text-slate-600">{row.tags.map(tagWord).join(', ') || '—'}</span>
      <span className="truncate text-slate-600">{play?.pageType ?? 'None yet'}</span>
      <span className="flex min-w-0 items-center gap-[6px]">
        <SIcon name="users" size={12} className="flex-none text-slate-500" />
        <span className="truncate">{play?.audience ?? '—'}</span>
      </span>
      <span className="min-w-0 truncate">
        {play && play.experience ? (
          <>
            {play.experience}
            {play.more > 0 && <span className="text-slate-500"> +{play.more}</span>}
          </>
        ) : (
          <span className="text-slate-500">None yet</span>
        )}
      </span>
    </>
  )
}

function ExperienceCells({ row, facts }: { row: V10Row; facts: Facts }) {
  const experience = facts.experience.get(`${row.source}:${row.id}`)
  return (
    <>
      <span className="flex min-w-0 items-center gap-[6px]">
        {experience?.icon && <SIcon name={experience.icon} size={12} className="flex-none text-slate-500" />}
        <span className="truncate">{row.type}</span>
      </span>
      <span className="text-right tabular-nums">{experience?.steps ?? '—'}</span>
      <UsedIn uses={experience?.uses ?? []} />
    </>
  )
}

function AudienceCells({ row, facts }: { row: V10Row; facts: Facts }) {
  const audience = facts.audience.get(row.id)
  return (
    <>
      <span className="truncate text-slate-600">{audience?.rules || 'No rules yet'}</span>
      <UsedIn uses={audience?.uses ?? []} />
    </>
  )
}

function UsedIn({ uses }: { uses: UseChip[] }) {
  if (uses.length === 0) return <span className="text-slate-500">Not in a play</span>
  const shown = uses.slice(0, 3)
  return (
    <div className="flex min-w-0 items-center gap-[6px]">
      {shown.map((use) => (
        <button
          key={use.key}
          type="button"
          title={use.name}
          onClick={(event) => {
            event.stopPropagation()
            openRef({ kind: 'play', source: use.source === 'growth' ? 'growth' : 'retention', id: use.id, objective: use.objective })
          }}
          className="inline-flex min-w-0 max-w-[180px] shrink items-center gap-[5px] bg-slate-100 px-[6px] py-[1px] text-[12px] hover:bg-slate-200 min-[1600px]:max-w-[240px]"
        >
          <span className={`h-[6px] w-[6px] flex-none rounded-full ${use.live ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <span className="truncate">{use.name}</span>
        </button>
      ))}
      {uses.length > shown.length && (
        <span className="flex-none text-[12px] text-slate-500" title={uses.slice(shown.length).map((use) => use.name).join(', ')}>
          +{uses.length - shown.length}
        </span>
      )}
    </div>
  )
}

const TAG_WORD: Record<string, string> = { acquisition: 'Acquisition', expansion: 'Expansion', retention: 'Retention' }
function tagWord(tag: string) {
  return TAG_WORD[tag] ?? tag
}

function menuOf(row: V10Row, pinned: boolean): MenuItem[] {
  const items: MenuItem[] = [
    { label: 'Open', icon: 'arrow-up-right', onClick: () => openRef(row) },
    { label: pinned ? 'Unpin' : 'Pin', icon: 'pin', onClick: () => useV10.getState().togglePin(row) },
  ]
  if (row.kind === 'play' || row.kind === 'experience') {
    items.push({
      label: 'Duplicate',
      icon: 'copy',
      hint: row.kind === 'play' ? 'Same audience and experiences, as a draft' : undefined,
      onClick: () => duplicateRow(row),
    })
    items.push({
      label: row.kind === 'play' ? 'Archive play' : 'Archive experience',
      icon: 'archive',
      confirm: row.status === 'live' ? 'It stops showing. Click again to archive' : undefined,
      onClick: () => archiveRow(row),
    })
  }
  return items
}

function duplicateRow(row: V10Row) {
  if (row.kind === 'play' && row.source === 'retention' && duplicatePlay(row.id)) toast('Duplicated as a draft.')
  if (row.kind === 'play' && row.source === 'growth' && duplicateGrowthPlay(row.id)) toast('Duplicated as a draft.')
  if (row.kind === 'experience' && row.source === 'retention' && duplicateThread(row.id)) toast(`Duplicated ${row.title}.`)
  if (row.kind === 'experience' && row.source === 'growth' && duplicateGrowthExperience(row.id)) toast('Duplicated as a draft.')
}

function archiveRow(row: V10Row) {
  if (row.kind === 'play' && row.source === 'retention') {
    const play = usePlays.getState().plays.find((item) => item.id === row.id)
    if (play) archivePlayNow(play)
  }
  if (row.kind === 'play' && row.source === 'growth') {
    archiveGrowthPlay(row.id)
    toast(`Archived ${row.title}. Its experiences stay in the list.`)
  }
  if (row.kind === 'experience' && row.source === 'retention') archiveExperienceNow(row.id)
  if (row.kind === 'experience' && row.source === 'growth') {
    archiveGrowthExperience(row.id)
    toast(`Archived ${row.title}.`)
  }
}

interface PlayFact {
  audience: string
  experience: string
  more: number
  pageType: string
  setup: string
  priority: number
  trigger: string
  surface: string
  content: string
  treatments: string
  fallback: string
}

interface ExperienceFact {
  icon: (typeof TYPE_ICON)[keyof typeof TYPE_ICON] | (typeof SHELL_KIND)[keyof typeof SHELL_KIND]['icon']
  steps: number | string
  uses: UseChip[]
}

interface AudienceFact {
  rules: string
  uses: UseChip[]
}

interface Facts {
  play: Map<string, PlayFact>
  experience: Map<string, ExperienceFact>
  audience: Map<string, AudienceFact>
}

function useFacts(): Facts {
  const growthPlays = useGrowthPlays((state) => state.plays)
  const growthOrder = useGrowthPlays((state) => state.order)
  const growthExperiences = useGrowthExperiences((state) => state.items)
  const retention = usePlays((state) => state.plays)
  const ranked = useRankedPlays()
  const threads = useWorkspace((state) => state.threads)
  const audiences = useAudiences((state) => state.items)
  const offers = useGrowthLibrary((state) => state.offers)
  const pricingTables = useGrowthLibrary((state) => state.pricingTables)

  return useMemo(() => {
    const names = new Map<string, string>()
    growthExperiences.forEach((item) => names.set(item.id, item.name))
    threads.forEach((thread) => names.set(thread.id, thread.title))
    const growthTypes = new Map(growthExperiences.map((item) => [item.id, TYPE_LABEL[item.type]]))
    const shells = new Map(threads.map((thread) => [thread.id, SHELL_KIND[shellOf(thread)].label]))
    const references = new Map([...offers, ...pricingTables].map((item) => [item.id, item.name]))
    const play = new Map<string, PlayFact>()
    const addPlay = (item: CancelPlay, source: V10Source, priority: number) => {
      const ids = [...new Set(item.variants.map((variant) => variant.experienceId))]
      const growthItems = ids.map((id) => growthExperiences.find((experience) => experience.id === id)).filter((value): value is NonNullable<typeof value> => Boolean(value))
      const triggers = [...new Set(growthItems.map((experience) => {
        const label = TRIGGER_LABEL[experience.trigger.kind]
        return experience.trigger.value ? `${label}: ${experience.trigger.value}` : label
      }))]
      const surfaces = [...new Set(growthItems.map((experience) => {
        if (experience.type === 'pricing_table') return 'Pricing page'
        const offer = offers.find((entry) => entry.id === experience.refId)
        return offer ? WIDGET_LABEL[offer.widget] : TYPE_LABEL[experience.type]
      }))]
      const contents = [...new Set(growthItems.map((experience) => experience.refId ? references.get(experience.refId) : undefined).filter((value): value is string => Boolean(value)))]
      const fallback = fallbackVariant(item)
      const fallbackName = fallback ? names.get(fallback.experienceId) : undefined
      play.set(`${source}:${item.id}`, {
        audience: audienceText(item.audience),
        experience: ids[0] ? (names.get(ids[0]) ?? 'Experience') : '',
        more: Math.max(0, ids.length - 1),
        pageType: pageTypes(item, source, growthTypes, shells),
        setup: setupLine(item),
        priority,
        trigger: triggers.join(', ') || (source === 'retention' ? 'Cancellation' : 'Any page'),
        surface: surfaces.join(', ') || pageTypes(item, source, growthTypes, shells),
        content: contents.join(', ') || (ids[0] ? (names.get(ids[0]) ?? 'Experience') : ''),
        treatments: ids.map((id) => names.get(id)).filter(Boolean).join(', '),
        fallback: fallbackName ?? (item.splitBy === 'segments' ? 'Not set' : 'Not used'),
      })
    }
    ranked.forEach((item, index) => addPlay(item, 'retention', index + 1))
    growthPlays.forEach((item) => {
      const order = growthOrder[item.objective] ?? []
      const at = order.indexOf(item.id)
      addPlay(item, 'growth', at >= 0 ? at + 1 : order.length + 1)
    })

    const chip = (item: CancelPlay, source: V10Source, objective?: GrowthObjective): UseChip => ({
      key: `${source}:${item.id}`,
      name: item.name,
      live: item.status === 'live',
      source,
      id: item.id,
      objective,
    })
    const usesOf = (id: string) => [
      ...growthPlays.filter((item) => item.variants.some((variant) => variant.experienceId === id)).map((item) => chip(item, 'growth', item.objective)),
      ...playsUsing(id, retention).map((item) => chip(item, 'retention')),
    ]
    const experience = new Map<string, ExperienceFact>()
    growthExperiences.forEach((item) => {
      experience.set(`growth:${item.id}`, { icon: TYPE_ICON[item.type], steps: '—', uses: usesOf(item.id) })
    })
    threads.forEach((thread) => {
      experience.set(`retention:${thread.id}`, { icon: SHELL_KIND[shellOf(thread)].icon, steps: stepCount(thread), uses: usesOf(thread.id) })
    })

    const referencesAudience = (id: string, name: string, item: CancelPlay) => {
      const hit = (audience: { savedAudienceId?: string | null; name?: string } | undefined) => audience?.savedAudienceId === id || audience?.name === name
      return hit(item.audience) || item.subAudiences.some((sub) => hit(sub.audience))
    }
    const audience = new Map<string, AudienceFact>()
    audiences.forEach((item) => {
      const text = audienceSummary(item)
      audience.set(item.id, {
        rules: text || 'No rules yet',
        uses: [
          ...growthPlays.filter((playItem) => referencesAudience(item.id, item.name, playItem)).map((playItem) => chip(playItem, 'growth', playItem.objective)),
          ...retention.filter((playItem) => referencesAudience(item.id, item.name, playItem)).map((playItem) => chip(playItem, 'retention')),
        ],
      })
    })
    return { play, experience, audience }
  }, [audiences, growthExperiences, growthOrder, growthPlays, offers, pricingTables, ranked, retention, threads])
}
