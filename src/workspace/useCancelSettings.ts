import { create } from 'zustand'
import { V8 } from '../layout/layoutMode'

const KEY = V8 ? 'cancel-experience:cancel-settings:v8' : 'cancel-experience:cancel-settings:v7'

/**
 * Settings Chargebee keeps once for every Cancel Page play. Cancel page plays
 * have no control group of their own, so Global control is the only holdout.
 */
interface CancelSettings {
  /** Share of everyone who clicks Cancel that sees no cancel page, 0 to 100. */
  globalControl: number
  /** Thread shown to subscribers no cancel experience's audience matches. Null: no cancel page. */
  globalFallbackId: string | null
  /** Thread ids, first wins when two experiences match the same subscriber. */
  priority: string[]
  settingsOpen: boolean
  setGlobalControl: (value: number) => void
  setGlobalFallback: (id: string | null) => void
  setPriority: (ids: string[]) => void
  setSettingsOpen: (open: boolean) => void
}

type Saved = Pick<CancelSettings, 'globalControl' | 'globalFallbackId' | 'priority'>

function read(): Saved {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Saved>) : {}
    return {
      globalControl: typeof parsed.globalControl === 'number' ? parsed.globalControl : 0,
      globalFallbackId: parsed.globalFallbackId ?? null,
      priority: Array.isArray(parsed.priority) ? parsed.priority : [],
    }
  } catch {
    return { globalControl: 0, globalFallbackId: null, priority: [] }
  }
}

function write(s: Saved) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ globalControl: s.globalControl, globalFallbackId: s.globalFallbackId, priority: s.priority }),
    )
  } catch {
    /* quota */
  }
}

export const useCancelSettings = create<CancelSettings>((set, get) => ({
  ...read(),
  settingsOpen: false,
  setGlobalControl: (globalControl) => {
    set({ globalControl: Math.max(0, Math.min(100, Math.round(globalControl))) })
    write(get())
  },
  setGlobalFallback: (globalFallbackId) => {
    set({ globalFallbackId })
    write(get())
  },
  setPriority: (priority) => {
    set({ priority })
    write(get())
  },
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}))

/** Threads in priority order. Ones never ranked go after, newest first. */
export function byPriority<T extends { id: string; updatedAt: number }>(threads: T[], priority: string[]): T[] {
  const rank = new Map(priority.map((id, i) => [id, i]))
  return [...threads].sort((a, b) => {
    const ra = rank.get(a.id)
    const rb = rank.get(b.id)
    if (ra !== undefined && rb !== undefined) return ra - rb
    if (ra !== undefined) return -1
    if (rb !== undefined) return 1
    return b.updatedAt - a.updatedAt
  })
}
