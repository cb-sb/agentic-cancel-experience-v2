import { LAYOUT, STUDIO, TABBED, V8 } from '../layout/layoutMode'
import { useCopilotThread } from '../orchestration/copilotThread'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { useWorkspaceUi, type PaneTab } from './useWorkspaceUi'

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
  if (id === 'plan' || id === 'targeting') return
  if (useOrchestration.getState().workSurface !== id) useOrchestration.getState().setWorkSurface(id)
}

function markOpen(id: PaneTab) {
  const { tabs, setTabs } = useWorkspaceUi.getState()
  if (tabs.active === id && tabs.open.includes(id)) return
  setTabs({ open: tabs.open.includes(id) ? tabs.open : [...tabs.open, id], active: id })
}

/** Open (or focus) the one tab of this kind, and switch the stores to match. */
export function openTab(id: PaneTab) {
  markOpen(id)
  showTab(id)
}

export function closeTab(id: PaneTab) {
  const { tabs, setTabs } = useWorkspaceUi.getState()
  const open = tabs.open.filter((t) => t !== id)
  const active = tabs.active === id ? (open[open.length - 1] ?? null) : tabs.active
  setTabs({ open, active })
  if (active) showTab(active)
  else if (useExperience.getState().mode === 'play') useExperience.getState().setMode('compose')
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
    const { tabs, setTabs } = useWorkspaceUi.getState()
    if (s.mode === 'play') markOpen('preview')
    else if (tabs.active === 'preview') {
      const surface = useOrchestration.getState().workSurface
      setTabs({ open: tabs.open.includes(surface) ? tabs.open : [...tabs.open, surface], active: surface })
    }
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
