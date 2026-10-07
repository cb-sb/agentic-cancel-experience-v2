import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { failing, playChecks } from '../setup/checks'
import { useSetupInputs } from '../setup/progress'
import { openTab } from '../workspace/paneTabs'
import { orderedThreads, useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { createExperience, openExperience } from './navigate'
import type { PlayOps } from './playOps'
import type { CancelPlay } from './types'
import { retentionPlayOps } from './usePlays'

export interface PlayPageOption {
  id: string
  title: string
}

export interface OpenCheck {
  id: string
  label: string
  fix: string
  /** What it's about: 'audience', 'split' and 'variants' are fixed in Configure. */
  item: string
  openExperienceId?: string
}

/** What a play's screens need from wherever its plays and pages live. */
export interface PlaysBackend {
  ops: PlayOps
  /** What one of the play's pages is called, in lower case. */
  noun: string
  usePages(): PlayPageOption[]
  /** A blank page for this play, returned by id. */
  newPage(playId: string): string
  openPage(experienceId: string, playId: string, tab: 'preview' | 'editor'): void
  useOpenChecks(play: CancelPlay): OpenCheck[]
  /** Under the control group slider. */
  controlLine(control: number): string
}

function useRetentionPages(): PlayPageOption[] {
  const threads = useWorkspace((s) => s.threads)
  return useMemo(() => orderedThreads(threads).map((t) => ({ id: t.id, title: t.title })), [threads])
}

function useRetentionChecks(play: CancelPlay): OpenCheck[] {
  const inputs = useSetupInputs()
  return failing(playChecks(play.id, inputs))
}

export const RETENTION_BACKEND: PlaysBackend = {
  ops: retentionPlayOps,
  noun: 'cancel page',
  usePages: useRetentionPages,
  newPage: (playId) => {
    const created = createExperience()
    useWorkspaceUi.setState({ playId })
    return created
  },
  openPage: (experienceId, playId, tab) => {
    openExperience(experienceId, playId)
    if (tab === 'preview') useWorkspaceUi.setState({ previewAs: '' })
    openTab(tab)
  },
  useOpenChecks: useRetentionChecks,
  controlLine: (control) =>
    control === 0 ? 'Everyone in the audience gets a cancel page.' : `${control}% of this audience cancels with no cancel page, so you can measure what the play saves.`,
}

const Backend = createContext<PlaysBackend>(RETENTION_BACKEND)

export function PlaysBackendProvider({ value, children }: { value: PlaysBackend; children: ReactNode }) {
  return <Backend.Provider value={value}>{children}</Backend.Provider>
}

export function usePlaysBackend(): PlaysBackend {
  return useContext(Backend)
}
