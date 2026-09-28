import { create } from 'zustand'
import type { PlanBeat } from '../orchestration/JourneyPlan'

/** `canvas` is shown as Targeting in the v7 layout. */
export type PaneTab = 'editor' | 'canvas' | 'preview' | 'plan'

/** The right-pane tabs one experience keeps open (tabs layout). At most one of each. */
export interface ThreadTabs {
  open: PaneTab[]
  active: PaneTab | null
}

export const NO_TABS: ThreadTabs = { open: [], active: null }

export type Objective = 'acquisition' | 'expansion' | 'retention'

/** v7: the experience being built, the Experiences page, or a read-only play from it. */
export type StudioPage = 'thread' | 'index'

interface WorkspaceUi {
  sidebarOpen: boolean
  search: string
  /** Threads layout: the merchant closed the right pane for this experience. */
  paneHidden: boolean
  tabs: ThreadTabs
  /** Bumped to ask the chat to walk one plan step. */
  beatAsk: { beat: PlanBeat; n: number } | null
  page: StudioPage
  indexTab: Objective
  /** Acquisition or expansion play opened read-only from the Experiences page. */
  readOnlyId: string | null
  searchOpen: boolean
  /** Preview tab: a sample subscriber id, a branch id, or '' for the variant being edited. */
  previewAs: string
  setSidebarOpen: (open: boolean) => void
  setSearch: (search: string) => void
  setPaneHidden: (hidden: boolean) => void
  setTabs: (tabs: ThreadTabs) => void
  askBeat: (beat: PlanBeat) => void
  askBrand: () => void
  setPage: (page: StudioPage) => void
  setIndexTab: (tab: Objective) => void
  setReadOnlyId: (id: string | null) => void
  setSearchOpen: (open: boolean) => void
  setPreviewAs: (id: string) => void
}

export const useWorkspaceUi = create<WorkspaceUi>((set) => ({
  sidebarOpen: true,
  search: '',
  paneHidden: false,
  tabs: NO_TABS,
  beatAsk: null,
  page: 'thread',
  indexTab: 'retention',
  readOnlyId: null,
  searchOpen: false,
  previewAs: '',
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSearch: (search) => set({ search }),
  setPaneHidden: (paneHidden) => set({ paneHidden }),
  setTabs: (tabs) => set({ tabs }),
  askBeat: (beat) => set((s) => ({ beatAsk: { beat, n: (s.beatAsk?.n ?? 0) + 1 } })),
  askBrand: () => set((s) => ({ beatAsk: { beat: 'brand', n: (s.beatAsk?.n ?? 0) + 1 } })),
  setPage: (page) => set(page === 'thread' ? { page, readOnlyId: null } : { page }),
  setIndexTab: (indexTab) => set({ indexTab, readOnlyId: null }),
  setReadOnlyId: (readOnlyId) => set({ readOnlyId }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setPreviewAs: (previewAs) => set({ previewAs }),
}))
