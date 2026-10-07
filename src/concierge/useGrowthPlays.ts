import { useMemo } from 'react'
import { create } from 'zustand'
import { nameProblem, uniqueName } from '../plays/names'
import { copySubAudiences, evenIn, groupOf, makePlayOps, normalizePlay, variantFor } from '../plays/playOps'
import { ALL_AUDIENCE, type CancelPlay, type PlayVariant } from '../plays/types'
import { rankedPlays, savedAudience } from '../plays/usePlays'
import { GROWTH_OBJECTIVES, objectiveLabel, type GrowthObjective } from './model'
import { duplicateGrowthExperience, setGrowthHome, useGrowthExperiences } from './useGrowthExperiences'

const KEY = 'cancel-experience:growth-plays:concierge-v2'
const DAY = 86_400_000

/** Retention's play, for in-app offers and pricing tables. Variants point at growth experiences. */
export interface GrowthPlay extends CancelPlay {
  objective: GrowthObjective
}

interface GrowthPlaysState {
  plays: GrowthPlay[]
  /** Out of the order, newest first. */
  archived: GrowthPlay[]
  /** Play ids, first wins, per objective. */
  order: Record<GrowthObjective, string[]>
  /** Share of each objective's subscribers held back from every play, 0 to 50. */
  globalControl: Record<GrowthObjective, number>
}

let n = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${n++}`

function play(objective: GrowthObjective, id: string, name: string, variants: PlayVariant[], extra: Partial<GrowthPlay> = {}): GrowthPlay {
  const at = Date.now() - 20 * DAY
  return {
    id,
    objective,
    name,
    audience: ALL_AUDIENCE,
    control: 0,
    splitBy: 'percent',
    variants,
    subAudiences: [],
    emptyRows: [],
    status: 'draft',
    language: 'en',
    saveWindowDays: null,
    createdAt: at,
    updatedAt: at,
    ...extra,
  }
}

const v = (id: string, experienceId: string, weight = 100): PlayVariant => ({ id, experienceId, weight })

function seed(): GrowthPlaysState {
  const plays: GrowthPlay[] = [
    play('acquisition', 'gp_trial', 'Trial users', [v('gv_t1', 'gx_trial', 50), v('gv_t2', 'gx_trialext', 50)], {
      audience: savedAudience('in_trial'),
      control: 10,
      status: 'live',
      publishedAt: Date.now() - 18 * DAY,
    }),
    play('acquisition', 'gp_pricing', 'Pricing page visitors', [v('gv_p1', 'gx_signup')], { status: 'live', publishedAt: Date.now() - 30 * DAY }),
    play('expansion', 'gp_monthly', 'Monthly payers', [v('gv_m1', 'gx_annual')], {
      audience: savedAudience('all_paying'),
      control: 10,
      status: 'live',
      publishedAt: Date.now() - 10 * DAY,
    }),
    play('expansion', 'gp_heavy', 'Heavy users', [v('gv_h1', 'gx_scale', 50), v('gv_h2', 'gx_signup', 50)], { audience: savedAudience('high_value') }),
  ]
  return {
    plays,
    archived: [],
    order: { acquisition: ['gp_trial', 'gp_pricing'], expansion: ['gp_heavy', 'gp_monthly'] },
    globalControl: { acquisition: 0, expansion: 0 },
  }
}

function load(): GrowthPlaysState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    const parsed = JSON.parse(raw) as Partial<GrowthPlaysState>
    const base = seed()
    return {
      plays: Array.isArray(parsed.plays) ? parsed.plays.map(normalizePlay) : base.plays,
      archived: Array.isArray(parsed.archived) ? parsed.archived.map(normalizePlay) : [],
      order: { ...base.order, ...parsed.order },
      globalControl: { ...base.globalControl, ...parsed.globalControl },
    }
  } catch {
    return seed()
  }
}

export const useGrowthPlays = create<GrowthPlaysState>(load)

useGrowthPlays.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ plays: s.plays, archived: s.archived, order: s.order, globalControl: s.globalControl }))
  } catch {
    /* storage full or blocked */
  }
})

function setPlays(plays: GrowthPlay[]) {
  useGrowthPlays.setState({ plays })
}

function patch(id: string, change: (p: GrowthPlay) => GrowthPlay) {
  setPlays(useGrowthPlays.getState().plays.map((p) => (p.id === id ? { ...change(p), updatedAt: Date.now() } : p)))
}

/** Retention's play operations, bound to the Growth plays. Experiences that leave their last play go home to that play's tab. */
export const growthPlayOps = makePlayOps({
  get: growthPlay,
  patch: (id, change) => patch(id, (p) => change(p) as GrowthPlay),
  left: (playId, experienceIds) => {
    const p = growthPlay(playId)
    if (p) rehome(experienceIds, p.objective)
  },
})

export function growthPlay(id: string): GrowthPlay | undefined {
  return useGrowthPlays.getState().plays.find((p) => p.id === id)
}

function namesIn(objective: GrowthObjective, exceptId?: string): string[] {
  return useGrowthPlays
    .getState()
    .plays.filter((p) => p.objective === objective && p.id !== exceptId)
    .map((p) => p.name)
}

export function createGrowthPlay(objective: GrowthObjective, opts: { name?: string; experienceId?: string } = {}): string {
  const now = Date.now()
  const p: GrowthPlay = {
    ...play(objective, newId('gp'), uniqueName(opts.name ?? 'New play', namesIn(objective)), opts.experienceId ? [variantFor(opts.experienceId)] : []),
    createdAt: now,
    updatedAt: now,
  }
  useGrowthPlays.setState((s) => ({
    plays: [...s.plays, p],
    order: { ...s.order, [objective]: [...s.order[objective], p.id] },
  }))
  return p.id
}

export function renameGrowthPlay(id: string, name: string): string | null {
  const p = growthPlay(id)
  if (!p) return null
  const problem = nameProblem(name, namesIn(p.objective, id), 'play')
  if (problem) return problem
  patch(id, (x) => ({ ...x, name: name.trim().replace(/\s+/g, ' ') }))
  return null
}

export function duplicateGrowthPlay(id: string): string | null {
  const src = growthPlay(id)
  if (!src) return null
  const now = Date.now()
  const copy: GrowthPlay = {
    ...src,
    id: newId('gp'),
    name: uniqueName(`${src.name} copy`, namesIn(src.objective)),
    ...copySubAudiences(src),
    status: 'draft',
    publishedAt: undefined,
    createdAt: now,
    updatedAt: now,
  }
  useGrowthPlays.setState((s) => {
    const order = s.order[src.objective]
    const at = order.indexOf(id)
    return {
      plays: [...s.plays, copy],
      order: { ...s.order, [src.objective]: at < 0 ? [...order, copy.id] : [...order.slice(0, at + 1), copy.id, ...order.slice(at + 1)] },
    }
  })
  return copy.id
}

/** An experience that just left its last play goes home to that play's tab. */
function rehome(experienceIds: string[], objective: GrowthObjective) {
  const plays = useGrowthPlays.getState().plays
  for (const id of experienceIds) if (!growthPlaysUsing(id, plays).length) setGrowthHome(id, objective)
}

export function deleteGrowthPlay(id: string) {
  const p = growthPlay(id)
  if (!p) return
  useGrowthPlays.setState((s) => ({
    plays: s.plays.filter((x) => x.id !== id),
    order: { ...s.order, [p.objective]: s.order[p.objective].filter((x) => x !== id) },
  }))
  rehome(p.variants.map((x) => x.experienceId), p.objective)
}

/** Out of the order, back to draft. Its experiences stay where they are. */
export function archiveGrowthPlay(id: string) {
  const p = growthPlay(id)
  if (!p) return
  useGrowthPlays.setState((s) => ({
    plays: s.plays.filter((x) => x.id !== id),
    archived: [{ ...p, status: 'draft', archivedAt: Date.now() }, ...s.archived],
    order: { ...s.order, [p.objective]: s.order[p.objective].filter((x) => x !== id) },
  }))
  rehome(p.variants.map((x) => x.experienceId), p.objective)
}

/** Comes back as a draft at the bottom of its tab's order. Experiences deleted since then drop out of it. */
export function unarchiveGrowthPlay(id: string) {
  const s = useGrowthPlays.getState()
  const p = s.archived.find((x) => x.id === id)
  if (!p) return
  const keep = new Set(useGrowthExperiences.getState().items.map((x) => x.id))
  const back: GrowthPlay = {
    ...p,
    name: uniqueName(p.name, namesIn(p.objective)),
    variants: p.variants.filter((x) => keep.has(x.experienceId)),
    archivedAt: undefined,
    updatedAt: Date.now(),
  }
  useGrowthPlays.setState({
    plays: [...s.plays, back],
    archived: s.archived.filter((x) => x.id !== id),
    order: { ...s.order, [p.objective]: [...s.order[p.objective].filter((x) => x !== id), id] },
  })
}

export function deleteArchivedGrowthPlay(id: string) {
  useGrowthPlays.setState((s) => ({ archived: s.archived.filter((x) => x.id !== id) }))
}

export const addToGrowthPlay = (playId: string, experienceId: string) => growthPlayOps.addToPlay(playId, experienceId)
export const setGrowthPlayLive = growthPlayOps.setPlayLive

/** An experience was deleted: take it out of every play. */
export function dropGrowthExperience(experienceId: string) {
  setPlays(
    useGrowthPlays.getState().plays.map((p) => {
      if (!p.variants.some((x) => x.experienceId === experienceId)) return p
      const groups = new Set(p.variants.filter((x) => x.experienceId === experienceId).map((x) => groupOf(p, x)))
      let next: GrowthPlay = { ...p, variants: p.variants.filter((x) => x.experienceId !== experienceId), updatedAt: Date.now() }
      for (const g of groups) next = evenIn(next, g)
      return next
    }),
  )
}

export function setGrowthOrder(objective: GrowthObjective, ids: string[]) {
  useGrowthPlays.setState((s) => ({ order: { ...s.order, [objective]: ids } }))
}

export function setGrowthGlobalControl(objective: GrowthObjective, value: number) {
  useGrowthPlays.setState((s) => ({ globalControl: { ...s.globalControl, [objective]: Math.max(0, Math.min(50, value)) } }))
}

export function growthPlaysUsing(experienceId: string, plays = useGrowthPlays.getState().plays): GrowthPlay[] {
  return plays.filter((p) => p.variants.some((x) => x.experienceId === experienceId))
}

/** The tabs whose plays use this experience. */
export function experienceTabs(experienceId: string, plays = useGrowthPlays.getState().plays): GrowthObjective[] {
  const using = growthPlaysUsing(experienceId, plays)
  return GROWTH_OBJECTIVES.filter((o) => using.some((p) => p.objective === o))
}

/** Used by plays in both tabs. */
export function isShared(experienceId: string, plays = useGrowthPlays.getState().plays): boolean {
  return experienceTabs(experienceId, plays).length > 1
}

/** A copy for `objective` alone: that tab's plays switch to the copy, the other tab keeps the original. */
export function splitGrowthExperience(experienceId: string, objective: GrowthObjective): string | null {
  const src = useGrowthExperiences.getState().items.find((x) => x.id === experienceId)
  const copy = src ? duplicateGrowthExperience(experienceId, objective, `${src.name} for ${objectiveLabel(objective)}`) : null
  if (!copy) return null
  setPlays(
    useGrowthPlays.getState().plays.map((p) =>
      p.objective === objective && p.variants.some((x) => x.experienceId === experienceId)
        ? { ...p, variants: p.variants.map((x) => (x.experienceId === experienceId ? { ...x, experienceId: copy.id } : x)), updatedAt: Date.now() }
        : p,
    ),
  )
  return copy.id
}

/** Every experience that shows this Library offer or pricing table, with the tabs it's in. */
export function usedIn(refId: string): string[] {
  const plays = useGrowthPlays.getState().plays
  return useGrowthExperiences
    .getState()
    .items.filter((x) => x.refId === refId)
    .map((x) => {
      const tabs = experienceTabs(x.id, plays)
      return `${x.name} (${(tabs.length ? tabs : [x.objective]).map(objectiveLabel).join(', ')})`
    })
}

/** An experience is live while a live play shows it. */
export function growthExperienceLive(experienceId: string, plays = useGrowthPlays.getState().plays): boolean {
  return growthPlaysUsing(experienceId, plays).some((p) => p.status === 'live')
}

export function rankedGrowthPlays(objective: GrowthObjective, s = useGrowthPlays.getState()): GrowthPlay[] {
  return rankedPlays(
    s.plays.filter((p) => p.objective === objective),
    s.order[objective],
  ) as GrowthPlay[]
}

export function useRankedGrowthPlays(objective: GrowthObjective): GrowthPlay[] {
  const plays = useGrowthPlays((s) => s.plays)
  const order = useGrowthPlays((s) => s.order)
  return useMemo(() => rankedPlays(plays.filter((p) => p.objective === objective), order[objective]) as GrowthPlay[], [plays, order, objective])
}
