import { create } from 'zustand'
import {
  betaFor,
  CANCEL_ROUTE,
  DEFAULT_ROUTE,
  routeFromHash,
  type NavGroupId,
  type NavLeafId,
} from './nav'

function isExperience(route: NavLeafId) {
  return route === CANCEL_ROUTE
}

interface GrowthShellState {
  route: NavLeafId
  /** v8: the Retention beta nav is showing. */
  beta: boolean
  /** Full labels. Folded is the Copilot pattern: click to open, never covers. */
  navOpen: boolean
  openGroups: Record<NavGroupId, boolean>
  go: (route: NavLeafId) => void
  setNavOpen: (open: boolean) => void
  toggleNav: () => void
  toggleGroup: (id: NavGroupId) => void
  openGroup: (id: NavGroupId) => void
}

const COLLAPSED_GROUPS: Record<NavGroupId, boolean> = {
  plays: false,
  offers: false,
  experiences: false,
  people: false,
  reports: false,
}

const initial = routeFromHash(typeof window !== 'undefined' ? window.location.hash : '')

export const useGrowthShell = create<GrowthShellState>((set, get) => ({
  route: initial,
  beta: betaFor(initial, false),
  navOpen: !isExperience(initial),
  openGroups: { ...COLLAPSED_GROUPS },

  // The URL follows in navHistory, which records each move as one browser history step.
  go: (route) => {
    const experience = isExperience(route)
    const leavingExperience = isExperience(get().route) && !experience
    set((s) => ({
      route,
      beta: betaFor(route, s.beta),
      navOpen: experience ? false : leavingExperience ? true : s.navOpen,
    }))
  },

  setNavOpen: (navOpen) => set({ navOpen }),
  toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
  toggleGroup: (id) =>
    set((s) => ({ openGroups: { ...s.openGroups, [id]: !s.openGroups[id] } })),
  openGroup: (id) => set((s) => ({ openGroups: { ...s.openGroups, [id]: true } })),
}))

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const route = routeFromHash(window.location.hash)
    const experience = isExperience(route)
    useGrowthShell.setState((s) => ({
      route,
      beta: betaFor(route, s.beta),
      navOpen: experience ? false : s.navOpen,
    }))
  })
}

export function isCancelExperience(route: NavLeafId) {
  return route === CANCEL_ROUTE
}

export { DEFAULT_ROUTE, CANCEL_ROUTE }
