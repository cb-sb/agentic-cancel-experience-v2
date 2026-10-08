import { create } from 'zustand'
import { setGrowthView } from '../concierge/objective/useGrowthUi'
import { V10 } from '../layout/layoutMode'
import type { GrowthObjective, GrowthType } from '../concierge/model'
import { addGrowthExperience } from '../concierge/useGrowthExperiences'
import { addToGrowthPlay, createGrowthPlay, useGrowthPlays } from '../concierge/useGrowthPlays'
import { createExperience, openConfigure, openExperience } from '../plays/navigate'
import { createPlay, playsUsing } from '../plays/usePlays'
import type { NavLeafId } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { createAudience } from './useAudiences'

const KEY = 'cancel-experience:v10'
const MAX_RECENT = 8

export type Tag = 'acquisition' | 'expansion' | 'retention'
export type V10Tab = 'plays' | 'experiences' | 'audiences'
export type V10Kind = 'play' | 'experience' | 'audience'
export type V10Source = 'growth' | 'retention' | 'audience'
export type V10Scope = 'portfolio' | 'acquisition' | 'expansion' | 'retention'
export type PlayMode = 'list' | 'priority' | 'canvas'
export type ExperienceSlice = 'all' | 'in_app_offer' | 'pricing_table' | 'cancel_page'

export interface V10Ref {
  kind: V10Kind
  source: V10Source
  id: string
  objective?: GrowthObjective
}

export interface Filters {
  query: string
  tags: Tag[]
  /** Empty means every status. Live and Draft can both be on. */
  status: ('live' | 'draft')[]
  group: 'none' | 'tag' | 'status' | 'type'
  sort: 'name' | 'recent'
  /** Permanent system-view scope. Custom views persist their own scope. */
  scope: V10Scope
  /** Experiences only. Other tabs keep `all`. */
  slice: ExperienceSlice
  /** Reserved for merchant column choices as tables gain more fields. */
  columns: string[]
}

export interface SavedView extends Filters {
  id: string
  name: string
  tab: V10Tab
}

interface V10State {
  open: V10Ref | null
  pins: V10Ref[]
  recent: V10Ref[]
  filters: Record<V10Tab, Filters>
  saved: SavedView[]
  /** The added view on screen. Null shows the default view for the route. */
  active: string | null
  /** Extra tags a merchant added. Absent means the item keeps the tag it already has. */
  tags: Record<string, Tag[]>
  close: () => void
  togglePin: (ref: V10Ref) => void
  setFilters: (tab: V10Tab, patch: Partial<Filters>) => void
  /** List, priority, or canvas for one objective. Saved views stay on the table. */
  playMode: PlayMode
  setPlayMode: (mode: PlayMode) => void
  selectSystemView: (tab: V10Tab, scope: V10Scope, slice?: ExperienceSlice) => void
  selectView: (tab: V10Tab, id: string | null) => void
  addView: (tab: V10Tab, name?: string, from?: Filters) => string
  updateView: (id: string, patch: Partial<Filters> & { name?: string }) => void
  deleteView: (id: string) => void
  setTags: (id: string, tags: Tag[]) => void
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  tags: [],
  status: [],
  group: 'none',
  sort: 'recent',
  scope: 'portfolio',
  slice: 'all',
  columns: [],
}

const TAB_ROUTE: Record<V10Tab, NavLeafId> = {
  plays: 'work.plays',
  experiences: 'work.experiences',
  audiences: 'work.audiences',
}

const ROUTE_TAB: Partial<Record<NavLeafId, V10Tab>> = {
  'work.plays': 'plays',
  'work.experiences': 'experiences',
  'work.audiences': 'audiences',
}

export interface V10Location {
  active: string | null
  scope: V10Scope
  slice: ExperienceSlice
  mode: PlayMode
}

function modeOf(value: string | null): PlayMode | undefined {
  return value === 'list' || value === 'priority' || value === 'canvas' ? value : undefined
}

function locationFromHash(hash: string): Partial<V10Location> {
  const query = hash.split('?')[1]
  if (!query) return {}
  const params = new URLSearchParams(query)
  const scope = params.get('scope')
  const slice = params.get('slice')
  const mode = modeOf(params.get('mode'))
  return {
    active: params.get('view'),
    ...(scope === 'portfolio' || scope === 'acquisition' || scope === 'expansion' || scope === 'retention' ? { scope } : {}),
    ...(slice === 'all' || slice === 'in_app_offer' || slice === 'pricing_table' || slice === 'cancel_page' ? { slice } : {}),
    ...(mode ? { mode } : {}),
  }
}

export function tabOf(ref: V10Ref): V10Tab {
  if (ref.kind === 'play') return 'plays'
  if (ref.kind === 'experience') return 'experiences'
  return 'audiences'
}

function same(a: V10Ref, b: V10Ref) {
  return a.kind === b.kind && a.id === b.id
}

function statusesOf(value: unknown): Filters['status'] {
  const raw = Array.isArray(value) ? value : value === 'live' || value === 'draft' ? [value] : []
  return raw.filter((item): item is 'live' | 'draft' => item === 'live' || item === 'draft')
}

function normalizeFilters(value?: Partial<Filters>): Filters {
  return {
    ...EMPTY_FILTERS,
    ...value,
    tags: Array.isArray(value?.tags) ? value.tags : [],
    columns: Array.isArray(value?.columns) ? value.columns : [],
    status: statusesOf(value?.status),
    scope: value?.scope ?? 'portfolio',
    slice: value?.slice ?? 'all',
  }
}

interface SavedShape {
  pins?: V10Ref[]
  recent?: V10Ref[]
  filters?: Record<V10Tab, Filters>
  saved?: SavedView[]
  active?: string | null
  tags?: Record<string, Tag[]>
}

const TAB_NAME: Record<V10Tab, string> = { plays: 'Plays', experiences: 'Experiences', audiences: 'Audiences' }

function load(): Pick<V10State, 'pins' | 'recent' | 'filters' | 'saved' | 'active' | 'tags'> {
  const empty = {
    pins: [],
    recent: [],
    filters: {
      plays: normalizeFilters(),
      experiences: normalizeFilters(),
      audiences: normalizeFilters(),
    },
    saved: [],
    active: null,
    tags: {},
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const location = locationFromHash(window.location.hash)
      const route = window.location.hash.split('?')[0].replace(/^#\/?/, '').replaceAll('/', '.') as NavLeafId
      const tab = ROUTE_TAB[route]
      if (tab) empty.filters[tab] = normalizeFilters({ scope: location.scope, slice: location.slice })
      return empty
    }
    const parsed = JSON.parse(raw) as SavedShape
    const filters = {
      plays: normalizeFilters(parsed.filters?.plays),
      experiences: normalizeFilters(parsed.filters?.experiences),
      audiences: normalizeFilters(parsed.filters?.audiences),
    }
    const location = typeof window === 'undefined' ? {} : locationFromHash(window.location.hash)
    const route = typeof window === 'undefined' ? null : (window.location.hash.split('?')[0].replace(/^#\/?/, '').replaceAll('/', '.') as NavLeafId)
    const tab = route ? ROUTE_TAB[route] : undefined
    if (tab && !location.active) {
      filters[tab] = normalizeFilters({ ...filters[tab], scope: location.scope, slice: location.slice })
    }
    return {
      pins: Array.isArray(parsed.pins) ? parsed.pins : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      filters,
      saved: Array.isArray(parsed.saved) ? parsed.saved.map((view) => ({ ...normalizeFilters(view), ...view })) : [],
      active: location.active ?? (typeof parsed.active === 'string' ? parsed.active : null),
      tags: parsed.tags ?? {},
    }
  } catch {
    return empty
  }
}

export const useV10 = create<V10State>((set, get) => ({
  open: null,
  playMode: typeof window === 'undefined' ? 'list' : (locationFromHash(window.location.hash).mode ?? 'list'),
  ...load(),
  close: () => set({ open: null }),
  setPlayMode: (playMode) => set({ playMode, active: playMode === 'list' ? get().active : null }),
  togglePin: (ref) =>
    set((state) => ({
      pins: state.pins.some((pin) => same(pin, ref)) ? state.pins.filter((pin) => !same(pin, ref)) : [ref, ...state.pins],
    })),
  setFilters: (tab, patch) => set((state) => ({ filters: { ...state.filters, [tab]: { ...state.filters[tab], ...patch } } })),
  selectSystemView: (tab, scope, slice = 'all') => {
    set((state) => ({
      open: null,
      active: null,
      playMode: 'list',
      filters: {
        ...state.filters,
        [tab]: {
          ...normalizeFilters(),
          scope,
          slice: tab === 'experiences' ? slice : 'all',
        },
      },
    }))
    if (useGrowthShell.getState().route !== TAB_ROUTE[tab]) useGrowthShell.getState().go(TAB_ROUTE[tab])
  },
  selectView: (tab, id) => {
    set({ open: null, active: id, playMode: 'list' })
    if (useGrowthShell.getState().route !== TAB_ROUTE[tab]) useGrowthShell.getState().go(TAB_ROUTE[tab])
  },
  addView: (tab, name, from) => {
    const taken = new Set(get().saved.map((view) => view.name))
    let fallback = `${TAB_NAME[tab]} view`
    for (let n = 2; taken.has(fallback); n += 1) fallback = `${TAB_NAME[tab]} view ${n}`
    const view: SavedView = { ...normalizeFilters(from), id: `view-${Date.now().toString(36)}`, name: name?.trim() || fallback, tab }
    set((state) => ({ saved: [...state.saved, view] }))
    get().selectView(tab, view.id)
    return view.id
  },
  updateView: (id, patch) => set((state) => ({ saved: state.saved.map((view) => (view.id === id ? { ...view, ...patch } : view)) })),
  deleteView: (id) => set((state) => ({ saved: state.saved.filter((view) => view.id !== id), active: state.active === id ? null : state.active })),
  setTags: (id, tags) => set((state) => ({ tags: { ...state.tags, [id]: tags } })),
}))

export function v10Location(route = useGrowthShell.getState().route): V10Location {
  const tab = ROUTE_TAB[route]
  if (!tab) return { active: null, scope: 'portfolio', slice: 'all', mode: 'list' }
  const state = useV10.getState()
  const view = state.saved.find((item) => item.id === state.active && item.tab === tab)
  const filters = view ?? state.filters[tab]
  const mode = tab === 'plays' && !view && filters.scope !== 'portfolio' ? state.playMode : 'list'
  return { active: view?.id ?? null, scope: filters.scope, slice: filters.slice, mode }
}

export function v10HashFor(route: NavLeafId, location = v10Location(route)): string {
  const base = `#/${route.replace(/\./g, '/')}`
  if (!ROUTE_TAB[route]) return base
  const params = new URLSearchParams()
  if (location.active) params.set('view', location.active)
  if (location.scope !== 'portfolio') params.set('scope', location.scope)
  if (route === 'work.plays' && location.scope !== 'portfolio' && location.mode !== 'list') params.set('mode', location.mode)
  if (route === 'work.experiences' && location.slice !== 'all') params.set('slice', location.slice)
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

export function restoreV10Location(route: NavLeafId, location?: V10Location) {
  const tab = ROUTE_TAB[route]
  if (!tab || !location) return
  const state = useV10.getState()
  if (location.active && state.saved.some((view) => view.id === location.active && view.tab === tab)) {
    useV10.setState({ active: location.active })
    return
  }
  useV10.setState({
    active: null,
    playMode: tab === 'plays' ? (location.mode ?? 'list') : 'list',
    filters: {
      ...state.filters,
      [tab]: { ...state.filters[tab], scope: location.scope, slice: tab === 'experiences' ? location.slice : 'all' },
    },
  })
}

export function syncV10FromHash(route: NavLeafId, hash: string) {
  const tab = ROUTE_TAB[route]
  if (!tab) return
  const parsed = locationFromHash(hash)
  const current = v10Location(route)
  restoreV10Location(route, {
    active: parsed.active ?? null,
    scope: parsed.scope ?? current.scope,
    slice: parsed.slice ?? (tab === 'experiences' ? current.slice : 'all'),
    mode: parsed.mode ?? 'list',
  })
}

useV10.subscribe((state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ pins: state.pins, recent: state.recent, filters: state.filters, saved: state.saved, active: state.active, tags: state.tags }))
  } catch {
    /* storage full or blocked */
  }
})

function remember(ref: V10Ref) {
  useV10.setState((state) => ({ recent: [ref, ...state.recent.filter((item) => !same(item, ref))].slice(0, MAX_RECENT) }))
}

/** Keep the V10 detail on the play or experience a V9 tree just opened. */
export function noteV10Open(ref: V10Ref) {
  if (!V10) return
  remember(ref)
  useV10.setState({ open: ref })
  const route = TAB_ROUTE[tabOf(ref)]
  if (useGrowthShell.getState().route !== route) useGrowthShell.getState().go(route)
}

/** Open a play, experience or audience, and show its tab. */
export function openRef(ref: V10Ref) {
  if (ref.source === 'growth' && ref.objective) {
    if (ref.kind === 'play') setGrowthView(ref.objective, { page: 'play', playId: ref.id, playTab: 'configure' })
    if (ref.kind === 'experience') {
      const playId = useGrowthPlays.getState().plays.find((play) => play.objective === ref.objective && play.variants.some((variant) => variant.experienceId === ref.id))?.id ?? null
      setGrowthView(ref.objective, { page: 'experience', experienceId: ref.id, playId })
    }
  }
  if (ref.source === 'retention' && ref.kind === 'play') openConfigure(ref.id, 1)
  if (ref.source === 'retention' && ref.kind === 'experience') openExperience(ref.id, playsUsing(ref.id)[0]?.id ?? null)
  remember(ref)
  useV10.setState({ open: ref })
  const route = TAB_ROUTE[tabOf(ref)]
  if (useGrowthShell.getState().route !== route) useGrowthShell.getState().go(route)
}

export function createV10Play() {
  return createV10GrowthPlay('acquisition')
}

export function createV10GrowthPlay(objective: GrowthObjective, type?: GrowthType) {
  const id = createGrowthPlay(objective)
  if (type) {
    const experience = addGrowthExperience(objective, type)
    addToGrowthPlay(id, experience.id)
  }
  openRef({ kind: 'play', source: 'growth', id, objective })
  return id
}

export function createV10RetentionPlay() {
  const id = createPlay()
  openRef({ kind: 'play', source: 'retention', id })
}

export function createV10Experience(type: GrowthType, objective: GrowthObjective = 'acquisition') {
  const created = addGrowthExperience(objective, type)
  openRef({ kind: 'experience', source: 'growth', id: created.id, objective })
}

export function createV10CancelPage() {
  const id = createExperience()
  openRef({ kind: 'experience', source: 'retention', id })
}

export function createV10Audience() {
  const id = createAudience()
  openRef({ kind: 'audience', source: 'audience', id })
}
