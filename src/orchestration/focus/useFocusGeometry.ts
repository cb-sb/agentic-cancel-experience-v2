import { useLayoutEffect, useState } from 'react'
import { CANVAS_PEEK_MIN, DRAWER_FRACTION, DRAWER_W } from './tokens'

export interface FocusGeometry {
  /** Distance from the focus root's right edge to the canvas pane's. */
  rightInset: number
  /** Width the drawer should take. */
  drawerW: number
  /** Everything left of the drawer: what the scrim covers. */
  scrimW: number
  /** `full` means there was not room for a 1:1 card and anything else. */
  mode: 'drawer' | 'full'
}

/**
 * Where a focus presentation is allowed to sit, measured rather than assumed.
 *
 * Both presentations stop at the same place on the right: the settings pane is
 * what you edit the focused card *with*, so covering it would take away half
 * the reason to be in focus at all. Everything to the left of it is fair game —
 * which is what gives the overlay room for a 680px card on a laptop, where the
 * canvas column alone is 646px and was quietly clipping it.
 *
 * The drawer then takes a share of the viewport out of that room, bounded on
 * both sides: never so wide that the play behind it stops being readable, never
 * narrower than a 1:1 card. On a screen too narrow to hold both that card and
 * any play beside it, it takes everything and ends up looking like the overlay —
 * which is the honest thing for it to look like, because at that width it is one.
 *
 * Measured against the root rather than the canvas column because the drawer
 * floats over both: the assistant folds to a strip while it is open, and the
 * settings pane changes width with what it is showing.
 */
export function useFocusGeometry(): FocusGeometry {
  const [rect, setRect] = useState<{ rightInset: number; rootW: number } | null>(null)

  useLayoutEffect(() => {
    const pane = document.querySelector('[data-canvas-pane]')
    const root = document.querySelector('[data-focus-root]')
    if (!pane || !root) return

    const read = () => {
      const p = pane.getBoundingClientRect()
      const r = root.getBoundingClientRect()
      setRect({ rightInset: Math.max(0, Math.round(r.right - p.right)), rootW: Math.round(r.width) })
    }

    const ro = new ResizeObserver(read)
    ro.observe(pane)
    ro.observe(root)
    read()
    return () => ro.disconnect()
  }, [])

  const rightInset = rect?.rightInset ?? 0
  const rootW = rect?.rootW ?? DRAWER_W
  const room = Math.max(0, rootW - rightInset)
  const fits = room >= DRAWER_W

  // Three claims, in the order they win when they cannot all hold: the card is
  // 1:1, the play stays visible beside it, the drawer takes its share. Taking
  // the share literally is what breaks the middle one — on a 1366 screen it
  // leaves 50px of canvas, which is a scrim over nothing.
  const share = Math.round(rootW * DRAWER_FRACTION)
  const drawerW = fits
    ? Math.min(room, Math.max(Math.min(share, room - CANVAS_PEEK_MIN), DRAWER_W))
    : room

  return {
    rightInset,
    drawerW,
    scrimW: Math.max(0, room - drawerW),
    mode: fits ? 'drawer' : 'full',
  }
}
