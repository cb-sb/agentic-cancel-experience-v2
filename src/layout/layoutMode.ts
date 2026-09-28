export type LayoutMode = 'v5' | 'threads' | 'tabs' | 'v7'

const MODES: LayoutMode[] = ['v5', 'threads', 'tabs', 'v7']

function readLayout(): LayoutMode {
  const fromUrl = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('layout')
  const raw = fromUrl ?? import.meta.env.VITE_LAYOUT ?? 'v5'
  return MODES.includes(raw as LayoutMode) ? (raw as LayoutMode) : 'v5'
}

/** Fixed for the page's lifetime. Threads, tabs and v7 share the experiences-as-threads workspace. */
export const LAYOUT: LayoutMode = readLayout()
export const USES_THREADS = LAYOUT !== 'v5'
/** Layouts where the right side is a strip of tabs. */
export const TABBED = LAYOUT === 'tabs' || LAYOUT === 'v7'
export const STUDIO = LAYOUT === 'v7'
