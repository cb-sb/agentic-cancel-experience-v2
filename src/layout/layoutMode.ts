export type LayoutMode = 'v5' | 'threads' | 'tabs' | 'v7' | 'v8' | 'concierge'

const MODES: LayoutMode[] = ['v5', 'threads', 'tabs', 'v7', 'v8', 'concierge']

function readLayout(): LayoutMode {
  const fromUrl = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('layout')
  const raw = fromUrl ?? import.meta.env.VITE_LAYOUT ?? 'v5'
  return MODES.includes(raw as LayoutMode) ? (raw as LayoutMode) : 'v5'
}

/** Fixed for the page's lifetime. Every layout but v5 shares the experiences-as-threads workspace. */
export const LAYOUT: LayoutMode = readLayout()
export const USES_THREADS = LAYOUT !== 'v5'
/** Concierge: Home, Acquisition and Expansion around the v8 cancel experience, which is its Retention. */
export const CONCIERGE = LAYOUT === 'concierge'
/** Layouts where the right side is a strip of tabs. */
export const TABBED = LAYOUT === 'tabs' || LAYOUT === 'v7' || LAYOUT === 'v8' || CONCIERGE
/** v7, v8 and concierge: the Experiences pane, doors, and the tabbed studio. */
export const STUDIO = LAYOUT === 'v7' || LAYOUT === 'v8' || CONCIERGE
/** v8: Copilot only sets up the subscriber experience; the rest is UI. Concierge's Retention runs on it too. */
export const V8 = LAYOUT === 'v8' || CONCIERGE

/** Browser back and forward across places, with one back control per page. */
export const HISTORY_NAV = V8 || CONCIERGE
/** Template cards with a preview strip, and the confirm view before a template is used. */
export const LOWFI_LIBRARY = V8 || CONCIERGE
/** The Plan tab as a page of decisions. */
export const PLAN_PAGE = V8 || CONCIERGE
