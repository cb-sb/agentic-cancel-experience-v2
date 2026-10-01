import { CANCEL_ROUTE } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { byPriority, useCancelSettings } from '../workspace/useCancelSettings'
import { experienceNames, newThread, renameThread, switchThread, threadIsLive, useWorkspace } from '../workspace/useWorkspace'
import { uniqueName } from '../plays/names'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import type { ExperienceStatus } from './model'

/** No screens yet, named or not. */
export function cancelPageEmpty(id: string): boolean {
  const { threads, activeId } = useWorkspace.getState()
  if (id === activeId) return useJourney.getState().file.steps.length === 0
  const t = threads.find((x) => x.id === id)
  return Boolean(t && !t.seed && !t.snapshot?.journey.steps.length)
}

export interface CancelPageRow {
  id: string
  /** A new page with nothing on it yet. */
  blank: boolean
  name: string
  status: ExperienceStatus
  priority: number
  updatedAt: number
}

export function cancelPageRows(): CancelPageRow[] {
  const { threads, activeId } = useWorkspace.getState()
  const activeLive = useOrchestration.getState().play.publishState === 'live'
  const ranked = byPriority(threads, useCancelSettings.getState().priority)
  return ranked.map((t, i) => ({
    id: t.id,
    blank: !t.seed && !t.named && !(t.id === activeId ? useJourney.getState().file.steps.length : t.snapshot?.journey.steps.length),
    name: t.title,
    status: threadIsLive(t, activeId, activeLive) ? 'live' : 'draft',
    priority: i + 1,
    updatedAt: t.updatedAt,
  }))
}

export function openCancelPage(id: string) {
  useGrowthShell.getState().go(CANCEL_ROUTE)
  useOrchestration.getState().closeTemplates()
  useWorkspaceUi.getState().setPage('thread')
  switchThread(id)
}

/** A blank cancel page, open in its workspace. */
export function createCancelPage(name?: string): string {
  useGrowthShell.getState().go(CANCEL_ROUTE)
  useOrchestration.getState().closeTemplates()
  useWorkspaceUi.getState().setPage('thread')
  newThread({ force: true })
  const id = useWorkspace.getState().activeId
  if (name) {
    const unique = uniqueName(name, experienceNames(id))
    renameThread(id, unique)
    useJourney.getState().replaceFile({ ...useJourney.getState().file, name: unique })
  }
  return id
}

export function moveCancelPage(id: string, position: number) {
  const ids = byPriority(useWorkspace.getState().threads, useCancelSettings.getState().priority).map((t) => t.id)
  const rest = ids.filter((x) => x !== id)
  rest.splice(Math.max(0, Math.min(rest.length, position - 1)), 0, id)
  useCancelSettings.getState().setPriority(rest)
}
