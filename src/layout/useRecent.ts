import { create } from 'zustand'
import { contextPlayId } from '../plays/navigate'
import { useOrchestration } from '../store/useOrchestration'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { CONCIERGE } from './layoutMode'

export interface RecentItem {
  kind: 'play' | 'experience'
  id: string
}

const KEY = 'cancel-experience:recent:concierge'
const MAX = 8

function read(): RecentItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value)
      ? value.filter((x): x is RecentItem => Boolean(x) && (x.kind === 'play' || x.kind === 'experience') && typeof x.id === 'string')
      : []
  } catch {
    return []
  }
}

export const useRecent = create<{ items: RecentItem[] }>(() => ({ items: read() }))

function push(item: RecentItem) {
  const items = useRecent.getState().items
  if (items[0]?.kind === item.kind && items[0]?.id === item.id) return
  const next = [item, ...items.filter((x) => x.kind !== item.kind || x.id !== item.id)].slice(0, MAX)
  useRecent.setState({ items: next })
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage blocked */
  }
}

function track() {
  const { page, playId } = useWorkspaceUi.getState()
  if (page === 'play' && playId) return push({ kind: 'play', id: playId })
  if (page !== 'thread' || useOrchestration.getState().templatesOpen) return
  const inPlay = contextPlayId()
  if (inPlay) return push({ kind: 'play', id: inPlay })
  const activeId = useWorkspace.getState().activeId
  if (activeId) push({ kind: 'experience', id: activeId })
}

if (CONCIERGE) {
  useWorkspaceUi.subscribe((s, before) => {
    if (s.page !== before.page || s.playId !== before.playId) track()
  })
  useWorkspace.subscribe((s, before) => {
    if (s.activeId !== before.activeId) track()
  })
  useOrchestration.subscribe((s, before) => {
    if (s.templatesOpen !== before.templatesOpen) track()
  })
  track()
}
