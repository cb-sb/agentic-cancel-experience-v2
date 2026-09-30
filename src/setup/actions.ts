import { contextPlayId, openExperience, openOrder, openPlayTab } from '../plays/navigate'
import { openTab } from '../workspace/paneTabs'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import type { TaskRow } from './progress'
import { entryById } from './registry'

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

/** Opens a setting where it is changed: its chat card when there is one, otherwise the page it lives on. */
export function openItem(item: string, targetId: string) {
  const entry = entryById(item)
  if (!entry) return
  const row: TaskRow = { entry, targetId, status: 'todo', waitingOn: [] }
  if (entry.chat) doInChat(row)
  else showMe(row)
}

