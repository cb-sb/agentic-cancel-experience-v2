import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { surveyOf } from '../../lib/mapping'
import { useExperience, type DeviceKind } from '../../store/useExperience'
import { useOrchestration, type FocusPresentation } from '../../store/useOrchestration'
import type { SplitMode } from '../../types/orchestration'
import { isExperienceTarget } from '../ExperienceEnclosure'

/**
 * Driving the canvas from outside needs a handle on the viewport, and the zoom
 * bar's buttons are too coarse to land on an exact zoom. This exposes the few
 * verbs `scripts/canvas-audit.ts` needs. Dev builds only — the effect bails in
 * production, so the object never exists in a shipped bundle.
 */
export interface CanvasTestApi {
  zoom: () => number
  /** Zoom about the middle of the pane, the way scroll-zoom does. */
  setZoom: (z: number) => void
  fit: () => void
  /** Focus the nth step of the first experience; -1 leaves focus mode. */
  focusStep: (index: number) => void
  toggleCollapse: () => void
  /** Reason-to-offer links the canvas is expected to be drawing. */
  mappingExpected: () => number
  stepCount: () => number
  /** Which focus presentation to trial — overlay or drawer. */
  setFocusPresentation: (presentation: FocusPresentation) => void
  /** Device the focused card is previewed at; desktop is the widest, so the test. */
  setDevice: (device: DeviceKind) => void
  setAssistantOpen: (open: boolean) => void
  /** How traffic is divided — the spine has a different shape per mode. */
  setSplitMode: (mode: SplitMode) => void
}

declare global {
  interface Window {
    __canvas?: CanvasTestApi
  }
}

export function CanvasTestHook() {
  const { getViewport, setViewport, fitView } = useReactFlow()

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const firstExperience = () => {
      const { experiences } = useExperience.getState()
      return Object.values(experiences)[0] ?? null
    }

    const api: CanvasTestApi = {
      zoom: () => getViewport().zoom,
      setZoom: (z) => {
        const { x, y, zoom: k } = getViewport()
        const pane = document.querySelector('.react-flow__pane')?.parentElement
        const cx = pane ? pane.clientWidth / 2 : 400
        const cy = pane ? pane.clientHeight / 2 : 300
        const ratio = z / k
        setViewport({ x: cx - (cx - x) * ratio, y: cy - (cy - y) * ratio, zoom: z }, { duration: 0 })
      },
      fit: () => fitView({ padding: 0.12, duration: 0 }),
      focusStep: (index) => {
        const store = useOrchestration.getState()
        if (index < 0) {
          store.exitFocus()
          return
        }
        const exp = firstExperience()
        const step = exp?.steps[index]
        if (exp && step) store.focusStep({ experienceId: exp.id, stepId: step.id })
      },
      toggleCollapse: () => {
        const { play, toggleFlowCollapsed } = useOrchestration.getState()
        const branch = play.targeting.kind === 'split' ? play.targeting.branches[0] : null
        if (branch?.node.kind === 'flow') toggleFlowCollapsed(branch.node.id)
      },
      // Only the experiences whose steps are actually on the canvas: a collapsed
      // enclosure draws no cards, so it owes no connectors.
      mappingExpected: () => {
        const { experiences } = useExperience.getState()
        const { play, collapsedFlows } = useOrchestration.getState()
        if (play.targeting.kind !== 'split') return 0

        return play.targeting.branches.reduce((total, branch) => {
          const node = branch.node
          if (node.kind !== 'flow' || !isExperienceTarget(node.target, experiences[node.experienceId])) return total
          if (collapsedFlows[node.id]) return total
          const exp = experiences[node.experienceId]
          const survey = exp ? surveyOf(exp) : null
          if (!survey) return total
          return total + survey.options.filter((o) => o.linkedOfferId).length
        }, 0)
      },
      stepCount: () => firstExperience()?.steps.length ?? 0,
      setFocusPresentation: (p) => useOrchestration.getState().setFocusPresentation(p),
      setDevice: (d) => useExperience.getState().setDevice(d),
      setAssistantOpen: (open) => useOrchestration.getState().setAssistantOpen(open),
      setSplitMode: (mode) => {
        const { play, setSplitMode } = useOrchestration.getState()
        if (play.targeting.kind === 'split') setSplitMode(play.targeting.id, mode)
      },
    }

    window.__canvas = api
    return () => {
      delete window.__canvas
    }
  }, [getViewport, setViewport, fitView])

  return null
}
