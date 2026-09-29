export type LayoutMode = 'v5' | 'threads' | 'tabs' | 'v7' | 'v8'

const MODES: LayoutMode[] = ['v5', 'threads', 'tabs', 'v7', 'v8']

function readLayout(): LayoutMode {
  const fromUrl = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('layout')
  const raw = fromUrl ?? import.meta.env.VITE_LAYOUT ?? 'v5'
  return MODES.includes(raw as LayoutMode) ? (raw as LayoutMode) : 'v5'
}

/** Fixed for the page's lifetime. Threads, tabs, v7 and v8 share the experiences-as-threads workspace. */
export const LAYOUT: LayoutMode = readLayout()
export const USES_THREADS = LAYOUT !== 'v5'
/** Layouts where the right side is a strip of tabs. */
export const TABBED = LAYOUT === 'tabs' || LAYOUT === 'v7' || LAYOUT === 'v8'
/** v7 and v8: the Experiences pane, doors, and the tabbed studio. */
export const STUDIO = LAYOUT === 'v7' || LAYOUT === 'v8'
/** v8: Copilot only sets up the subscriber experience; the rest is UI. */
export const V8 = LAYOUT === 'v8'
