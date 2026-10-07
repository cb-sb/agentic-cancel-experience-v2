import { useMemo } from 'react'
import { create } from 'zustand'
import { V10 } from '../layout/layoutMode'
import { AUDIENCE_LIBRARY, type Audience } from '../types/orchestration'
import { audienceById } from '../v10/useAudiences'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { nameProblem, uniqueName } from './names'
import { ALL_AUDIENCE, type CancelPlay, type PlayVariant } from './types'
import { copySubAudiences, evenIn, evenWeights as evenWeightsOf, groupOf, makePlayOps, newPlayId, normalizePlay, variantFor } from './playOps'

export { audienceUnset, blankSubAudience, evenWeights, groupOf, type PlayAction } from './playOps'

const KEY = 'cancel-experience:plays:v8'

interface PlaysState {
  plays: CancelPlay[]
  /** v9: put away. Out of the order and of every count, until brought back. */
  archived: CancelPlay[]
  /** False until the workspace boots and either reads or migrates the plays. */
  ready: boolean
}

export const usePlays = create<PlaysState>(() => ({ plays: [], archived: [], ready: false }))

const newId = newPlayId

function persist() {
  try {
    const { plays, archived } = usePlays.getState()
    localStorage.setItem(KEY, JSON.stringify({ v: 1, plays, archived }))
  } catch {
    /* quota */
  }
}

function read(): { plays: CancelPlay[]; archived: CancelPlay[] } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number; plays?: CancelPlay[]; archived?: CancelPlay[] }
    if (parsed.v !== 1 || !Array.isArray(parsed.plays)) return null
    return { plays: parsed.plays.map(normalizePlay), archived: Array.isArray(parsed.archived) ? parsed.archived.map(normalizePlay) : [] }
  } catch {
    return null
  }
}

function set(plays: CancelPlay[]) {
  usePlays.setState({ plays })
  persist()
}

function patch(id: string, change: (p: CancelPlay) => CancelPlay) {
  set(usePlays.getState().plays.map((p) => (p.id === id ? { ...change(p), updatedAt: Date.now() } : p)))
}

export function savedAudience(id: string): Audience {
  const fromV10 = V10 ? audienceById(id) : undefined
  if (fromV10) return { id: `aud-${fromV10.id}`, name: fromV10.name, ruleType: 'TARGETING', savedAudienceId: fromV10.id }
  const saved = AUDIENCE_LIBRARY.find((a) => a.id === id)
  if (!saved) return ALL_AUDIENCE
  return { id: `aud-${saved.id}`, name: saved.name, ruleType: 'TARGETING', savedAudienceId: saved.id }
}

function blankPlay(name: string, variants: PlayVariant[] = [], audience: Audience = ALL_AUDIENCE): CancelPlay {
  const now = Date.now()
  return {
    id: newId('play'),
    name,
    audience,
    control: 0,
    splitBy: 'percent',
    variants,
    subAudiences: [],
    emptyRows: [],
    status: 'draft',
    language: 'en',
    saveWindowDays: null,
    createdAt: now,
    updatedAt: now,
  }
}

export interface ThreadLike {
  id: string
  title: string
  seed?: string
  blank?: boolean
  audience?: Audience
  live?: boolean
}

/**
 * Before v8 plays, each experience carried its own audience and test. Each one
 * that has content becomes a play with that experience as Variant A.
 */
function migrate(threads: ThreadLike[]): CancelPlay[] {
  const taken: string[] = []
  const plays: CancelPlay[] = []
  for (const t of threads) {
    if (t.blank) continue
    const name = uniqueName(t.title, taken)
    taken.push(name)
    const play = blankPlay(name, [variantFor(t.id)], t.audience ?? ALL_AUDIENCE)
    if (t.live) play.status = 'live'
    plays.push(play)
  }
  return plays
}

/** A first visit gets a small, realistic set: one A/B play, one segment play sharing an experience. */
function seed(threads: ThreadLike[]): CancelPlay[] {
  const bySeed = (s: string) => threads.find((t) => t.seed === s)?.id
  const fair = bySeed('cancel_4')
  const plan = bySeed('cancel_plan_change')
  const quick = bySeed('cancel_1')
  const plays: CancelPlay[] = []
  if (fair && plan) {
    const p = blankPlay('Save most cancels', evenWeightsOf([variantFor(fair), variantFor(plan)]), savedAudience('all_paying'))
    plays.push(p)
  }
  if (fair) {
    const p = blankPlay('High-value accounts', [variantFor(fair)], savedAudience('high_value'))
    p.control = 10
    plays.push(p)
  }
  if (quick) plays.push(blankPlay('Trial users', [variantFor(quick)], savedAudience('in_trial')))
  if (fair && plan && quick) {
    const annual = { id: newId('sub'), audience: savedAudience('annual') }
    const risky = { id: newId('sub'), audience: savedAudience('high_risk') }
    const p = blankPlay(
      'Plan-based saves',
      [variantFor(fair, 50, annual.id), variantFor(plan, 50, annual.id), variantFor(quick, 50, risky.id), variantFor(plan, 50, risky.id), variantFor(fair)],
      savedAudience('all_paying'),
    )
    p.splitBy = 'segments'
    p.subAudiences = [annual, risky]
    plays.push(p)
  }
  return plays
}

/**
 * Boot. `fresh` means the workspace was just seeded. A saved workspace from
 * before plays migrates, and cancel-page priority moves from experiences to plays.
 */
export function initPlays(threads: ThreadLike[], fresh: boolean) {
  const saved = read()
  if (saved) {
    usePlays.setState({ ...saved, ready: true })
    return
  }
  const plays = fresh ? seed(threads) : migrate(threads)
  usePlays.setState({ plays, ready: true })
  persist()
  const old = useCancelSettings.getState().priority
  const byThread = new Map(plays.map((p) => [p.variants[0]?.experienceId, p.id]))
  const mapped = old.map((id) => byThread.get(id)).filter((id): id is string => Boolean(id))
  const rest = plays.map((p) => p.id).filter((id) => !mapped.includes(id))
  useCancelSettings.getState().setPriority([...mapped, ...rest])
}

export function playNames(exceptId?: string): string[] {
  return usePlays
    .getState()
    .plays.filter((p) => p.id !== exceptId)
    .map((p) => p.name)
}

export function createPlay(opts: { name?: string; experienceId?: string } = {}): string {
  const name = uniqueName(opts.name ?? 'New play', playNames())
  const play = blankPlay(name, opts.experienceId ? [variantFor(opts.experienceId)] : [])
  set([...usePlays.getState().plays, play])
  const { priority, setPriority } = useCancelSettings.getState()
  setPriority([...priority.filter((id) => id !== play.id), play.id])
  return play.id
}

export function renamePlay(id: string, name: string): string | null {
  const problem = nameProblem(name, playNames(id), 'play')
  if (problem) return problem
  patch(id, (p) => ({ ...p, name: name.trim().replace(/\s+/g, ' ') }))
  return null
}

/** Same audience, split and experiences, drafted under a new name. */
export function duplicatePlay(id: string): string | null {
  const src = usePlays.getState().plays.find((p) => p.id === id)
  if (!src) return null
  const now = Date.now()
  const copy: CancelPlay = {
    ...src,
    id: newId('play'),
    name: uniqueName(`${src.name} copy`, playNames()),
    ...copySubAudiences(src),
    status: 'draft',
    publishedAt: undefined,
    createdAt: now,
    updatedAt: now,
  }
  const plays = usePlays.getState().plays
  const at = plays.findIndex((p) => p.id === id)
  set([...plays.slice(0, at + 1), copy, ...plays.slice(at + 1)])
  const { priority, setPriority } = useCancelSettings.getState()
  const rank = priority.indexOf(id)
  setPriority(rank < 0 ? [...priority, copy.id] : [...priority.slice(0, rank + 1), copy.id, ...priority.slice(rank + 1)])
  return copy.id
}

export function deletePlay(id: string) {
  set(usePlays.getState().plays.filter((p) => p.id !== id))
  const { priority, setPriority } = useCancelSettings.getState()
  setPriority(priority.filter((p) => p !== id))
}

/** v9: out of the order, back to draft. Its experiences stay where they are. */
export function archivePlay(id: string) {
  const { plays, archived } = usePlays.getState()
  const play = plays.find((p) => p.id === id)
  if (!play) return
  usePlays.setState({
    plays: plays.filter((p) => p.id !== id),
    archived: [{ ...play, status: 'draft', archivedAt: Date.now() }, ...archived],
  })
  persist()
  const { priority, setPriority } = useCancelSettings.getState()
  setPriority(priority.filter((p) => p !== id))
}

/** Comes back as a draft at the bottom of the order. Pages archived since then drop out of it. */
export function unarchivePlay(id: string, experienceIds: string[]) {
  const { plays, archived } = usePlays.getState()
  const play = archived.find((p) => p.id === id)
  if (!play) return
  const keep = new Set(experienceIds)
  const back: CancelPlay = { ...play, name: uniqueName(play.name, plays.map((p) => p.name)), variants: play.variants.filter((v) => keep.has(v.experienceId)), archivedAt: undefined, updatedAt: Date.now() }
  usePlays.setState({ plays: [...plays, back], archived: archived.filter((p) => p.id !== id) })
  persist()
  const { priority, setPriority } = useCancelSettings.getState()
  setPriority([...priority.filter((p) => p !== id), id])
}

export function deleteArchivedPlay(id: string) {
  usePlays.setState({ archived: usePlays.getState().archived.filter((p) => p.id !== id) })
  persist()
}


const ops = makePlayOps({
  get: (id) => usePlays.getState().plays.find((p) => p.id === id),
  patch,
})

export const {
  setAction,
  setSplitBy,
  addSubAudience,
  setSubAudience,
  removeSubAudience,
  addRow,
  setRowPage,
  setRowWeight,
  removeRow,
  setVariant,
  evenWeightsIn,
  addToPlay,
  removeFromPlay,
  moveToPlay,
  reorderVariant,
  swapExperience,
  updatePlay,
  setPlayLive,
} = ops

export const retentionPlayOps = ops

/** An experience was deleted: take it out of every play. */
export function dropExperience(experienceId: string) {
  const plays = usePlays.getState().plays
  if (!plays.some((p) => p.variants.some((v) => v.experienceId === experienceId))) return
  set(
    plays.map((p) => {
      if (!p.variants.some((v) => v.experienceId === experienceId)) return p
      const groups = new Set(p.variants.filter((v) => v.experienceId === experienceId).map((v) => groupOf(p, v)))
      let next: CancelPlay = { ...p, variants: p.variants.filter((v) => v.experienceId !== experienceId), updatedAt: Date.now() }
      for (const g of groups) next = evenIn(next, g)
      return next
    }),
  )
}

/** Every play an experience sits in. */
export function playsUsing(experienceId: string, plays = usePlays.getState().plays): CancelPlay[] {
  return plays.filter((p) => p.variants.some((v) => v.experienceId === experienceId))
}

export function usePlaysUsing(experienceId: string): CancelPlay[] {
  const plays = usePlays((s) => s.plays)
  return playsUsing(experienceId, plays)
}

/** Plays in priority order. Ones never ranked go last, oldest first. */
export function rankedPlays(plays: CancelPlay[], priority: string[]): CancelPlay[] {
  const rank = new Map(priority.map((id, i) => [id, i]))
  return [...plays].sort((a, b) => {
    const ra = rank.get(a.id)
    const rb = rank.get(b.id)
    if (ra !== undefined && rb !== undefined) return ra - rb
    if (ra !== undefined) return -1
    if (rb !== undefined) return 1
    return a.createdAt - b.createdAt
  })
}

export function useRankedPlays(): CancelPlay[] {
  const plays = usePlays((s) => s.plays)
  const priority = useCancelSettings((s) => s.priority)
  return useMemo(() => rankedPlays(plays, priority), [plays, priority])
}
