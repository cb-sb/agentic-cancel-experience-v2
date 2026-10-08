import { create } from 'zustand'
import { useOrchestration } from '../store/useOrchestration'
import { useUpload } from '../upload/useUpload'
import { growthKey, growthPlace, restoreGrowthPlace, useGrowthUi, type GrowthPlace } from '../concierge/objective/useGrowthUi'
import { useRetentionSoon, type SoonPlace } from '../concierge/Soon'
import { V8 } from '../layout/layoutMode'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { switchThread, useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi, type LibraryKind, type StudioPage } from '../workspace/useWorkspaceUi'
import { hashFor, routeFromHash, type NavLeafId } from './nav'
import { useGrowthShell } from './useGrowthShell'

interface V10Location {
  active: string | null
  scope: 'portfolio' | 'acquisition' | 'expansion' | 'retention'
  slice: 'all' | 'in_app_offer' | 'pricing_table' | 'cancel_page'
}

let v10Api:
  | {
      location: (route?: NavLeafId) => V10Location
      restore: (route: NavLeafId, location?: V10Location) => void
    }
  | undefined

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
  /** Concierge: where the merchant is inside Acquisition or Expansion. */
  growth?: GrowthPlace
  /** Concierge: the not-yet-built place open in Retention. */
  soon?: SoonPlace | null
  /** V10's permanent scope or merchant-saved view. */
  v10?: V10Location
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
    growth: growthPlace(),
    soon: useRetentionSoon.getState().place,
    v10: v10Api?.location(),
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
    p.page === 'soon' ? (p.soon?.id ?? '') : '',
    growthKey(p.growth),
    p.v10 ? `${p.v10.active ?? ''}:${p.v10.scope}:${p.v10.slice}` : '',
  ].join('|')
}

function urlFor(place: Place): string {
  let hash = hashFor(place.route)
  if (place.route.startsWith('work.') && place.v10) {
    const params = new URLSearchParams()
    if (place.route === 'work.plays' && place.v10.scope !== 'portfolio') params.set('scope', place.v10.scope)
    if (place.route === 'work.experiences' && place.v10.slice !== 'all') params.set('slice', place.v10.slice)
    if (place.v10.active) params.set('view', place.v10.active)
    const query = params.toString()
    if (query) hash += `?${query}`
  }
  return `${window.location.pathname}${window.location.search}${hash}`
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
  if (mode === 'push') window.history.pushState(entry, '', urlFor(place))
  else window.history.replaceState(entry, '', urlFor(place))
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
  if (place.growth) restoreGrowthPlace(place.growth)
  if (place.soon !== undefined) useRetentionSoon.setState({ place: place.soon })
  v10Api?.restore(place.route, place.v10)
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
  useGrowthUi.subscribe(schedule)
  useRetentionSoon.subscribe(schedule)
  void import('../v10/useV10').then(({ restoreV10Location, useV10, v10Location }) => {
    v10Api = { location: v10Location, restore: restoreV10Location }
    write('replace', useNavHistory.getState().idx)
    useV10.subscribe(schedule)
  })
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
