import { useMemo } from 'react'
import { create } from 'zustand'
import { nameProblem, uniqueName } from '../plays/names'
import { ALL_AUDIENCE, type CancelPlay, type PlayVariant, type SplitBy } from '../plays/types'
import { evenWeights, rankedPlays, savedAudience } from '../plays/usePlays'
import { GROWTH_OBJECTIVES, objectiveLabel, type GrowthObjective } from './model'
import { duplicateGrowthExperience, setGrowthHome, useGrowthExperiences } from './useGrowthExperiences'

const KEY = 'cancel-experience:growth-plays:concierge-v2'
const DAY = 86_400_000

/** v8's play, for in-app offers and pricing tables. Variants point at growth experiences. */
export interface GrowthPlay extends CancelPlay {
  objective: GrowthObjective
}

interface GrowthPlaysState {
  plays: GrowthPlay[]
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
      plays: Array.isArray(parsed.plays) ? parsed.plays : base.plays,
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
    localStorage.setItem(KEY, JSON.stringify({ plays: s.plays, order: s.order, globalControl: s.globalControl }))
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
    ...play(objective, newId('gp'), uniqueName(opts.name ?? 'New play', namesIn(objective)), opts.experienceId ? [v(newId('gv'), opts.experienceId)] : []),
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
    variants: src.variants.map((x) => ({ ...x, id: newId('gv') })),
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

export function updateGrowthPlay(id: string, change: Partial<Omit<GrowthPlay, 'id' | 'objective'>>) {
  patch(id, (p) => ({ ...p, ...change }))
}

export function setGrowthSplitBy(id: string, splitBy: SplitBy) {
  patch(id, (p) => ({ ...p, splitBy, variants: splitBy === 'percent' ? evenWeights(p.variants) : p.variants }))
}

export function setGrowthVariant(playId: string, variantId: string, change: Partial<Omit<PlayVariant, 'id'>>) {
  patch(playId, (p) => ({ ...p, variants: p.variants.map((x) => (x.id === variantId ? { ...x, ...change } : x)) }))
}

/** False when the experience is already in that play. */
export function addToGrowthPlay(playId: string, experienceId: string): boolean {
  const p = growthPlay(playId)
  if (!p || p.variants.some((x) => x.experienceId === experienceId)) return false
  patch(playId, (x) => {
    const next = [...x.variants, v(newId('gv'), experienceId)]
    return { ...x, variants: x.splitBy === 'percent' ? evenWeights(next) : next }
  })
  return true
}

export function removeFromGrowthPlay(playId: string, variantId: string) {
  const p = growthPlay(playId)
  const gone = p?.variants.find((x) => x.id === variantId)
  if (!p || !gone) return
  patch(playId, (x) => {
    const next = x.variants.filter((y) => y.id !== variantId)
    return { ...x, variants: x.splitBy === 'percent' ? evenWeights(next) : next }
  })
  rehome([gone.experienceId], p.objective)
}

/** An experience was deleted: take it out of every play. */
export function dropGrowthExperience(experienceId: string) {
  setPlays(
    useGrowthPlays.getState().plays.map((p) => {
      if (!p.variants.some((x) => x.experienceId === experienceId)) return p
      const next = p.variants.filter((x) => x.experienceId !== experienceId)
      return { ...p, variants: p.splitBy === 'percent' ? evenWeights(next) : next, updatedAt: Date.now() }
    }),
  )
}

export function setGrowthPlayLive(id: string, live: boolean) {
  patch(id, (p) => ({ ...p, status: live ? 'live' : 'draft', publishedAt: live ? Date.now() : p.publishedAt }))
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
