import { create } from 'zustand'

export type PaneTab = 'editor' | 'canvas' | 'preview'

/** The right-pane tabs one experience keeps open (tabs layout). At most one of each. */
export interface ThreadTabs {
  open: PaneTab[]
  active: PaneTab | null
}

export const NO_TABS: ThreadTabs = { open: [], active: null }

interface WorkspaceUi {
  sidebarOpen: boolean
  search: string
  /** Threads layout: the merchant closed the right pane for this experience. */
  paneHidden: boolean
  tabs: ThreadTabs
  /** Bumped to ask the chat to walk the brand step. */
  brandAsk: number
  setSidebarOpen: (open: boolean) => void
  setSearch: (search: string) => void
  setPaneHidden: (hidden: boolean) => void
  setTabs: (tabs: ThreadTabs) => void
  askBrand: () => void
}

export const useWorkspaceUi = create<WorkspaceUi>((set) => ({
  sidebarOpen: true,
  search: '',
  paneHidden: false,
  tabs: NO_TABS,
  brandAsk: 0,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSearch: (search) => set({ search }),
  setPaneHidden: (paneHidden) => set({ paneHidden }),
  setTabs: (tabs) => set({ tabs }),
  askBrand: () => set((s) => ({ brandAsk: s.brandAsk + 1 })),
}))
