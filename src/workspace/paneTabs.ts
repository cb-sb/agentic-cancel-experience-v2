import { LAYOUT, STUDIO, TABBED, V8 } from '../layout/layoutMode'
import { useCopilotThread } from '../orchestration/copilotThread'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { activeRef, newTabId, useWorkspaceUi, type PaneTab, type ThreadTabs } from './useWorkspaceUi'

let paused = false

/** Thread switches set tabs, surface, and mode together; don't let the watchers react mid-way. */
export function whilePaused(run: () => void) {
  paused = true
  try {
    run()
  } finally {
    paused = false
  }
}

function showTab(id: PaneTab) {
  const mode = useExperience.getState().mode
  if (id === 'preview') {
    if (mode !== 'play') {
      useOrchestration.getState().setWalkedOrSkipped(true)
      useExperience.getState().setMode('play')
    }
    return
  }
  if (mode === 'play') useExperience.getState().setMode('compose')
  if (id === 'plan' || id === 'targeting' || id === 'tasks') return
  if (useOrchestration.getState().workSurface !== id) useOrchestration.getState().setWorkSurface(id)
}

/** A preview tab keeps its own subscriber and device, so two previews can differ. */
function captureActive(tabs: ThreadTabs): ThreadTabs {
  const ref = activeRef(tabs)
  if (!ref || ref.kind !== 'preview') return tabs
  const state = { previewAs: useWorkspaceUi.getState().previewAs, device: useExperience.getState().device }
  return { ...tabs, open: tabs.open.map((t) => (t.id === ref.id ? { ...t, state } : t)) }
}

function restore(tabs: ThreadTabs) {
  const ref = activeRef(tabs)
  if (!ref || ref.kind !== 'preview' || !ref.state) return
  if (ref.state.previewAs !== undefined) useWorkspaceUi.getState().setPreviewAs(ref.state.previewAs)
  if (ref.state.device) useExperience.getState().setDevice(ref.state.device)
}

function activate(tabs: ThreadTabs, id: string) {
  const next = { ...captureActive(tabs), active: id }
  useWorkspaceUi.getState().setTabs(next)
  restore(next)
}

function markOpen(kind: PaneTab) {
  const { tabs, setTabs } = useWorkspaceUi.getState()
  const current = activeRef(tabs)
  if (current?.kind === kind) return
  const existing = tabs.open.find((t) => t.kind === kind)
  if (existing) {
    activate(tabs, existing.id)
    return
  }
  const id = newTabId(kind)
  setTabs({ ...captureActive(tabs), open: [...tabs.open, { id, kind }], active: id })
}

/** Open (or focus) a tab of this kind, and switch the stores to match. */
export function openTab(kind: PaneTab) {
  markOpen(kind)
  showTab(kind)
}

/** v8: another tab of this kind, next to the ones already open. Numbered in the tab bar. */
export function openAnotherTab(kind: PaneTab, after?: string) {
  const { tabs, setTabs } = useWorkspaceUi.getState()
  const captured = captureActive(tabs)
  const src = captured.open.find((t) => t.id === after)
  const id = newTabId(kind)
  const at = after ? captured.open.findIndex((t) => t.id === after) + 1 : captured.open.length
  const open = [...captured.open]
  open.splice(at, 0, { id, kind, state: src?.state })
  setTabs({ open, active: id })
  restore({ open, active: id })
  showTab(kind)
}

export function focusTab(id: string) {
  const { tabs } = useWorkspaceUi.getState()
  const ref = tabs.open.find((t) => t.id === id)
  if (!ref) return
  if (tabs.active !== id) activate(tabs, id)
  showTab(ref.kind)
}

export function closeTab(id: string) {
  const { tabs, setTabs } = useWorkspaceUi.getState()
  const at = tabs.open.findIndex((t) => t.id === id)
  if (at < 0) return
  const open = tabs.open.filter((t) => t.id !== id)
  const wasActive = tabs.active === id
  const active = wasActive ? (open[Math.min(at, open.length - 1)]?.id ?? null) : tabs.active
  setTabs({ open, active })
  const ref = open.find((t) => t.id === active)
  if (ref) {
    if (wasActive) restore({ open, active })
    showTab(ref.kind)
  } else if (useExperience.getState().mode === 'play') useExperience.getState().setMode('compose')
}

/** "Preview 2" for the second preview tab; the first keeps the plain name. */
export function tabNumber(tabs: ThreadTabs, id: string): number {
  const ref = tabs.open.find((t) => t.id === id)
  if (!ref) return 1
  return tabs.open.filter((t) => t.kind === ref.kind).findIndex((t) => t.id === id) + 1
}

/**
 * Copilot and the step strip drive the same stores V5 uses. These watchers turn
 * that into the layout's language: a tab (tabs, v7) or an un-hidden pane (threads).
 */
export function startPaneSync() {
  let mode = useExperience.getState().mode
  useExperience.subscribe((s) => {
    if (s.mode === mode) return
    mode = s.mode
    if (paused || !TABBED) return
    const { tabs } = useWorkspaceUi.getState()
    if (s.mode === 'play') markOpen('preview')
    else if (activeRef(tabs)?.kind === 'preview') markOpen(useOrchestration.getState().workSurface)
  })

  let surface = useOrchestration.getState().workSurface
  let focused = useOrchestration.getState().focusTarget !== null
  let strip = useOrchestration.getState().stepStripShown
  useOrchestration.subscribe((s) => {
    const surfaceChanged = s.workSurface !== surface
    const focusOpened = !focused && s.focusTarget !== null
    const stripOpened = !strip && s.stepStripShown
    surface = s.workSurface
    focused = s.focusTarget !== null
    strip = s.stepStripShown
    if (paused || !(surfaceChanged || focusOpened || stripOpened)) return
    if (LAYOUT === 'threads') {
      useWorkspaceUi.getState().setPaneHidden(false)
      return
    }
    if (useExperience.getState().mode === 'play' && !surfaceChanged) return
    markOpen(s.workSurface)
    if (useExperience.getState().mode === 'play') useExperience.getState().setMode('compose')
  })

  // v8 has no Targeting tab: audience and tests are set in the chat card itself.
  if (!STUDIO || V8) return
  let beat = useCopilotThread.getState().beat
  useCopilotThread.subscribe((s) => {
    if (s.beat === beat) return
    beat = s.beat
    if (paused || s.turn !== 'plan') return
    if (beat === 'audience' || beat === 'experiment') openTab('targeting')
  })
}
