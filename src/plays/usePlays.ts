import { useMemo } from 'react'
import { create } from 'zustand'
import { AUDIENCE_LIBRARY, type Audience } from '../types/orchestration'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { nameProblem, uniqueName } from './names'
import { ALL_AUDIENCE, type CancelPlay, type PlayVariant, type SplitBy } from './types'

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

function read(): CancelPlay[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number; plays?: CancelPlay[] }
    return parsed.v === 1 && Array.isArray(parsed.plays) ? parsed.plays : null
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
    status: 'draft',
    language: 'en',
    saveWindowDays: null,
    createdAt: now,
    updatedAt: now,
  }
}

function variantFor(experienceId: string, weight = 100): PlayVariant {
  return { id: newId('var'), experienceId, weight }
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
    variants: src.variants.map((v) => ({ ...v, id: newId('var') })),
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

export function updatePlay(id: string, change: Partial<Omit<CancelPlay, 'id'>>) {
  patch(id, (p) => ({ ...p, ...change }))
}

export function setSplitBy(id: string, splitBy: SplitBy) {
  patch(id, (p) => ({ ...p, splitBy, variants: splitBy === 'percent' ? evenWeights(p.variants) : p.variants }))
}

export function setVariant(playId: string, variantId: string, change: Partial<Omit<PlayVariant, 'id'>>) {
  patch(playId, (p) => ({ ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, ...change } : v)) }))
}

/** False when the experience is already in that play. */
export function addToPlay(playId: string, experienceId: string, at?: number): boolean {
  const play = usePlays.getState().plays.find((p) => p.id === playId)
  if (!play || play.variants.some((v) => v.experienceId === experienceId)) return false
  patch(playId, (p) => {
    const next = [...p.variants]
    next.splice(at ?? next.length, 0, variantFor(experienceId))
    return { ...p, variants: p.splitBy === 'percent' ? evenWeights(next) : next }
  })
  return true
}

export function removeFromPlay(playId: string, variantId: string) {
  patch(playId, (p) => {
    const next = p.variants.filter((v) => v.id !== variantId)
    return { ...p, variants: p.splitBy === 'percent' ? evenWeights(next) : next }
  })
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
      const next = p.variants.filter((v) => v.experienceId !== experienceId)
      return { ...p, variants: p.splitBy === 'percent' ? evenWeights(next) : next, updatedAt: Date.now() }
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
