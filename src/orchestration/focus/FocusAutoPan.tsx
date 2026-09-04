import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useOrchestration } from '../../store/useOrchestration'
import { ASSISTANT_FOLDED_W } from '../paneTokens'
import { useFocusGeometry } from './useFocusGeometry'

/** Room left between the focused step and the edges of the strip, in screen px. */
const MARGIN = 32
/**
 * How far into the strip the focused step may sit before it is pulled back.
 *
 * The flow reads left to right and the drawer sits on the right, so anything
 * downstream of the focused step is the first thing the drawer eats. Parking
 * the focused step near the left of the strip spends the remaining width on the
 * steps that follow — the ones a merchant is most likely to want next.
 */
const SETTLE = 0.45

/**
 * The pan runs alongside the drawer's own entrance rather than after it, so
 * opening reads as one movement. The short delay is for correctness, not
 * staging — see the effect below.
 */
const PAN_DELAY = 48
const PAN_MS = 240

/**
 * Keeps the step being edited, and what follows it, visible beside the drawer.
 *
 * Without this the drawer covers the very card you just double-clicked, and the
 * variant that exists to preserve context would preserve less of it than the
 * overlay it competes with. The pan is what makes the claim true.
 *
 * It only fires when the step has drifted out of the comfortable band, not on
 * every change. Re-aligning each time would drag the play around under someone
 * who can already see where they are, and the stillness of the canvas is half
 * of what makes it readable as context.
 *
 * Mounted inside the React Flow provider, since that is where the viewport is.
 */
export function FocusAutoPan() {
  const { getViewport, setViewport } = useReactFlow()
  const focusTarget = useOrchestration((s) => s.focusTarget)
  const presentation = useOrchestration((s) => s.focusPresentation)
  const { scrimW, mode } = useFocusGeometry()

  const stepId = focusTarget?.stepId ?? null
  const active = presentation === 'drawer' && Boolean(stepId) && mode === 'drawer'

  useEffect(() => {
    if (!active) return

    // A few frames in, not on the next one: the assistant folds as the drawer
    // opens, and `CanvasAnchor` has to have cancelled that out before an
    // absolute viewport is set against it, or the two corrections stack.
    const id = setTimeout(() => {
      const pane = document.querySelector('[data-canvas-pane]')
      const root = document.querySelector('[data-focus-root]')
      const node = document.querySelector('[data-step-focused]')?.closest('.react-flow__node')
      if (!pane || !root || !node) return

      const p = pane.getBoundingClientRect()
      const n = node.getBoundingClientRect()
      const r = root.getBoundingClientRect()
      // Both edges come from settled numbers rather than live rects: the
      // assistant column is still folding and the drawer still sliding while
      // this runs, so measuring either would aim at a strip that is on its way
      // somewhere else.
      const strip = {
        left: r.left + ASSISTANT_FOLDED_W + MARGIN,
        right: r.left + scrimW - MARGIN,
      }
      if (strip.right <= strip.left) return

      // Already parked where it leaves room for what comes next.
      const settled = strip.left + (strip.right - strip.left) * SETTLE
      if (n.left >= strip.left && n.left <= settled && n.right <= strip.right) return

      // A step wider than the strip cannot be left-aligned and fit; centre it
      // and accept that its edges are cropped.
      const dx =
        n.width > strip.right - strip.left
          ? (strip.left + strip.right) / 2 - (n.left + n.right) / 2
          : strip.left - n.left
      const dy = p.top + p.height / 2 - (n.top + n.bottom) / 2

      const v = getViewport()
      setViewport({ x: v.x + dx, y: v.y + dy, zoom: v.zoom }, { duration: PAN_MS })
    }, PAN_DELAY)
    return () => clearTimeout(id)
  }, [active, stepId, scrimW, getViewport, setViewport])

  return null
}
