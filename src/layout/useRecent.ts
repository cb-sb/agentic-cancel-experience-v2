import { create } from 'zustand'
import { contextPlayId } from '../plays/navigate'
import { useOrchestration } from '../store/useOrchestration'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { V9 } from './layoutMode'

/** A play, or an experience that isn't being worked on through a play. */
export interface RecentItem {
  kind: 'play' | 'experience'
  id: string
}

const KEY = 'cancel-experience:recent:v9'
const MAX = 8

function read(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.filter(
      (x): x is RecentItem => Boolean(x) && (x.kind === 'play' || x.kind === 'experience') && typeof x.id === 'string',
    )
  } catch {
    return []
  }
}

export const useRecent = create<{ items: RecentItem[] }>(() => ({ items: read() }))

function push(item: RecentItem) {
  const { items } = useRecent.getState()
  if (items[0]?.kind === item.kind && items[0]?.id === item.id) return
  const next = [item, ...items.filter((x) => !(x.kind === item.kind && x.id === item.id))].slice(0, MAX)
  useRecent.setState({ items: next })
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage blocked */
  }
}

/** An experience opened from a play counts as that play. */
function track() {
  const { page, playId } = useWorkspaceUi.getState()
  if (page === 'play' && playId) return push({ kind: 'play', id: playId })
  if (page !== 'thread' || useOrchestration.getState().templatesOpen) return
  const inPlay = contextPlayId()
  if (inPlay) return push({ kind: 'play', id: inPlay })
  const { activeId } = useWorkspace.getState()
  if (activeId) push({ kind: 'experience', id: activeId })
}

if (V9) {
  useWorkspaceUi.subscribe((s, prev) => {
    if (s.page !== prev.page || s.playId !== prev.playId) track()
  })
  useWorkspace.subscribe((s, prev) => {
    if (s.activeId !== prev.activeId) track()
  })
  useOrchestration.subscribe((s, prev) => {
    if (s.templatesOpen !== prev.templatesOpen) track()
  })
  track()
}
