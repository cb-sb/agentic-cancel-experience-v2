export type LayoutMode = 'v5' | 'threads' | 'tabs' | 'v7' | 'v8' | 'v9'

const MODES: LayoutMode[] = ['v5', 'threads', 'tabs', 'v7', 'v8', 'v9']

function readLayout(): LayoutMode {
  const fromUrl = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('layout')
  const raw = fromUrl ?? import.meta.env.VITE_LAYOUT ?? 'v5'
  return MODES.includes(raw as LayoutMode) ? (raw as LayoutMode) : 'v5'
}

/** Fixed for the page's lifetime. Threads, tabs, v7, v8 and v9 share the experiences-as-threads workspace. */
export const LAYOUT: LayoutMode = readLayout()
export const USES_THREADS = LAYOUT !== 'v5'
/** v9: v8 with the objective pane cut down to Plays, Experiences, Library and what you're working on. */
export const V9 = LAYOUT === 'v9'
/** Layouts where the right side is a strip of tabs. */
export const TABBED = LAYOUT === 'tabs' || LAYOUT === 'v7' || LAYOUT === 'v8' || V9
/** v7, v8 and v9: the Experiences pane, doors, and the tabbed studio. */
export const STUDIO = LAYOUT === 'v7' || LAYOUT === 'v8' || V9
/** v8 and v9: Copilot only sets up the subscriber experience; the rest is UI. */
export const V8 = LAYOUT === 'v8' || V9
