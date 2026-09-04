import type { Step } from '../../types/experience'
import { ENCLOSURE_PAD, STEP_GAP_X, STEP_W } from './canvasTokens'
import { isTailStep, type EnclosureGrid } from './stepGrid'

/** A place a dragged step can be let go of, in world units. */
export interface DropPoint {
  /** Centre of the gap the step would land in. */
  x: number
  /** Top of the marker, and how tall it is. */
  y: number
  h: number
  /** Step the dragged one is inserted before. Empty means last. */
  toId: string
}

/**
 * Mirrors `reorderSteps`: lift the step out, put it back before `toId`. Kept
 * here so a drop can be tested before it is committed.
 */
function reordered(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId)
  if (from === -1) return ids
  const rest = ids.filter((_, i) => i !== from)
  const to = rest.indexOf(toId)
  rest.splice(to === -1 ? rest.length : to, 0, fromId)
  return rest
}

/**
 * Every place along the branch the dragged step could go.
 *
 * One point per gap between columns, and one after the last movable column —
 * confirmation and outcome close the flow, so nothing is offered past them.
 * Points that would leave the order as it is get dropped, so every marker the
 * drag shows is a move that actually happens, and letting go on the step's own
 * position is a no-op rather than a jump.
 */
export function dropPoints(grid: EnclosureGrid, steps: Step[], sourceId: string): DropPoint[] {
  const movable = grid.columns
    .map((col, i) => ({ col, i }))
    .filter(({ col }) => !col.steps.some(({ step }) => isTailStep(step)))
  if (!movable.length) return []

  const xOf = (i: number) => grid.slots.find((s) => s.col === i)?.x ?? 0
  const y = ENCLOSURE_PAD
  const h = grid.h - ENCLOSURE_PAD * 2
  const firstOf = (i: number) => grid.columns[i]?.steps[0]?.step.id ?? ''

  const tail = grid.columns.findIndex((c) => c.steps.some(({ step }) => isTailStep(step)))
  const last = movable[movable.length - 1].i

  const points: DropPoint[] = movable.map(({ i }) => ({
    x: xOf(i) - STEP_GAP_X / 2,
    y,
    h,
    toId: firstOf(i),
  }))
  points.push({
    x: xOf(last) + STEP_W + STEP_GAP_X / 2,
    y,
    h,
    toId: tail === -1 ? '' : firstOf(tail),
  })

  const now = steps.map((s) => s.id)
  const unchanged = now.join()
  return points.filter((p) => reordered(now, sourceId, p.toId).join() !== unchanged)
}

/** The point a world x is closest to. */
export function nearestDrop(points: DropPoint[], x: number): DropPoint | null {
  let best: DropPoint | null = null
  let dist = Infinity
  for (const p of points) {
    const d = Math.abs(p.x - x)
    if (d < dist) {
      dist = d
      best = p
    }
  }
  return best
}
