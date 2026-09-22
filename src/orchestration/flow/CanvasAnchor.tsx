import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useOrchestration } from '../../store/useOrchestration'

/**
 * Keeps the graph still in screen space when the canvas column changes size.
 *
 * React Flow's viewport is measured from the pane's own left edge, so anything
 * that moves that edge drags the whole play sideways by the same amount, in a
 * single frame. Copilot now lives on the right, so opening it usually leaves
 * this edge still — the hook still covers window resizes and the settings pane.
 *
 * Cancelling the delta out means panels open and close *over* a still graph. Any
 * deliberate movement, like `FocusAutoPan` bringing the focused step into view,
 * is then the only thing moving and can be seen for what it is.
 *
 * Mounted inside the React Flow provider, since that is where the viewport is.
 */
export function CanvasAnchor() {
  const { getViewport, setViewport } = useReactFlow()
  const assistantOpen = useOrchestration((s) => s.assistantOpen)
  const copilotRailExpanded = useOrchestration((s) => s.copilotRailExpanded)
  const last = useRef<number | null>(null)

  const hold = useCallback(() => {
    const pane = document.querySelector('[data-canvas-pane]')
    if (!pane) return
    const left = pane.getBoundingClientRect().left
    const was = last.current
    if (was === null) {
      last.current = left
      return
    }

    // Sub-pixel churn from a layout settling is not a panel moving. `last` is
    // deliberately left alone here so the remainder accumulates into the next
    // correction: an easing curve ends in a long tail of tiny deltas, and
    // dropping each one drifts the graph a few pixels over an animation.
    const dx = left - was
    if (Math.abs(dx) < 1) return
    last.current = left

    const v = getViewport()
    setViewport({ ...v, x: v.x - dx })
  }, [getViewport, setViewport])

  /**
   * The assistant is the one thing that moves this edge on purpose, and it is
   * worth catching before the frame is painted: a resize observer fires after
   * layout, which was late enough to show a single frame of the play at its
   * uncorrected position — a flicker on the way out of focus.
   */
  useLayoutEffect(hold, [hold, assistantOpen, copilotRailExpanded])

  useEffect(() => {
    const pane = document.querySelector('[data-canvas-pane]')
    if (!pane) return
    // Everything else that can move it: window resizes, the settings pane
    // changing width, a devtools split.
    const ro = new ResizeObserver(hold)
    ro.observe(pane)
    if (pane.parentElement) ro.observe(pane.parentElement)
    return () => ro.disconnect()
  }, [hold])

  return null
}
