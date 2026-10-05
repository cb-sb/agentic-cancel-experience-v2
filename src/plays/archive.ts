import { archiveThread, unarchiveThread, useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import type { CancelPlay } from './types'
import type { MenuItem } from './ui'
import { toast } from './ui'
import { archivePlay, playsUsing, unarchivePlay } from './usePlays'

export function archivePlayNow(play: CancelPlay) {
  const ui = useWorkspaceUi.getState()
  archivePlay(play.id)
  if (ui.page === 'play' && ui.playId === play.id) ui.setPage('order')
  toast(`Archived ${play.name}. Its experiences stay in the list.`)
}

export function archivePlayItem(play: CancelPlay): MenuItem {
  return {
    label: 'Archive play',
    icon: 'archive',
    confirm: play.status === 'live' ? 'It stops showing. Click again to archive' : undefined,
    onClick: () => archivePlayNow(play),
  }
}

export function archiveExperienceNow(id: string) {
  const title = useWorkspace.getState().threads.find((t) => t.id === id)?.title ?? 'the experience'
  const n = playsUsing(id).length
  const ui = useWorkspaceUi.getState()
  const open = ui.page === 'thread' && useWorkspace.getState().activeId === id
  archiveThread(id)
  if (open) ui.setPage('index')
  toast(n > 0 ? `Archived ${title} and took it out of ${n} play${n === 1 ? '' : 's'}.` : `Archived ${title}.`)
}

export function archiveExperienceItem(id: string): MenuItem {
  const n = playsUsing(id).length
  return {
    label: 'Archive experience',
    icon: 'archive',
    confirm: n > 0 ? `Take it out of ${n} play${n === 1 ? '' : 's'}?` : undefined,
    onClick: () => archiveExperienceNow(id),
  }
}

export function unarchivePlayNow(play: CancelPlay) {
  unarchivePlay(
    play.id,
    useWorkspace.getState().threads.map((t) => t.id),
  )
  toast(`${play.name} is back as a draft, at the bottom of the priority list.`)
}

export function unarchiveExperienceNow(id: string, title: string) {
  unarchiveThread(id)
  toast(`${title} is back in Experiences. It isn't in any play.`)
}
