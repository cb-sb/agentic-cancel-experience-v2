import { useMemo } from 'react'
import { create } from 'zustand'
import { AUDIENCE_LIBRARY, type Audience } from '../types/orchestration'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { nameProblem, uniqueName } from './names'
import { ALL_AUDIENCE, type CancelPlay, type EmptyRow, type PlayVariant, type SplitBy, type SubAudience } from './types'

const KEY = 'cancel-experience:plays:v8'

interface PlaysState {
  plays: CancelPlay[]
  /** False until the workspace boots and either reads or migrates the plays. */
  ready: boolean
}

export const usePlays = create<PlaysState>(() => ({ plays: [], ready: false }))

let n = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${n++}`

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, plays: usePlays.getState().plays }))
  } catch {
    /* quota */
  }
}

/** Saves from before sub-audiences held pages: each page with its own audience becomes a sub-audience. */
function normalize(p: CancelPlay): CancelPlay {
  const subAudiences: SubAudience[] = [...(p.subAudiences ?? [])]
  const variants = p.variants.map((v) => {
    if (!v.audience) return v
    const { audience, ...rest } = v
    if (p.splitBy !== 'segments' || rest.subAudienceId) return rest
    const sub = { id: newId('sub'), audience }
    subAudiences.push(sub)
    return { ...rest, subAudienceId: sub.id, weight: 100 }
  })
  return { ...p, variants, subAudiences, emptyRows: p.emptyRows ?? [] }
}

function read(): CancelPlay[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number; plays?: CancelPlay[] }
    return parsed.v === 1 && Array.isArray(parsed.plays) ? parsed.plays.map(normalize) : null
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

function variantFor(experienceId: string, weight = 100, subAudienceId?: string): PlayVariant {
  return subAudienceId ? { id: newId('var'), experienceId, weight, subAudienceId } : { id: newId('var'), experienceId, weight }
}

/** Equal shares that add up to exactly 100. */
export function evenWeights(variants: PlayVariant[]): PlayVariant[] {
  if (variants.length === 0) return variants
  const base = Math.floor(100 / variants.length)
  const extra = 100 - base * variants.length
  return variants.map((v, i) => ({ ...v, weight: base + (i < extra ? 1 : 0) }))
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
    const p = blankPlay('Save most cancels', evenWeights([variantFor(fair), variantFor(plan)]), savedAudience('all_paying'))
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
    usePlays.setState({ plays: saved, ready: true })
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

function copySubAudiences(src: CancelPlay): Pick<CancelPlay, 'variants' | 'subAudiences' | 'emptyRows'> {
  const ids = new Map(src.subAudiences.map((x) => [x.id, newId('sub')]))
  const subId = (id: string | null | undefined) => (id ? ids.get(id) : undefined)
  return {
    subAudiences: src.subAudiences.map((x) => ({ ...x, id: ids.get(x.id)! })),
    variants: src.variants.map((v) => ({ ...v, id: newId('var'), ...(v.subAudienceId ? { subAudienceId: subId(v.subAudienceId) } : {}) })),
    emptyRows: src.emptyRows.map((r) => ({ ...r, id: newId('row'), subAudienceId: subId(r.subAudienceId) ?? null })),
  }
}

export function deletePlay(id: string) {
  set(usePlays.getState().plays.filter((p) => p.id !== id))
  const { priority, setPriority } = useCancelSettings.getState()
  setPriority(priority.filter((p) => p !== id))
}

export function updatePlay(id: string, change: Partial<Omit<CancelPlay, 'id'>>) {
  patch(id, (p) => ({ ...p, ...change }))
}

/** Which test a page or empty row is in. Null: the play's own test, or the fallback when split by sub-audience. */
export function groupOf(p: CancelPlay, row: { subAudienceId?: string | null }): string | null {
  return p.splitBy === 'segments' ? (row.subAudienceId ?? null) : null
}

/** Spread 100% evenly over one test's pages and empty rows. The fallback is always one page. */
function evenIn(p: CancelPlay, group: string | null): CancelPlay {
  if (p.splitBy === 'segments' && group === null) return p
  const ids = [
    ...p.variants.filter((v) => groupOf(p, v) === group).map((v) => v.id),
    ...p.emptyRows.filter((r) => r.subAudienceId === group).map((r) => r.id),
  ]
  if (ids.length === 0) return p
  const base = Math.floor(100 / ids.length)
  const extra = 100 - base * ids.length
  const w = new Map(ids.map((id, i) => [id, base + (i < extra ? 1 : 0)]))
  return {
    ...p,
    variants: p.variants.map((v) => (w.has(v.id) ? { ...v, weight: w.get(v.id)! } : v)),
    emptyRows: p.emptyRows.map((r) => (w.has(r.id) ? { ...r, weight: w.get(r.id)! } : r)),
  }
}

export function evenWeightsIn(playId: string, group: string | null) {
  patch(playId, (p) => evenIn(p, group))
}

export function blankSubAudience(n: number): CancelPlay['audience'] {
  return { id: newId('aud'), name: `Sub-audience ${n}`, ruleType: 'TARGETING', match: 'AND', conditions: [], savedAudienceId: null }
}

/** A sub-audience whose rules are not picked yet. It matches nobody. */
export function audienceUnset(a: CancelPlay['audience']): boolean {
  return !a.targetAll && !a.savedAudienceId && !(a.conditions?.length)
}

export type PlayAction = 'show' | 'test' | 'segments'

/**
 * What the play does with its audience: one page, a test of pages, or sub-audiences.
 * Switching keeps the pages it can. One page keeps the first; sub-audiences take the pages into the first one.
 */
export function setAction(playId: string, action: PlayAction) {
  patch(playId, (p) => {
    const pages: PlayVariant[] = []
    for (const v of p.variants) if (!pages.some((x) => x.experienceId === v.experienceId)) pages.push(v)
    const flat = pages.map(({ subAudienceId: _, ...v }) => v)
    if (action === 'show') {
      return { ...p, splitBy: 'percent', subAudiences: [], emptyRows: [], variants: flat.slice(0, 1).map((v) => ({ ...v, weight: 100 })) }
    }
    if (action === 'test') {
      const rows: EmptyRow[] = p.splitBy === 'percent' ? p.emptyRows : []
      const missing = Math.max(0, 2 - flat.length - rows.length)
      const emptyRows = [...rows, ...Array.from({ length: missing }, () => ({ id: newId('row'), subAudienceId: null, weight: 0 }))]
      return evenIn({ ...p, splitBy: 'percent', subAudiences: [], emptyRows, variants: flat }, null)
    }
    if (p.splitBy === 'segments') return p
    const first: SubAudience = { id: newId('sub'), audience: blankSubAudience(1) }
    const next: CancelPlay = {
      ...p,
      splitBy: 'segments',
      subAudiences: [first],
      variants: flat.map((v) => ({ ...v, subAudienceId: first.id })),
      emptyRows: p.emptyRows.map((r) => ({ ...r, subAudienceId: first.id })),
    }
    return evenIn(next, first.id)
  })
}

/** Older callers: percent becomes one page or a test, depending on how many pages there are. */
export function setSplitBy(id: string, splitBy: SplitBy) {
  const play = usePlays.getState().plays.find((p) => p.id === id)
  if (!play) return
  setAction(id, splitBy === 'segments' ? 'segments' : play.variants.length > 1 ? 'test' : 'show')
}

export function addSubAudience(playId: string, audience?: CancelPlay['audience']): string {
  const id = newId('sub')
  patch(playId, (p) => ({ ...p, subAudiences: [...p.subAudiences, { id, audience: audience ?? blankSubAudience(p.subAudiences.length + 1) }] }))
  return id
}

export function setSubAudience(playId: string, subId: string, audience: CancelPlay['audience']) {
  patch(playId, (p) => ({ ...p, subAudiences: p.subAudiences.map((x) => (x.id === subId ? { ...x, audience } : x)) }))
}

/** Its pages leave the play with it. */
export function removeSubAudience(playId: string, subId: string) {
  patch(playId, (p) => ({
    ...p,
    subAudiences: p.subAudiences.filter((x) => x.id !== subId),
    variants: p.variants.filter((v) => v.subAudienceId !== subId),
    emptyRows: p.emptyRows.filter((r) => r.subAudienceId !== subId),
  }))
}

/** One more row in a test: an empty one, or straight to a page. Null group: the play's own test. */
export function addRow(playId: string, group: string | null, experienceId?: string) {
  patch(playId, (p) => {
    if (experienceId) {
      if (p.variants.some((v) => groupOf(p, v) === group && v.experienceId === experienceId)) return p
      return evenIn({ ...p, variants: [...p.variants, variantFor(experienceId, 0, group ?? undefined)] }, group)
    }
    return evenIn({ ...p, emptyRows: [...p.emptyRows, { id: newId('row'), subAudienceId: group, weight: 0 }] }, group)
  })
}

/**
 * Picks the page for a row. An empty row becomes a page with its weight. With no row,
 * it fills the group: the only page of one-page plays, or the fallback.
 * False when that test already has the page.
 */
export function setRowPage(playId: string, group: string | null, rowId: string | null, experienceId: string): boolean {
  const play = usePlays.getState().plays.find((p) => p.id === playId)
  if (!play) return false
  const clash = play.variants.some((v) => groupOf(play, v) === group && v.experienceId === experienceId && v.id !== rowId)
  if (clash) return false
  patch(playId, (p) => {
    const empty = p.emptyRows.find((r) => r.id === rowId)
    if (empty) {
      return {
        ...p,
        emptyRows: p.emptyRows.filter((r) => r.id !== rowId),
        variants: [...p.variants, variantFor(experienceId, empty.weight, group ?? undefined)],
      }
    }
    if (rowId) return { ...p, variants: p.variants.map((v) => (v.id === rowId ? { ...v, experienceId } : v)) }
    const rest = p.variants.filter((v) => groupOf(p, v) !== group)
    return { ...p, variants: [...rest, variantFor(experienceId, 100, group ?? undefined)] }
  })
  return true
}

/** Moves one row's share. With two rows in the test, the other takes the rest. */
export function setRowWeight(playId: string, rowId: string, weight: number) {
  const w = Math.max(0, Math.min(100, Math.round(weight)))
  patch(playId, (p) => {
    const row = p.variants.find((v) => v.id === rowId) ?? p.emptyRows.find((r) => r.id === rowId)
    if (!row) return p
    const group = groupOf(p, row)
    const ids = [...p.variants.filter((v) => groupOf(p, v) === group).map((v) => v.id), ...p.emptyRows.filter((r) => r.subAudienceId === group).map((r) => r.id)]
    const other = ids.length === 2 ? ids.find((id) => id !== rowId) : undefined
    const next = (id: string, cur: number) => (id === rowId ? w : id === other ? 100 - w : cur)
    return {
      ...p,
      variants: p.variants.map((v) => ({ ...v, weight: next(v.id, v.weight) })),
      emptyRows: p.emptyRows.map((r) => ({ ...r, weight: next(r.id, r.weight) })),
    }
  })
}

export function removeRow(playId: string, rowId: string) {
  patch(playId, (p) => {
    const row = p.variants.find((v) => v.id === rowId) ?? p.emptyRows.find((r) => r.id === rowId)
    if (!row) return p
    const group = groupOf(p, row)
    return evenIn({ ...p, variants: p.variants.filter((v) => v.id !== rowId), emptyRows: p.emptyRows.filter((r) => r.id !== rowId) }, group)
  })
}

export function setVariant(playId: string, variantId: string, change: Partial<Omit<PlayVariant, 'id'>>) {
  patch(playId, (p) => ({ ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, ...change } : v)) }))
}

/**
 * False when the experience is already in that play. Split by sub-audience, it fills
 * the fallback first, then joins the last sub-audience's test.
 */
export function addToPlay(playId: string, experienceId: string, at?: number): boolean {
  const play = usePlays.getState().plays.find((p) => p.id === playId)
  if (!play || play.variants.some((v) => v.experienceId === experienceId)) return false
  patch(playId, (p) => {
    if (p.splitBy === 'segments') {
      const hasFallback = p.variants.some((v) => !v.subAudienceId)
      const last = p.subAudiences[p.subAudiences.length - 1]
      const group = hasFallback && last ? last.id : null
      if (group === null && hasFallback) return p
      return evenIn({ ...p, variants: [...p.variants, variantFor(experienceId, group ? 0 : 100, group ?? undefined)] }, group)
    }
    const next = [...p.variants]
    next.splice(at ?? next.length, 0, variantFor(experienceId))
    return evenIn({ ...p, variants: next }, null)
  })
  return true
}

export function removeFromPlay(playId: string, variantId: string) {
  removeRow(playId, variantId)
}

/** Moves a variant to another play. False when the target already has that experience. */
export function moveToPlay(fromPlayId: string, variantId: string, toPlayId: string): boolean {
  if (fromPlayId === toPlayId) return false
  const from = usePlays.getState().plays.find((p) => p.id === fromPlayId)
  const v = from?.variants.find((x) => x.id === variantId)
  if (!v || !addToPlay(toPlayId, v.experienceId)) return false
  removeFromPlay(fromPlayId, variantId)
  return true
}

export function reorderVariant(playId: string, variantId: string, toIndex: number) {
  patch(playId, (p) => {
    const next = [...p.variants]
    const from = next.findIndex((v) => v.id === variantId)
    if (from < 0) return p
    const [moved] = next.splice(from, 1)
    next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved)
    return { ...p, variants: next }
  })
}

/** Points one play's variant at a different experience (after "Make a separate copy"). */
export function swapExperience(playId: string, oldExperienceId: string, newExperienceId: string) {
  patch(playId, (p) => ({
    ...p,
    variants: p.variants.map((v) => (v.experienceId === oldExperienceId ? { ...v, experienceId: newExperienceId } : v)),
  }))
}

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

export function setPlayLive(id: string, live: boolean) {
  patch(id, (p) => ({ ...p, status: live ? 'live' : 'draft', publishedAt: live ? Date.now() : p.publishedAt }))
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
