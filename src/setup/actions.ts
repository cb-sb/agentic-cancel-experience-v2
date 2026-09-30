import { contextPlayId, openExperience, openOrder, openPlayTab } from '../plays/navigate'
import { openTab } from '../workspace/paneTabs'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import type { TaskRow } from './progress'
import { setMark, type DoneBy } from './useSetupState'

function onExperience(targetId: string) {
  const ui = useWorkspaceUi.getState()
  if (ui.page !== 'thread' || useWorkspace.getState().activeId !== targetId) {
    openExperience(targetId, contextPlayId() ?? ui.playId)
  }
}

/** Opens the right chat and asks it for this one item. */
export function doInChat(row: TaskRow) {
  const { entry, targetId } = row
  if (entry.scope === 'experience') onExperience(targetId)
  if (entry.scope === 'play') openPlayTab(targetId, 'tasks')
  useWorkspaceUi.getState().askSetup(entry.id, targetId)
}

/** Takes you to where the item is done by hand. */
export function showMe(row: TaskRow) {
  const { entry, targetId } = row
  const to = entry.showMe?.to
  if (!to) return doInChat(row)
  if (to === 'order') return openOrder()
  if (to === 'playCanvas' || to === 'playSummary') {
    const playId = entry.scope === 'play' ? targetId : useWorkspaceUi.getState().playId
    if (playId) openPlayTab(playId, to === 'playCanvas' ? 'canvas' : 'summary')
    return
  }
  if (entry.scope === 'experience') onExperience(targetId)
  openTab(to)
}

export function skipForNow(row: TaskRow, by: DoneBy = 'tasks') {
  setMark(row.targetId, row.entry.id, 'skipped', by)
}

export function notNeeded(row: TaskRow, by: DoneBy = 'tasks') {
  setMark(row.targetId, row.entry.id, 'na', by)
}

export function reopen(row: TaskRow) {
  setMark(row.targetId, row.entry.id, null)
}
