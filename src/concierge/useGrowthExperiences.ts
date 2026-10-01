import { create } from 'zustand'
import { nameProblem, uniqueName } from '../plays/names'
import { TYPE_LABEL, newId, type GrowthExperience, type GrowthObjective, type GrowthType } from './model'
import type { GrowthPlay } from './useGrowthPlays'

const KEY = 'cancel-experience:experiences:concierge-v2'
const DAY = 86_400_000

const SEEDS: GrowthExperience[] = [
  {
    id: 'gx_trial',
    name: 'Trial discount',
    objective: 'acquisition',
    type: 'in_app_offer',
    refId: 'off_trial7',
    trigger: { kind: 'url', value: '/billing' },
    updatedAt: Date.now() - 40 * DAY,
  },
  {
    id: 'gx_trialext',
    name: 'Trial extension',
    objective: 'acquisition',
    type: 'in_app_offer',
    refId: 'off_trialext',
    trigger: { kind: 'event', value: 'trial_ending' },
    updatedAt: Date.now() - 30 * DAY,
  },
  {
    id: 'gx_signup',
    name: 'Sign-up pricing page',
    objective: 'acquisition',
    type: 'pricing_table',
    refId: 'pt_signup',
    trigger: { kind: 'url', value: '/pricing' },
    updatedAt: Date.now() - 50 * DAY,
  },
  {
    id: 'gx_signup_banner',
    name: 'Pricing page banner',
    objective: 'acquisition',
    type: 'in_app_offer',
    refId: null,
    trigger: { kind: 'url', value: '/pricing' },
    updatedAt: Date.now() - 2 * DAY,
  },
  {
    id: 'gx_annual',
    name: 'Monthly to annual',
    objective: 'expansion',
    type: 'in_app_offer',
    refId: 'off_annual',
    trigger: { kind: 'any_page' },
    updatedAt: Date.now() - 14 * DAY,
  },
  {
    id: 'gx_scale',
    name: 'Upgrade to Scale',
    objective: 'expansion',
    type: 'pricing_table',
    refId: 'pt_upgrade',
    trigger: { kind: 'event', value: 'seat_limit_reached' },
    updatedAt: Date.now() - 12 * DAY,
  },
  {
    id: 'gx_addon',
    name: 'Reports add-on',
    objective: 'expansion',
    type: 'in_app_offer',
    refId: 'off_addon',
    trigger: { kind: 'url', value: '/reports' },
    updatedAt: Date.now() - 5 * DAY,
  },
]

interface ExperiencesState {
  items: GrowthExperience[]
}

function load(): ExperiencesState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { items: SEEDS }
    const parsed = JSON.parse(raw) as { items?: GrowthExperience[] }
    return { items: Array.isArray(parsed.items) ? parsed.items : SEEDS }
  } catch {
    return { items: SEEDS }
  }
}

export const useGrowthExperiences = create<ExperiencesState>(load)

useGrowthExperiences.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ items: s.items }))
  } catch {
    /* storage full or blocked */
  }
})

/** A tab shows an experience when one of its plays uses it. One in no play shows in its home tab. */
export function visibleIn(x: GrowthExperience, objective: GrowthObjective, plays: GrowthPlay[]): boolean {
  const using = plays.filter((p) => p.variants.some((v) => v.experienceId === x.id))
  return using.length ? using.some((p) => p.objective === objective) : x.objective === objective
}

export function experiencesFor(items: GrowthExperience[], plays: GrowthPlay[], objective: GrowthObjective): GrowthExperience[] {
  return items.filter((i) => visibleIn(i, objective, plays)).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function growthExperience(id: string): GrowthExperience | undefined {
  return useGrowthExperiences.getState().items.find((i) => i.id === id)
}

/** Names are unique across both tabs, since an experience can show in either. */
function namesIn(exceptId?: string): string[] {
  return useGrowthExperiences
    .getState()
    .items.filter((i) => i.id !== exceptId)
    .map((i) => i.name)
}

export function addGrowthExperience(objective: GrowthObjective, type: GrowthType, opts: { name?: string; refId?: string | null } = {}): GrowthExperience {
  const item: GrowthExperience = {
    id: newId('gx'),
    name: uniqueName(opts.name ?? `New ${TYPE_LABEL[type].toLowerCase()}`, namesIn()),
    objective,
    type,
    refId: opts.refId ?? null,
    trigger: { kind: 'any_page' },
    updatedAt: Date.now(),
  }
  useGrowthExperiences.setState((s) => ({ items: [item, ...s.items] }))
  return item
}

export function updateGrowthExperience(id: string, patch: Partial<Omit<GrowthExperience, 'id' | 'objective'>>) {
  useGrowthExperiences.setState((s) => ({
    items: s.items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)),
  }))
}

/** Null once saved, otherwise what's wrong with the name. */
export function renameGrowthExperience(id: string, name: string): string | null {
  const x = growthExperience(id)
  if (!x) return null
  const problem = nameProblem(name, namesIn(id), 'experience')
  if (problem) return problem
  updateGrowthExperience(id, { name: name.trim().replace(/\s+/g, ' ') })
  return null
}

/** A separate copy. `objective` sets the copy's home tab; it defaults to the original's. */
export function duplicateGrowthExperience(id: string, objective?: GrowthObjective, name?: string): GrowthExperience | null {
  const x = growthExperience(id)
  if (!x) return null
  const copy: GrowthExperience = {
    ...x,
    id: newId('gx'),
    name: uniqueName(name ?? `${x.name} copy`, namesIn()),
    objective: objective ?? x.objective,
    updatedAt: Date.now(),
  }
  useGrowthExperiences.setState((s) => ({ items: [copy, ...s.items] }))
  return copy
}

/** The tab it shows in while no play uses it. Not an edit, so it keeps its updatedAt. */
export function setGrowthHome(id: string, objective: GrowthObjective) {
  useGrowthExperiences.setState((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, objective } : i)) }))
}

export function removeGrowthExperience(id: string) {
  useGrowthExperiences.setState((s) => ({ items: s.items.filter((i) => i.id !== id) }))
}
