import { create } from 'zustand'
import type { PlanBeat } from '../orchestration/JourneyPlan'
import type { DeviceKind } from '../store/useExperience'

/** `targeting` is v7 only. `plan` shows as Summary in v8. `tasks` is v8 only. */
export type PaneTab = 'editor' | 'canvas' | 'targeting' | 'preview' | 'plan' | 'tasks'

/** What a tab remembers on its own, so two tabs of one kind can differ. */
export interface TabState {
  previewAs?: string
  device?: DeviceKind
}

export interface PaneTabRef {
  id: string
  kind: PaneTab
  state?: TabState
}

/** The right-pane tabs one experience keeps open. v8 can hold more than one of a kind. */
export interface ThreadTabs {
  open: PaneTabRef[]
  active: string | null
}

export const NO_TABS: ThreadTabs = { open: [], active: null }

let tabN = 0
export const newTabId = (kind: PaneTab) => `${kind}-${Date.now().toString(36)}-${tabN++}`

export function singleTab(kind: PaneTab): ThreadTabs {
  const id = newTabId(kind)
  return { open: [{ id, kind }], active: id }
}

/** Threads saved before multi-tab kept `open` as a list of kinds. */
export function normalizeTabs(raw: unknown): ThreadTabs {
  if (!raw || typeof raw !== 'object') return NO_TABS
  const t = raw as { open?: unknown[]; active?: unknown }
  if (!Array.isArray(t.open)) return NO_TABS
  if (t.open.every((x) => typeof x === 'string')) {
    const open = (t.open as PaneTab[]).map((kind) => ({ id: kind, kind }))
    return { open, active: typeof t.active === 'string' && open.some((o) => o.id === t.active) ? t.active : (open[0]?.id ?? null) }
  }
  const open = (t.open as PaneTabRef[]).filter((x) => x && typeof x.id === 'string' && typeof x.kind === 'string')
  const active = typeof t.active === 'string' && open.some((o) => o.id === t.active) ? t.active : (open[0]?.id ?? null)
  return { open, active }
}

export function activeRef(tabs: ThreadTabs): PaneTabRef | null {
  return tabs.open.find((t) => t.id === tabs.active) ?? null
}

export function activeKind(tabs: ThreadTabs): PaneTab | null {
  return activeRef(tabs)?.kind ?? null
}

export type Objective = 'acquisition' | 'expansion' | 'retention'

/**
 * The experience being built, the Experiences page, or a read-only play from it.
 * v8 adds a play's own workspace, play order and testing, and the retention library.
 */
export type StudioPage = 'thread' | 'index' | 'play' | 'order' | 'library'

export type LibraryKind = 'offers' | 'reasons' | 'cards' | 'confirmations' | 'redirects'

/** v8 play tabs: the setup wizard, the canvas of every variant, the play summary, and its task list. */
export type PlayTab = 'configure' | 'canvas' | 'summary' | 'tasks'

export type ConfigureStep = 1 | 2 | 3

export interface PlayTabRef {
  id: string
  kind: PlayTab
}

export interface PlayTabs {
  open: PlayTabRef[]
  active: string | null
}

interface WorkspaceUi {
  sidebarOpen: boolean
  search: string
  /** Threads layout: the merchant closed the right pane for this experience. */
  paneHidden: boolean
  tabs: ThreadTabs
  /** Bumped to ask the chat to walk one plan step. */
  beatAsk: { beat: PlanBeat; n: number } | null
  /** Bumped to ask the chat to open one setup item. */
  setupAsk: { item: string; targetId: string; n: number } | null
  page: StudioPage
  indexTab: Objective
  /** Acquisition or expansion play opened read-only from the Experiences page. */
  readOnlyId: string | null
  searchOpen: boolean
  /** Preview tab: a sample subscriber id, a branch id, or '' for the variant being edited. */
  previewAs: string
  /** v8: the play the merchant came in through. An experience opened from a play keeps it. */
  playId: string | null
  playTabs: Record<string, PlayTabs>
  /** The step each play's Configure tab is on. */
  configureStep: Record<string, ConfigureStep>
  libraryKind: LibraryKind
  /** Bumped by the Create menu to open the library's new-item form. */
  libraryNew: number
  /** Library item to open when the page shows, then cleared. */
  libraryFocus: string | null
  /** Row whose name is being edited in place in the side pane. */
  renaming: string | null
  /** v8: Copilot folded to a thin strip beside the tabs. */
  copilotCollapsed: boolean
  setSidebarOpen: (open: boolean) => void
  setSearch: (search: string) => void
  setPaneHidden: (hidden: boolean) => void
  setTabs: (tabs: ThreadTabs) => void
  askBeat: (beat: PlanBeat) => void
  askBrand: () => void
  askSetup: (item: string, targetId: string) => void
  setPage: (page: StudioPage) => void
  setIndexTab: (tab: Objective) => void
  setReadOnlyId: (id: string | null) => void
  setSearchOpen: (open: boolean) => void
  setPreviewAs: (id: string) => void
  setPlayTabs: (playId: string, tabs: PlayTabs) => void
  setConfigureStep: (playId: string, step: ConfigureStep) => void
  setRenaming: (id: string | null) => void
  setCopilotCollapsed: (collapsed: boolean) => void
}

const COPILOT_COLLAPSED_KEY = 'cancel-experience:copilot-collapsed:v8'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COPILOT_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export const useWorkspaceUi = create<WorkspaceUi>((set) => ({
  sidebarOpen: true,
  search: '',
  paneHidden: false,
  tabs: NO_TABS,
  beatAsk: null,
  setupAsk: null,
  page: 'thread',
  indexTab: 'retention',
  readOnlyId: null,
  searchOpen: false,
  previewAs: '',
  playId: null,
  playTabs: {},
  configureStep: {},
  libraryKind: 'offers',
  libraryNew: 0,
  libraryFocus: null,
  renaming: null,
  copilotCollapsed: readCollapsed(),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSearch: (search) => set({ search }),
  setPaneHidden: (paneHidden) => set({ paneHidden }),
  setTabs: (tabs) => set({ tabs }),
  askBeat: (beat) => set((s) => ({ beatAsk: { beat, n: (s.beatAsk?.n ?? 0) + 1 }, copilotCollapsed: false })),
  askBrand: () => set((s) => ({ beatAsk: { beat: 'brand', n: (s.beatAsk?.n ?? 0) + 1 }, copilotCollapsed: false })),
  askSetup: (item, targetId) =>
    set((s) => ({ setupAsk: { item, targetId, n: (s.setupAsk?.n ?? 0) + 1 }, copilotCollapsed: false })),
  setPage: (page) => set(page === 'thread' ? { page, readOnlyId: null } : { page }),
  setIndexTab: (indexTab) => set({ indexTab, readOnlyId: null }),
  setReadOnlyId: (readOnlyId) => set({ readOnlyId }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setPreviewAs: (previewAs) => set({ previewAs }),
  setPlayTabs: (playId, tabs) => set((s) => ({ playTabs: { ...s.playTabs, [playId]: tabs } })),
  setConfigureStep: (playId, step) => set((s) => ({ configureStep: { ...s.configureStep, [playId]: step } })),
  setRenaming: (renaming) => set({ renaming }),
  setCopilotCollapsed: (copilotCollapsed) => set({ copilotCollapsed }),
}))

useWorkspaceUi.subscribe((s, prev) => {
  if (s.copilotCollapsed === prev.copilotCollapsed) return
  try {
    localStorage.setItem(COPILOT_COLLAPSED_KEY, s.copilotCollapsed ? '1' : '0')
  } catch {
    /* storage blocked */
  }
})
