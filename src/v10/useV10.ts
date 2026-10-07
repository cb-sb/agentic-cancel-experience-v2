import { create } from 'zustand'
import { setGrowthView } from '../concierge/objective/useGrowthUi'
import type { GrowthObjective, GrowthType } from '../concierge/model'
import { addGrowthExperience } from '../concierge/useGrowthExperiences'
import { createGrowthPlay } from '../concierge/useGrowthPlays'
import { createExperience, openExperience, openPlay } from '../plays/navigate'
import { createPlay } from '../plays/usePlays'
import type { NavLeafId } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { createAudience } from './useAudiences'

const KEY = 'cancel-experience:v10'
const MAX_RECENT = 8

export type Tag = 'acquisition' | 'expansion' | 'retention'
export type V10Tab = 'plays' | 'experiences' | 'audiences'
export type V10Kind = 'play' | 'experience' | 'audience'
export type V10Source = 'growth' | 'retention' | 'audience'

export interface V10Ref {
  kind: V10Kind
  source: V10Source
  id: string
  objective?: GrowthObjective
}

export interface Filters {
  query: string
  tags: Tag[]
  status: 'any' | 'live' | 'draft'
  group: 'none' | 'tag' | 'status' | 'type'
  sort: 'name' | 'recent'
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
  /** Extra tags a merchant added. Absent means the item keeps the tag it already has. */
  tags: Record<string, Tag[]>
  close: () => void
  togglePin: (ref: V10Ref) => void
  setFilters: (tab: V10Tab, patch: Partial<Filters>) => void
  saveView: (tab: V10Tab, name: string) => void
  applyView: (id: string) => void
  deleteView: (id: string) => void
  setTags: (id: string, tags: Tag[]) => void
}

export const EMPTY_FILTERS: Filters = { query: '', tags: [], status: 'any', group: 'none', sort: 'recent' }

const TAB_ROUTE: Record<V10Tab, NavLeafId> = {
  plays: 'work.plays',
  experiences: 'work.experiences',
  audiences: 'work.audiences',
}

export function tabOf(ref: V10Ref): V10Tab {
  if (ref.kind === 'play') return 'plays'
  if (ref.kind === 'experience') return 'experiences'
  return 'audiences'
}

function same(a: V10Ref, b: V10Ref) {
  return a.kind === b.kind && a.id === b.id
}

interface SavedShape {
  pins?: V10Ref[]
  recent?: V10Ref[]
  filters?: Record<V10Tab, Filters>
  saved?: SavedView[]
  tags?: Record<string, Tag[]>
}

function load(): Pick<V10State, 'pins' | 'recent' | 'filters' | 'saved' | 'tags'> {
  const empty = { pins: [], recent: [], filters: { plays: EMPTY_FILTERS, experiences: EMPTY_FILTERS, audiences: EMPTY_FILTERS }, saved: [], tags: {} }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as SavedShape
    return {
      pins: Array.isArray(parsed.pins) ? parsed.pins : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      filters: { ...empty.filters, ...parsed.filters },
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      tags: parsed.tags ?? {},
    }
  } catch {
    return empty
  }
}

export const useV10 = create<V10State>((set, get) => ({
  open: null,
  ...load(),
  close: () => set({ open: null }),
  togglePin: (ref) =>
    set((state) => ({
      pins: state.pins.some((pin) => same(pin, ref)) ? state.pins.filter((pin) => !same(pin, ref)) : [ref, ...state.pins],
    })),
  setFilters: (tab, patch) => set((state) => ({ filters: { ...state.filters, [tab]: { ...state.filters[tab], ...patch } } })),
  saveView: (tab, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const view: SavedView = { ...get().filters[tab], id: `view-${Date.now().toString(36)}`, name: trimmed, tab }
    set((state) => ({ saved: [view, ...state.saved] }))
  },
  applyView: (id) => {
    const view = get().saved.find((item) => item.id === id)
    if (!view) return
    const { id: _id, name: _name, tab, ...filters } = view
    set((state) => ({ open: null, filters: { ...state.filters, [tab]: filters } }))
    useGrowthShell.getState().go(TAB_ROUTE[tab])
  },
  deleteView: (id) => set((state) => ({ saved: state.saved.filter((view) => view.id !== id) })),
  setTags: (id, tags) => set((state) => ({ tags: { ...state.tags, [id]: tags } })),
}))

useV10.subscribe((state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ pins: state.pins, recent: state.recent, filters: state.filters, saved: state.saved, tags: state.tags }))
  } catch {
    /* storage full or blocked */
  }
})

function remember(ref: V10Ref) {
  useV10.setState((state) => ({ recent: [ref, ...state.recent.filter((item) => !same(item, ref))].slice(0, MAX_RECENT) }))
}

/** Open a play, experience or audience, and show its tab. */
export function openRef(ref: V10Ref) {
  if (ref.source === 'growth' && ref.objective) {
    if (ref.kind === 'play') setGrowthView(ref.objective, { page: 'play', playId: ref.id, playTab: 'configure' })
    if (ref.kind === 'experience') setGrowthView(ref.objective, { page: 'experience', experienceId: ref.id, playId: null })
  }
  if (ref.source === 'retention' && ref.kind === 'play') openPlay(ref.id)
  if (ref.source === 'retention' && ref.kind === 'experience') openExperience(ref.id, null)
  remember(ref)
  useV10.setState({ open: ref })
  const route = TAB_ROUTE[tabOf(ref)]
  if (useGrowthShell.getState().route !== route) useGrowthShell.getState().go(route)
}

export function createV10Play() {
  const id = createGrowthPlay('acquisition')
  openRef({ kind: 'play', source: 'growth', id, objective: 'acquisition' })
}

export function createV10RetentionPlay() {
  const id = createPlay()
  openRef({ kind: 'play', source: 'retention', id })
}

export function createV10Experience(type: GrowthType) {
  const created = addGrowthExperience('acquisition', type)
  openRef({ kind: 'experience', source: 'growth', id: created.id, objective: 'acquisition' })
}

export function createV10CancelPage() {
  const id = createExperience()
  openRef({ kind: 'experience', source: 'retention', id })
}

export function createV10Audience() {
  const id = createAudience()
  openRef({ kind: 'audience', source: 'audience', id })
}
