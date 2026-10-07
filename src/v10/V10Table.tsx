import { useMemo } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { TYPE_ICON, TYPE_LABEL, type GrowthObjective } from '../concierge/model'
import { archiveGrowthExperience, duplicateGrowthExperience, useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { archiveGrowthPlay, duplicateGrowthPlay, useGrowthPlays } from '../concierge/useGrowthPlays'
import { SHELL_KIND, shellOf, stepCount } from '../layout/experienceKind'
import { Ago, BulkAction, Check, RowActions, RowMark, SelectHead, TableEmpty, TableRow, initials, useSelection } from '../layout/SlgTable'
import { StatusChip } from '../layout/StatusChip'
import { archiveExperienceNow, archivePlayNow } from '../plays/archive'
import { audienceText } from '../plays/resolve'
import type { CancelPlay } from '../plays/types'
import { toast, type MenuItem } from '../plays/ui'
import { duplicatePlay, playsUsing, usePlays, useRankedPlays } from '../plays/usePlays'
import { audienceSummary } from '../types/orchestration'
import { duplicateThread, useWorkspace } from '../workspace/useWorkspace'
import { useAudiences } from './useAudiences'
import type { V10Row } from './rows'
import { openRef, useV10, type V10Source, type V10Tab } from './useV10'

/** Shared with the view bar so the table and the tabs line up, including on wide screens. */
export const V10_GUTTER = 'px-[28px] min-[1440px]:px-[40px] min-[1800px]:px-[64px]'

const PLAY_COLS =
  'grid items-center gap-x-[10px] min-[1440px]:gap-x-[16px] min-[1800px]:gap-x-[20px] grid-cols-[16px_minmax(168px,1.8fr)_minmax(108px,0.9fr)_minmax(136px,1.35fr)_minmax(148px,1.35fr)_minmax(108px,0.85fr)_minmax(120px,1fr)_68px_52px_92px_52px]'
const EXPERIENCE_COLS =
  'grid items-center gap-x-[10px] min-[1440px]:gap-x-[16px] min-[1800px]:gap-x-[20px] grid-cols-[16px_minmax(180px,1.8fr)_minmax(108px,0.85fr)_minmax(120px,0.8fr)_52px_minmax(200px,1.7fr)_68px_92px_52px]'
const AUDIENCE_COLS =
  'grid items-center gap-x-[10px] min-[1440px]:gap-x-[16px] min-[1800px]:gap-x-[20px] grid-cols-[16px_minmax(180px,1.6fr)_minmax(108px,0.8fr)_minmax(220px,2fr)_minmax(180px,1.4fr)_68px_92px_52px]'

const COLS = { plays: PLAY_COLS, experiences: EXPERIENCE_COLS, audiences: AUDIENCE_COLS } as const

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
  shown,
  groups,
  grouped,
}: {
  tab: V10Tab
  shown: V10Row[]
  groups: { label: string; rows: V10Row[] }[]
  grouped: boolean
}) {
  const facts = useFacts()
  const pins = useV10((state) => state.pins)
  const sel = useSelection(shown.map(rowKey))
  const picked = shown.filter((row) => sel.has(rowKey(row)))
  const liveCount = picked.filter((row) => row.status === 'live').length
  const cols = COLS[tab]
  return (
    <div className="min-w-[1080px] min-[1440px]:min-w-0">
      <SelectHead
        cols={cols}
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
        {tab === 'plays' && (
          <>
            <span>Play</span>
            <span>Tags</span>
            <span>Audience</span>
            <span>Experiences</span>
            <span>Page type</span>
            <span>Setup</span>
            <span>Status</span>
            <span className="text-right">Priority</span>
            <span>Edited</span>
            <span />
          </>
        )}
        {tab === 'experiences' && (
          <>
            <span>Experience</span>
            <span>Tags</span>
            <span>Type</span>
            <span className="text-right">Steps</span>
            <span>Used in</span>
            <span>Status</span>
            <span>Edited</span>
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
            <span>Edited</span>
            <span />
          </>
        )}
      </SelectHead>
      {shown.length === 0 && <TableEmpty>Nothing matches this view.</TableEmpty>}
      {groups.map((group) => (
        <div key={group.label || 'all'}>
          {grouped && (
            <h2 className="flex items-center gap-[6px] border-b border-[var(--slg-color-border-default)] bg-[var(--slg-neutral-50)] px-[16px] py-[8px] text-[12.5px] font-medium text-slate-600">
              {group.label}
              <span className="font-normal tabular-nums text-slate-400">{group.rows.length}</span>
            </h2>
          )}
          {group.rows.map((row) => (
            <DataRow key={`${rowKey(row)}:${group.label}`} row={row} cols={cols} picked={sel.has(rowKey(row))} onToggle={() => sel.toggle(rowKey(row))} pinned={pins.some((pin) => pin.kind === row.kind && pin.id === row.id)} facts={facts} />
          ))}
        </div>
      ))}
    </div>
  )
}

function DataRow({
  row,
  cols,
  picked,
  onToggle,
  pinned,
  facts,
}: {
  row: V10Row
  cols: string
  picked: boolean
  onToggle: () => void
  pinned: boolean
  facts: Facts
}) {
  const items = menuOf(row, pinned)
  return (
    <TableRow cols={cols} onOpen={() => openRef(row)} className={`group ${picked ? 'is-picked' : ''}`}>
      <Check on={picked} onChange={onToggle} label={`Select ${row.title}`} />
      <div className="flex min-w-0 items-center gap-[10px]">
        <RowMark>{initials(row.title)}</RowMark>
        <span className="truncate">{row.title}</span>
      </div>
      <span className="truncate text-slate-600">{row.tags.map(tagWord).join(', ') || '—'}</span>
      {row.kind === 'play' && <PlayCells row={row} facts={facts} />}
      {row.kind === 'experience' && <ExperienceCells row={row} facts={facts} />}
      {row.kind === 'audience' && <AudienceCells row={row} facts={facts} />}
      <span>
        <StatusChip live={row.status === 'live'} />
      </span>
      {row.kind === 'play' && <span className="text-right tabular-nums">{facts.play.get(`${row.source}:${row.id}`)?.priority ?? '—'}</span>}
      <Ago at={row.updatedAt} />
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
  )
}

function PlayCells({ row, facts }: { row: V10Row; facts: Facts }) {
  const play = facts.play.get(`${row.source}:${row.id}`)
  return (
    <>
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
      <span className="truncate text-slate-600">{play?.pageType ?? 'None yet'}</span>
      <span className="truncate text-slate-600">{play?.setup ?? '—'}</span>
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

  return useMemo(() => {
    const names = new Map<string, string>()
    growthExperiences.forEach((item) => names.set(item.id, item.name))
    threads.forEach((thread) => names.set(thread.id, thread.title))
    const growthTypes = new Map(growthExperiences.map((item) => [item.id, TYPE_LABEL[item.type]]))
    const shells = new Map(threads.map((thread) => [thread.id, SHELL_KIND[shellOf(thread)].label]))
    const play = new Map<string, PlayFact>()
    const addPlay = (item: CancelPlay, source: V10Source, priority: number) => {
      const ids = [...new Set(item.variants.map((variant) => variant.experienceId))]
      play.set(`${source}:${item.id}`, {
        audience: audienceText(item.audience),
        experience: ids[0] ? (names.get(ids[0]) ?? 'Experience') : '',
        more: Math.max(0, ids.length - 1),
        pageType: pageTypes(item, source, growthTypes, shells),
        setup: setupLine(item),
        priority,
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

    const references = (id: string, name: string, item: CancelPlay) => {
      const hit = (audience: { savedAudienceId?: string | null; name?: string } | undefined) => audience?.savedAudienceId === id || audience?.name === name
      return hit(item.audience) || item.subAudiences.some((sub) => hit(sub.audience))
    }
    const audience = new Map<string, AudienceFact>()
    audiences.forEach((item) => {
      const text = audienceSummary(item)
      audience.set(item.id, {
        rules: text || 'No rules yet',
        uses: [
          ...growthPlays.filter((playItem) => references(item.id, item.name, playItem)).map((playItem) => chip(playItem, 'growth', playItem.objective)),
          ...retention.filter((playItem) => references(item.id, item.name, playItem)).map((playItem) => chip(playItem, 'retention')),
        ],
      })
    })
    return { play, experience, audience }
  }, [audiences, growthExperiences, growthOrder, growthPlays, ranked, retention, threads])
}
