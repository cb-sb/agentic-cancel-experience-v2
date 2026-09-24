import { create } from 'zustand'
import { uid } from '../lib/id'
import {
  confirmLabel,
  publishMilestone,
  summarizeFileChange,
  targetingChanged,
  type HistoryKind,
} from '../history/summarize'
import type { Experience } from '../types/experience'
import type { Play } from '../types/orchestration'
import type { JourneyFile } from '../journey/types'
import { applyDraftPayload, type SetupFlags } from './draft'
import { useExperience } from './useExperience'
import { useJourney } from './useJourney'
import { useOrchestration } from './useOrchestration'

/** Everything needed to put the studio back exactly where it was. */
export interface HistorySnapshot {
  journey: JourneyFile
  play: Play
  experiences: Record<string, Experience>
  activeExperienceId: string
  setup: SetupFlags
}

export interface HistoryEntry {
  id: string
  at: number
  kind: HistoryKind
  summary: string
  detail?: string
  /** Edits carry a snapshot and can be rolled back; milestones/restores don't. */
  restorable: boolean
  snapshot?: HistorySnapshot
}

/** Keep the log light — this rides along in the localStorage draft. */
const CAP = 30

interface HistoryState {
  entries: HistoryEntry[]
  /** True while a restore is applying, so the watcher doesn't log the rollback. */
  restoring: boolean
  record: (entry: Omit<HistoryEntry, 'id' | 'at'> & { at?: number }) => void
  restore: (id: string) => void
  clear: () => void
  hydrate: (entries: HistoryEntry[]) => void
}

export const useHistory = create<HistoryState>((set, get) => ({
  entries: [],
  restoring: false,

  record: (entry) =>
    set((s) => ({
      entries: [
        { id: uid('hist'), at: entry.at ?? Date.now(), ...entry },
        ...s.entries,
      ].slice(0, CAP),
    })),

  restore: (id) => {
    const entry = get().entries.find((e) => e.id === id)
    if (!entry?.snapshot) return

    set({ restoring: true })

    // Land back on the canvas in compose mode before swapping state under it.
    const exp = useExperience.getState()
    if (exp.mode === 'play') exp.setMode('compose')
    useOrchestration.getState().exitFocus()

    applyDraftPayload(entry.snapshot)
    resetHistoryBaseline()
    useOrchestration.setState({ dirty: true })

    set((s) => ({
      entries: [
        {
          id: uid('hist'),
          at: Date.now(),
          kind: 'restore' as const,
          summary: `Restored “${entry.summary}”`,
          restorable: false,
        },
        ...s.entries,
      ].slice(0, CAP),
    }))

    // Release the guard after the store updates have flushed.
    queueMicrotask(() => set({ restoring: false }))
  },

  clear: () => set({ entries: [] }),
  hydrate: (entries) => set({ entries: entries.slice(0, CAP) }),
}))

// ---------------------------------------------------------------------------
// Central watcher — one activity entry per burst of derived writes.
// ---------------------------------------------------------------------------

function readFlags(): SetupFlags {
  const s = useOrchestration.getState()
  return {
    confirmedSetup: s.confirmedSetup,
    installConnected: s.installConnected,
    walkedOrSkipped: s.walkedOrSkipped,
    dismissedStepNeedsWork: s.dismissedStepNeedsWork,
  }
}

function readSnapshot(): HistorySnapshot {
  const exp = useExperience.getState()
  return {
    journey: useJourney.getState().file,
    play: useOrchestration.getState().play,
    experiences: exp.experiences,
    activeExperienceId: exp.activeExperienceId,
    setup: readFlags(),
  }
}

let baseFile: JourneyFile | null = null
let basePlay: Play | null = null
let baseExperiences: Record<string, Experience> | null = null
let baseFlags: SetupFlags | null = null
let baseSavedAt: number | null = null
let baselineReady = false
let flushTimer: ReturnType<typeof setTimeout> | undefined

/** Snap the baseline to the live stores (after load or a restore). */
export function resetHistoryBaseline(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = undefined
  }
  const snap = readSnapshot()
  baseFile = snap.journey
  basePlay = snap.play
  baseExperiences = snap.experiences
  baseFlags = snap.setup
  baseSavedAt = useOrchestration.getState().savedAt
  baselineReady = true
}

function newlyConfirmed(prev: SetupFlags, next: SetupFlags): string | null {
  for (const key of Object.keys(next.confirmedSetup)) {
    if (next.confirmedSetup[key as keyof typeof next.confirmedSetup] && !prev.confirmedSetup[key as keyof typeof prev.confirmedSetup]) {
      return key
    }
  }
  return null
}

function flush(): void {
  flushTimer = undefined
  if (!baselineReady || useHistory.getState().restoring) return

  const curFile = useJourney.getState().file
  const curPlay = useOrchestration.getState().play
  const curExp = useExperience.getState().experiences
  const curFlags = readFlags()
  const curSavedAt = useOrchestration.getState().savedAt

  const record = useHistory.getState().record

  const fileSummary = baseFile ? summarizeFileChange(baseFile, curFile) : null
  if (fileSummary) {
    record({ kind: 'edit', summary: fileSummary, restorable: true, snapshot: readSnapshot() })
  } else if (basePlay && publishMilestone(basePlay, curPlay)) {
    record({ kind: 'milestone', summary: publishMilestone(basePlay, curPlay)!, restorable: false })
  } else if (baseFlags && !baseFlags.walkedOrSkipped && curFlags.walkedOrSkipped) {
    record({ kind: 'milestone', summary: 'Walked the experience', restorable: false })
  } else if (baseFlags && !baseFlags.installConnected && curFlags.installConnected) {
    record({ kind: 'milestone', summary: 'Connected Growth to Billing', restorable: false })
  } else if (baseFlags && newlyConfirmed(baseFlags, curFlags)) {
    record({ kind: 'milestone', summary: confirmLabel(newlyConfirmed(baseFlags, curFlags)!), restorable: false })
  } else if (curSavedAt !== baseSavedAt && curSavedAt) {
    record({ kind: 'milestone', summary: 'Saved draft', restorable: false })
  } else if (basePlay && targetingChanged(basePlay, curPlay)) {
    record({ kind: 'edit', summary: 'Edited traffic split', restorable: true, snapshot: readSnapshot() })
  } else if (baseExperiences && curExp !== baseExperiences) {
    record({ kind: 'edit', summary: 'Edited a step', restorable: true, snapshot: readSnapshot() })
  }

  baseFile = curFile
  basePlay = curPlay
  baseExperiences = curExp
  baseFlags = curFlags
  baseSavedAt = curSavedAt
}

function schedule(): void {
  if (!baselineReady || useHistory.getState().restoring) return
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, 300)
}

/**
 * Start logging activity. Call once, AFTER loadDraft, so the baseline is the
 * restored draft rather than the seed.
 */
export function startHistoryWatch(): void {
  resetHistoryBaseline()

  let lastPlay = useOrchestration.getState().play
  let lastConfirmed = useOrchestration.getState().confirmedSetup
  let lastWalk = useOrchestration.getState().walkedOrSkipped
  let lastConnected = useOrchestration.getState().installConnected
  let lastSavedAt = useOrchestration.getState().savedAt
  useOrchestration.subscribe((s) => {
    if (
      s.play !== lastPlay ||
      s.confirmedSetup !== lastConfirmed ||
      s.walkedOrSkipped !== lastWalk ||
      s.installConnected !== lastConnected ||
      s.savedAt !== lastSavedAt
    ) {
      lastPlay = s.play
      lastConfirmed = s.confirmedSetup
      lastWalk = s.walkedOrSkipped
      lastConnected = s.installConnected
      lastSavedAt = s.savedAt
      schedule()
    }
  })

  let lastExperiences = useExperience.getState().experiences
  useExperience.subscribe((s) => {
    if (s.experiences !== lastExperiences) {
      lastExperiences = s.experiences
      schedule()
    }
  })

  let lastJourney = useJourney.getState().file
  useJourney.subscribe((s) => {
    if (s.file !== lastJourney) {
      lastJourney = s.file
      schedule()
    }
  })
}
