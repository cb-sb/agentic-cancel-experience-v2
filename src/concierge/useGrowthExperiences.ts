import { create } from 'zustand'
import { nameProblem, uniqueName } from '../plays/names'
import { TYPE_LABEL, newId, type GrowthExperience, type GrowthObjective, type GrowthType } from './model'

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

export function experiencesFor(items: GrowthExperience[], objective: GrowthObjective): GrowthExperience[] {
  return items.filter((i) => i.objective === objective).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Every experience that shows this Library offer or pricing table, by name. */
export function usedIn(refId: string): string[] {
  return useGrowthExperiences
    .getState()
    .items.filter((x) => x.refId === refId)
    .map((x) => x.name)
}

export function growthExperience(id: string): GrowthExperience | undefined {
  return useGrowthExperiences.getState().items.find((i) => i.id === id)
}

function namesIn(objective: GrowthObjective, exceptId?: string): string[] {
  return useGrowthExperiences
    .getState()
    .items.filter((i) => i.objective === objective && i.id !== exceptId)
    .map((i) => i.name)
}

export function addGrowthExperience(objective: GrowthObjective, type: GrowthType, opts: { name?: string; refId?: string | null } = {}): GrowthExperience {
  const item: GrowthExperience = {
    id: newId('gx'),
    name: uniqueName(opts.name ?? `New ${TYPE_LABEL[type].toLowerCase()}`, namesIn(objective)),
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
  const problem = nameProblem(name, namesIn(x.objective, id), 'experience')
  if (problem) return problem
  updateGrowthExperience(id, { name: name.trim().replace(/\s+/g, ' ') })
  return null
}

export function duplicateGrowthExperience(id: string): GrowthExperience | null {
  const x = growthExperience(id)
  if (!x) return null
  const copy: GrowthExperience = { ...x, id: newId('gx'), name: uniqueName(`${x.name} copy`, namesIn(x.objective)), updatedAt: Date.now() }
  useGrowthExperiences.setState((s) => ({ items: [copy, ...s.items] }))
  return copy
}

export function removeGrowthExperience(id: string) {
  useGrowthExperiences.setState((s) => ({ items: s.items.filter((i) => i.id !== id) }))
}
