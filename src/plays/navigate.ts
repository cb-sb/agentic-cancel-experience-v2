import { useOrchestration } from '../store/useOrchestration'
import { useUpload } from '../upload/useUpload'
import { newThread, switchThread, useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi, type LibraryKind, type PlayTab, type PlayTabRef } from '../workspace/useWorkspaceUi'
import { useJourney } from '../store/useJourney'
import type { ShellLayout } from '../types/experience'
import { addToPlay, usePlays } from './usePlays'

function leaveOverlays() {
  useOrchestration.getState().closeTemplates()
  if (useUpload.getState().phase !== 'closed' && !useUpload.getState().mappingOnly) useUpload.getState().close()
}

/** A play's own workspace: the canvas of every variant, its summary, its tasks. */
export function openPlay(playId: string) {
  leaveOverlays()
  const ui = useWorkspaceUi.getState()
  if (!ui.playTabs[playId]) ui.setPlayTabs(playId, { open: [{ id: `${playId}-canvas`, kind: 'canvas' }], active: `${playId}-canvas` })
  useWorkspaceUi.setState({ page: 'play', playId })
}

/** An experience, opened from inside a play (or from "Not in a play" when `playId` is null). */
export function openExperience(threadId: string, playId: string | null) {
  leaveOverlays()
  useWorkspaceUi.setState({ page: 'thread', readOnlyId: null, playId })
  switchThread(threadId)
}

/** Focus the play's first tab of `kind`, adding one when none is open. */
export function openPlayTab(playId: string, kind: PlayTab) {
  if (useWorkspaceUi.getState().page !== 'play' || useWorkspaceUi.getState().playId !== playId) openPlay(playId)
  const ui = useWorkspaceUi.getState()
  const tabs = ui.playTabs[playId] ?? { open: [], active: null }
  const hit = tabs.open.find((t) => t.kind === kind)
  if (hit) ui.setPlayTabs(playId, { ...tabs, active: hit.id })
  else openAnotherPlayTab(playId, kind)
}

export function openAnotherPlayTab(playId: string, kind: PlayTab, after?: string) {
  const ui = useWorkspaceUi.getState()
  const tabs = ui.playTabs[playId] ?? { open: [], active: null }
  const ref: PlayTabRef = { id: `${playId}-${kind}-${Math.random().toString(36).slice(2, 7)}`, kind }
  const at = after ? tabs.open.findIndex((t) => t.id === after) + 1 : tabs.open.length
  const open = [...tabs.open]
  open.splice(at <= 0 ? open.length : at, 0, ref)
  ui.setPlayTabs(playId, { open, active: ref.id })
}

export function closePlayTab(playId: string, id: string) {
  const ui = useWorkspaceUi.getState()
  const tabs = ui.playTabs[playId]
  if (!tabs) return
  const idx = tabs.open.findIndex((t) => t.id === id)
  const open = tabs.open.filter((t) => t.id !== id)
  const active = tabs.active === id ? (open[Math.max(0, idx - 1)]?.id ?? null) : tabs.active
  ui.setPlayTabs(playId, { open, active })
}

export function openOrder() {
  leaveOverlays()
  useWorkspaceUi.setState({ page: 'order' })
}

export function openLibrary(kind: LibraryKind, create = false) {
  leaveOverlays()
  useWorkspaceUi.setState((s) => ({ page: 'library', libraryKind: kind, libraryNew: create ? s.libraryNew + 1 : s.libraryNew }))
}

/** A new, empty experience. Straight into `playId` when given, with the layout already picked. */
export function createExperience(opts: { playId?: string | null; shell?: ShellLayout } = {}): string {
  leaveOverlays()
  const id = newThread({ force: true })
  if (opts.shell) useJourney.getState().patchFile({ shell: opts.shell })
  if (opts.playId) addToPlay(opts.playId, id)
  useWorkspaceUi.setState({ page: 'thread', readOnlyId: null, playId: opts.playId ?? null, renaming: id })
  return id
}

/** The play an open experience is being worked on through, when it still holds it. */
export function contextPlayId(): string | null {
  const { playId } = useWorkspaceUi.getState()
  const { activeId } = useWorkspace.getState()
  const play = usePlays.getState().plays.find((p) => p.id === playId)
  return play && play.variants.some((v) => v.experienceId === activeId) ? play.id : null
}
