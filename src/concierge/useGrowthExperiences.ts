import { create } from 'zustand'
import { newId, type GrowthExperience, type Objective } from './model'

const KEY = 'cancel-experience:experiences:concierge'
const DAY = 86_400_000

const SEEDS: GrowthExperience[] = [
  {
    id: 'gx_trial',
    name: 'Trial to paid conversion',
    objective: 'acquisition',
    type: 'in_app_offer',
    status: 'live',
    audienceId: 'in_trial',
    trigger: { kind: 'url', value: '/billing' },
    variants: [{ id: 'v1', refId: 'off_trial7', percent: 100 }],
    control: 10,
    priority: 1,
    updatedAt: Date.now() - 40 * DAY,
  },
  {
    id: 'gx_signup',
    name: 'Sign-up pricing page',
    objective: 'acquisition',
    type: 'pricing_table',
    status: 'live',
    audienceId: 'all',
    trigger: { kind: 'url', value: '/pricing' },
    variants: [{ id: 'v1', refId: 'pt_signup', percent: 100 }],
    control: 0,
    priority: 1,
    updatedAt: Date.now() - 50 * DAY,
  },
  {
    id: 'gx_annual',
    name: 'Monthly to annual',
    objective: 'expansion',
    type: 'in_app_offer',
    status: 'live',
    audienceId: 'all_paying',
    trigger: { kind: 'any_page' },
    variants: [{ id: 'v1', refId: 'off_annual', percent: 100 }],
    control: 10,
    priority: 1,
    updatedAt: Date.now() - 14 * DAY,
  },
  {
    id: 'gx_scale',
    name: 'Upgrade to Scale',
    objective: 'expansion',
    type: 'pricing_table',
    status: 'draft',
    audienceId: 'high_value',
    trigger: { kind: 'event', value: 'seat_limit_reached' },
    variants: [{ id: 'v1', refId: 'pt_upgrade', percent: 100 }],
    control: 0,
    priority: 1,
    updatedAt: Date.now() - 12 * DAY,
  },
]

interface ExperiencesState {
  items: GrowthExperience[]
  activeId: string | null
  add: (x: Omit<GrowthExperience, 'id' | 'updatedAt' | 'priority'>) => GrowthExperience
  update: (id: string, patch: Partial<GrowthExperience>) => void
  open: (id: string | null) => void
  /** Move one experience to a 1-based position among its objective and type. */
  moveTo: (id: string, position: number) => void
}

function load(): Pick<ExperiencesState, 'items' | 'activeId'> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { items: SEEDS, activeId: null }
    const parsed = JSON.parse(raw) as { items?: GrowthExperience[]; activeId?: string | null }
    return { items: Array.isArray(parsed.items) ? parsed.items : SEEDS, activeId: parsed.activeId ?? null }
  } catch {
    return { items: SEEDS, activeId: null }
  }
}

export const useGrowthExperiences = create<ExperiencesState>((set, get) => ({
  ...load(),
  add: (x) => {
    const peers = get().items.filter((i) => i.objective === x.objective && i.type === x.type)
    const item: GrowthExperience = { ...x, id: newId('gx'), priority: peers.length + 1, updatedAt: Date.now() }
    set((s) => ({ items: [item, ...s.items] }))
    return item
  },
  update: (id, patch) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)) })),
  open: (activeId) => set({ activeId }),
  moveTo: (id, position) => {
    const item = get().items.find((i) => i.id === id)
    if (!item) return
    const peers = get()
      .items.filter((i) => i.objective === item.objective && i.type === item.type && i.id !== id)
      .sort((a, b) => a.priority - b.priority)
    const at = Math.max(0, Math.min(peers.length, position - 1))
    peers.splice(at, 0, item)
    const rank = new Map(peers.map((p, i) => [p.id, i + 1]))
    set((s) => ({ items: s.items.map((i) => (rank.has(i.id) ? { ...i, priority: rank.get(i.id)! } : i)) }))
  },
}))

useGrowthExperiences.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ items: s.items, activeId: s.activeId }))
  } catch {
    /* storage full or blocked */
  }
})

export function experiencesFor(items: GrowthExperience[], objective: Objective) {
  return items.filter((i) => i.objective === objective && i.status !== 'archived')
}
