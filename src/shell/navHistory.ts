import { create } from 'zustand'
import { useOrchestration } from '../store/useOrchestration'
import { useUpload } from '../upload/useUpload'
import { V8 } from '../layout/layoutMode'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { switchThread, useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi, type LibraryKind, type StudioPage } from '../workspace/useWorkspaceUi'
import { hashFor, routeFromHash, type NavLeafId } from './nav'
import { useGrowthShell } from './useGrowthShell'

/** Where the merchant is: the Growth page, and inside the composer which view and experience. */
interface Place {
  route: NavLeafId
  page: StudioPage
  threadId: string
  templates: boolean
  upload?: boolean
  readOnlyId: string | null
  playId?: string | null
  libraryKind?: LibraryKind
}

interface EntryState {
  place: Place
  idx: number
}

/** How many steps back the browser history holds for this app. */
export const useNavHistory = create<{ idx: number }>(() => ({ idx: 0 }))

function currentPlace(): Place {
  const ui = useWorkspaceUi.getState()
  return {
    route: useGrowthShell.getState().route,
    page: ui.page,
    threadId: useWorkspace.getState().activeId,
    templates: useOrchestration.getState().templatesOpen,
    upload: uploadPageOpen(),
    readOnlyId: ui.readOnlyId,
    playId: ui.playId,
    libraryKind: ui.libraryKind,
  }
}

function uploadPageOpen(): boolean {
  const { phase, mappingOnly } = useUpload.getState()
  return V8 && phase !== 'closed' && !mappingOnly
}

function keyOf(p: Place): string {
  return [
    p.route,
    p.page,
    p.threadId,
    p.templates ? 1 : 0,
    p.upload ? 1 : 0,
    p.readOnlyId ?? '',
    p.playId ?? '',
    p.page === 'library' ? (p.libraryKind ?? '') : '',
  ].join('|')
}

function urlFor(route: NavLeafId): string {
  return `${window.location.pathname}${window.location.search}${hashFor(route)}`
}

function readEntry(state: unknown): EntryState | null {
  const s = state as Partial<EntryState> | null
  return s && s.place && typeof s.idx === 'number' ? (s as EntryState) : null
}

let committed = ''
let restoring = false
let scheduled = false

function write(mode: 'push' | 'replace', idx: number) {
  const place = currentPlace()
  committed = keyOf(place)
  const entry: EntryState = { place, idx }
  if (mode === 'push') window.history.pushState(entry, '', urlFor(place.route))
  else window.history.replaceState(entry, '', urlFor(place.route))
  useNavHistory.setState({ idx })
}

// Clicks change several stores in one go, so wait a tick and record one step.
function schedule() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(() => {
    scheduled = false
    if (restoring) return
    if (keyOf(currentPlace()) === committed) return
    write('push', useNavHistory.getState().idx + 1)
  })
}

function apply(place: Place) {
  useGrowthShell.getState().go(place.route)
  const ws = useWorkspace.getState()
  if (place.threadId !== ws.activeId && ws.threads.some((t) => t.id === place.threadId)) {
    switchThread(place.threadId)
  }
  useWorkspaceUi.setState({
    page: place.page,
    readOnlyId: place.readOnlyId,
    searchOpen: false,
    ...(place.playId !== undefined ? { playId: place.playId } : {}),
    ...(place.libraryKind ? { libraryKind: place.libraryKind } : {}),
  })
  useCancelSettings.getState().setSettingsOpen(false)
  const orch = useOrchestration.getState()
  if (place.templates && !orch.templatesOpen) orch.openTemplates()
  if (!place.templates && orch.templatesOpen) orch.closeTemplates()
  const upload = useUpload.getState()
  if (place.upload && !uploadPageOpen()) upload.open()
  if (!place.upload && uploadPageOpen()) upload.close()
}

/** Moves without adding a history step, then records where they landed in the current entry. */
function moveInPlace(move: () => void, idx: number) {
  restoring = true
  move()
  queueMicrotask(() => {
    write('replace', idx)
    restoring = false
  })
}

function onPopState(e: PopStateEvent) {
  const entry = readEntry(e.state)
  moveInPlace(
    () => apply(entry ? entry.place : { ...currentPlace(), route: routeFromHash(window.location.hash) }),
    entry ? entry.idx : useNavHistory.getState().idx + 1,
  )
}

/** Call once after the workspace loads. Every move after this is one step in browser history. */
export function startNavHistory() {
  const saved = readEntry(window.history.state)
  write('replace', saved ? saved.idx : 0)
  useGrowthShell.subscribe(schedule)
  useWorkspaceUi.subscribe(schedule)
  useWorkspace.subscribe(schedule)
  useOrchestration.subscribe(schedule)
  useUpload.subscribe(schedule)
  window.addEventListener('popstate', onPopState)
}

/**
 * Step back like the browser does. With nothing to go back to, run `fallback`
 * in place of the current entry, so repeated Back keeps climbing and never loops.
 */
export function goBack(fallback?: () => void) {
  if (useNavHistory.getState().idx > 0) window.history.back()
  else if (fallback) moveInPlace(fallback, 0)
}

export function useCanGoBack(): boolean {
  return useNavHistory((s) => s.idx > 0)
}
